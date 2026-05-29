//! The installed-plugin registry and its lockfile.
//!
//! Two artefacts live under `plugins/` next to the per-plugin trees:
//!
//! - `plugins/registry.json` — the rich, mutable record of every installed
//!   plugin: its full manifest, enabled/disabled state, install source, install
//!   timestamp, and the trust verdict the install pipeline computed.
//! - `plugins/installed.lock.json` — a slim, integrity-pinning companion: one
//!   [`LockEntry`] per plugin recording the SHA-256 digests and signature the
//!   plugin was admitted with, so a later `verify` can re-derive trust without
//!   trusting `registry.json` blindly.
//!
//! Core never names a plugin: the builtin Notes plugin is *seeded as data* here
//! ([`seed_builtins`]) rather than wired in by name from core code. Everything
//! else (install pipelines, the HTTP layer) goes through these free functions so
//! the on-disk shape stays in one place.

use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::domain::API_VERSION;
use crate::storage::{StoreError, StoreResult, atomic_json, read_json};

use super::manifest::{ApiVersionRange, IntegrityMeta, PluginManifest, Shortcut};
use super::signing::{TrustStatus, sha256_hex};

/// Folder (under the storage root) that holds the whole plugin subsystem on disk.
const PLUGINS_DIR: &str = "plugins";
/// Rich, mutable installed-plugin record.
const REGISTRY_FILE: &str = "registry.json";
/// Slim, integrity-pinning lockfile.
const LOCK_FILE: &str = "installed.lock.json";

/// Whether an installed plugin is currently active.
///
/// New installs default to [`Disabled`](PluginState::Disabled); the builtin
/// Notes plugin is the sole exception — it is seeded [`Enabled`](PluginState::Enabled).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PluginState {
    Enabled,
    Disabled,
}

/// Where a plugin came from. [`Builtin`](PluginSource::Builtin) plugins ship with
/// the host and are seeded, never installed through the zip/url pipelines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PluginSource {
    Builtin,
    Zip,
    Url,
}

/// One plugin's full record in `registry.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPlugin {
    pub manifest: PluginManifest,
    pub state: PluginState,
    pub source: PluginSource,
    /// RFC 3339 timestamp of first install. Preserved across `upsert` reinstalls.
    pub installed_at: String,
    pub trust: TrustStatus,
}

impl InstalledPlugin {
    /// Convenience accessor for the plugin id (the registry/lock key).
    pub fn id(&self) -> &str {
        &self.manifest.id
    }
}

/// One plugin's integrity pin in `installed.lock.json`.
///
/// Deliberately slim: just enough to re-derive a trust verdict (recompute the
/// package digest, re-check the signature) without consulting the richer — and
/// mutable — `registry.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockEntry {
    pub id: String,
    pub version: String,
    #[serde(default)]
    pub package_sha256: String,
    #[serde(default)]
    pub manifest_sha256: String,
    /// Base64 Ed25519 signature over the manifest, if the package carried one.
    #[serde(default)]
    pub signature: Option<String>,
    /// The trust verdict recorded at install time.
    pub verified: TrustStatus,
}

impl LockEntry {
    /// Derive a lock entry from an installed plugin, folding in the manifest
    /// digest if the integrity block did not already carry one.
    fn from_installed(plugin: &InstalledPlugin) -> Self {
        let integrity = &plugin.manifest.integrity;
        let manifest_sha256 = if integrity.manifest_sha256.trim().is_empty() {
            manifest_digest(&plugin.manifest)
        } else {
            integrity.manifest_sha256.clone()
        };
        Self {
            id: plugin.manifest.id.clone(),
            version: plugin.manifest.version.clone(),
            package_sha256: integrity.package_sha256.clone(),
            manifest_sha256,
            signature: plugin
                .manifest
                .signature
                .as_ref()
                .map(|signature| signature.signature.clone()),
            verified: plugin.trust,
        }
    }
}

/// Best-effort manifest digest: SHA-256 over the canonical JSON serialization.
/// Used only as a fallback when the manifest's own `integrity.manifest_sha256`
/// is absent, so the lockfile always pins *something* hashable.
fn manifest_digest(manifest: &PluginManifest) -> String {
    match serde_json::to_vec(manifest) {
        Ok(bytes) => sha256_hex(&bytes),
        Err(_) => String::new(),
    }
}

/// Absolute path to `plugins/`.
fn plugins_dir(root: &Path) -> PathBuf {
    root.join(PLUGINS_DIR)
}

/// Absolute path to `plugins/registry.json`.
fn registry_path(root: &Path) -> PathBuf {
    plugins_dir(root).join(REGISTRY_FILE)
}

/// Absolute path to `plugins/installed.lock.json`.
fn lock_path(root: &Path) -> PathBuf {
    plugins_dir(root).join(LOCK_FILE)
}

/// Read `registry.json`, treating a missing file as an empty registry so callers
/// never have to special-case first run.
fn read_registry(root: &Path) -> StoreResult<Vec<InstalledPlugin>> {
    let path = registry_path(root);
    if path.exists() {
        read_json(&path)
    } else {
        Ok(Vec::new())
    }
}

/// Read `installed.lock.json`, treating a missing file as an empty lockfile.
fn read_lock(root: &Path) -> StoreResult<Vec<LockEntry>> {
    let path = lock_path(root);
    if path.exists() {
        read_json(&path)
    } else {
        Ok(Vec::new())
    }
}

/// Persist both `registry.json` and `installed.lock.json` atomically (each via
/// the storage atomic-write helper). The lockfile is regenerated from the
/// registry so the two never drift.
fn write_registry(root: &Path, plugins: &[InstalledPlugin]) -> StoreResult<()> {
    let lock: Vec<LockEntry> = plugins.iter().map(LockEntry::from_installed).collect();
    atomic_json(&registry_path(root), &plugins)?;
    atomic_json(&lock_path(root), &lock)?;
    Ok(())
}

/// All installed plugins, in install order.
pub fn list(root: &Path) -> StoreResult<Vec<InstalledPlugin>> {
    read_registry(root)
}

/// A single installed plugin by id, or [`StoreError::NotFound`].
pub fn get(root: &Path, id: &str) -> StoreResult<InstalledPlugin> {
    read_registry(root)?
        .into_iter()
        .find(|plugin| plugin.manifest.id == id)
        .ok_or(StoreError::NotFound)
}

/// The lockfile entries, in registry order. Used by the `verify` endpoint to
/// re-derive trust against the recorded integrity pins.
pub fn lock_entries(root: &Path) -> StoreResult<Vec<LockEntry>> {
    read_lock(root)
}

/// The lockfile entry for a single plugin by id, or [`StoreError::NotFound`].
pub fn lock_entry(root: &Path, id: &str) -> StoreResult<LockEntry> {
    read_lock(root)?
        .into_iter()
        .find(|entry| entry.id == id)
        .ok_or(StoreError::NotFound)
}

/// Flip a plugin's enabled/disabled state.
///
/// Enabling is refused on [`TrustStatus::Mismatch`]: a plugin whose package
/// digest did not match (or whose signature failed) must never be activated.
/// Disabling is always allowed regardless of trust.
pub fn set_state(root: &Path, id: &str, state: PluginState) -> StoreResult<InstalledPlugin> {
    let mut plugins = read_registry(root)?;
    let plugin = plugins
        .iter_mut()
        .find(|plugin| plugin.manifest.id == id)
        .ok_or(StoreError::NotFound)?;
    if state == PluginState::Enabled && plugin.trust == TrustStatus::Mismatch {
        return Err(StoreError::Validation(
            "integridade do plugin não confere; ativação bloqueada".into(),
        ));
    }
    plugin.state = state;
    let updated = plugin.clone();
    write_registry(root, &plugins)?;
    Ok(updated)
}

/// Insert a freshly installed plugin, or replace an existing record with the
/// same id (a reinstall/upgrade). On replace, the original `installed_at` is
/// preserved so the timestamp reflects first install, not the latest write.
pub fn upsert(root: &Path, plugin: InstalledPlugin) -> StoreResult<InstalledPlugin> {
    let mut plugins = read_registry(root)?;
    let mut plugin = plugin;
    if let Some(existing) = plugins
        .iter_mut()
        .find(|existing| existing.manifest.id == plugin.manifest.id)
    {
        plugin.installed_at = existing.installed_at.clone();
        *existing = plugin.clone();
    } else {
        plugins.push(plugin.clone());
    }
    write_registry(root, &plugins)?;
    Ok(plugin)
}

/// Remove a plugin's registry + lockfile record. Returns whether anything was
/// removed. This touches metadata only; the caller decides whether the plugin's
/// on-disk tree and data are also purged.
pub fn remove(root: &Path, id: &str) -> StoreResult<bool> {
    let mut plugins = read_registry(root)?;
    let before = plugins.len();
    plugins.retain(|plugin| plugin.manifest.id != id);
    let removed = plugins.len() != before;
    if removed {
        write_registry(root, &plugins)?;
    }
    Ok(removed)
}

/// Seed the builtin plugins on first run, and refresh their manifests on later
/// runs. Idempotent for state: a plugin already present keeps its Enabled/
/// Disabled choice, source and original install time. But a host-shipped
/// builtin's MANIFEST is refreshed in place when the host's copy changed, so a
/// host upgrade (new permissions/interactions/version) reaches a registry that
/// an older build already seeded — without this, stale metadata (e.g. an old
/// permission set that no longer matches what the frontend `activate` needs)
/// would persist forever and silently break activation. Currently seeds only the
/// builtin Notes plugin, Enabled on first run.
///
/// This is the one place the host introduces a plugin by name, and it does so as
/// *data* — core consumers still read the registry, never this function.
pub fn seed_builtins(root: &Path) -> StoreResult<()> {
    let mut plugins = read_registry(root)?;
    let mut changed = false;
    for builtin in builtin_manifests() {
        if let Some(existing) = plugins
            .iter_mut()
            .find(|plugin| plugin.manifest.id == builtin.id)
        {
            if existing.source == PluginSource::Builtin {
                // Refresh a host-shipped builtin's manifest in place when it
                // drifted from the host's current copy. Compared by serialized
                // JSON to avoid a PartialEq bound on the manifest (it carries an
                // f32 rating). `write_registry` regenerates the lockfile from the
                // registry, so the `manifest_sha256` pin stays in sync with the
                // refreshed manifest.
                if serde_json::to_string(&existing.manifest).ok()
                    != serde_json::to_string(&builtin).ok()
                {
                    existing.manifest = builtin;
                    changed = true;
                }
                // Refresh trust to the first-party Builtin verdict. Registries
                // seeded by an older host build recorded Unsigned for the
                // builtin; correct that without touching the user's Enabled/
                // Disabled choice or its source/install timestamp.
                if existing.trust != TrustStatus::Builtin {
                    existing.trust = TrustStatus::Builtin;
                    changed = true;
                }
            }
            continue;
        }
        plugins.push(InstalledPlugin {
            manifest: builtin,
            state: PluginState::Enabled,
            source: PluginSource::Builtin,
            installed_at: Utc::now().to_rfc3339(),
            // A builtin ships with the host: there is no external package to
            // compromise and its provenance is the host build itself, so it gets
            // the first-party `Builtin` trust verdict rather than masquerading as
            // an `Unsigned` external package.
            trust: TrustStatus::Builtin,
        });
        changed = true;
    }
    if changed {
        write_registry(root, &plugins)?;
    }
    Ok(())
}

/// The manifests of host-shipped builtin plugins, constructed to mirror the
/// frontend builtin under `apps/web/src/plugins/builtin/notes/`.
fn builtin_manifests() -> Vec<PluginManifest> {
    vec![notes_builtin_manifest()]
}

/// Builtin Notes manifest. Mirrors the frontend builtin (id `notes`): a
/// pure-frontend plugin contributing a nav section + route and its own
/// namespaced storage, cooperating with global search.
fn notes_builtin_manifest() -> PluginManifest {
    PluginManifest {
        id: "notes".into(),
        title: "Notas".into(),
        short_description: "Notas rápidas em markdown".into(),
        long_description: String::new(),
        version: "1.0.0".into(),
        author: "PROJECTUS".into(),
        publisher: "projectus".into(),
        homepage: String::new(),
        repository: String::new(),
        license: "MIT".into(),
        icon: String::new(),
        screenshots: Vec::new(),
        changelog: String::new(),
        min_api_version: API_VERSION,
        api_version_range: ApiVersionRange::default(),
        frontend_entry: "index.js".into(),
        backend_entry: None,
        storage_schema_version: 1,
        migrations: Vec::new(),
        extension_points: vec!["nav-section".into(), "route".into(), "search-provider".into()],
        // These MUST cover every capability the frontend builtin's `activate(ctx)`
        // touches (apps/web/src/plugins/builtin/notes/index.ts): the frontend
        // `assertPermission` gate throws — and silently fails activation — if the
        // manifest the host built the context from is missing any of them. Notes
        // adds a nav item + screen (screens:add), a search provider (search:provide),
        // an archive integration (archive:create) and a quick-create shortcut
        // (shortcuts:register); it reads/writes notes (notes:read/notes:write) and
        // takes image attachments (attachments).
        permissions: vec![
            "notes:read".into(),
            "notes:write".into(),
            "screens:add".into(),
            "search:provide".into(),
            "shortcuts:register".into(),
            "archive:create".into(),
            "attachments".into(),
        ],
        // Must mirror the frontend builtin (apps/web/src/plugins/builtin/notes/
        // manifest.ts): a single quick-create shortcut on `mod+n`. The Plugin
        // Details view reads this backend manifest, so it must not drift from the
        // shortcut the runtime actually registers.
        shortcuts: vec![Shortcut {
            id: "quick-create".into(),
            keys: "mod+n".into(),
            description: "Nova nota".into(),
        }],
        commands: Vec::new(),
        interacts_with: vec![
            "MARKDOWN_EDITOR".into(),
            "SIDE_NAVIGATION".into(),
            "GLOBAL_SEARCH".into(),
            "ARCHIVE".into(),
            "FILE_STORAGE".into(),
        ],
        conflicts: Vec::new(),
        integrity: IntegrityMeta::default(),
        signature: None,
        marketplace: Default::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// A scratch storage root with `plugins/` created, mirroring what
    /// `Storage::initialize` does before the registry is touched.
    fn scratch() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(plugins_dir(dir.path())).unwrap();
        dir
    }

    /// A minimal external (zip-sourced) plugin record for state-transition tests.
    fn sample_plugin(id: &str, trust: TrustStatus) -> InstalledPlugin {
        let mut manifest = notes_builtin_manifest();
        manifest.id = id.into();
        manifest.title = id.into();
        InstalledPlugin {
            manifest,
            state: PluginState::Disabled,
            source: PluginSource::Zip,
            installed_at: Utc::now().to_rfc3339(),
            trust,
        }
    }

    #[test]
    fn seed_builtins_seeds_notes_enabled() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();

        let plugins = list(dir.path()).unwrap();
        assert_eq!(plugins.len(), 1);
        let notes = &plugins[0];
        assert_eq!(notes.manifest.id, "notes");
        assert_eq!(notes.state, PluginState::Enabled);
        assert_eq!(notes.source, PluginSource::Builtin);
        // A host-shipped builtin carries the first-party trust verdict, not the
        // external-package `Unsigned` state.
        assert_eq!(notes.trust, TrustStatus::Builtin);
        // The seeded builtin must itself be a valid manifest.
        notes.manifest.validate().expect("builtin must validate");
    }

    #[test]
    fn seed_builtins_writes_registry_and_lock_files() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();

        assert!(registry_path(dir.path()).exists(), "registry.json missing");
        assert!(lock_path(dir.path()).exists(), "installed.lock.json missing");

        let lock = lock_entries(dir.path()).unwrap();
        assert_eq!(lock.len(), 1);
        assert_eq!(lock[0].id, "notes");
        assert_eq!(lock[0].version, "1.0.0");
        // No source package for a builtin, but the manifest digest is pinned.
        assert!(!lock[0].manifest_sha256.is_empty());
    }

    #[test]
    fn seed_builtins_is_idempotent_and_preserves_user_state() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();

        // Simulate the user disabling the builtin.
        set_state(dir.path(), "notes", PluginState::Disabled).unwrap();

        // Re-running seed must not resurrect it to Enabled, nor duplicate it.
        seed_builtins(dir.path()).unwrap();

        let plugins = list(dir.path()).unwrap();
        assert_eq!(plugins.len(), 1, "builtin duplicated on re-seed");
        assert_eq!(plugins[0].state, PluginState::Disabled);
    }

    #[test]
    fn seed_builtins_refreshes_a_stale_builtin_manifest_preserving_state() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();

        // Simulate a registry seeded by an OLDER host build: a Notes builtin whose
        // manifest carries a stale permission set (the pre-alignment vocabulary),
        // a stale `Unsigned` trust verdict, and which the user had disabled.
        let mut plugins = read_registry(dir.path()).unwrap();
        plugins[0].manifest.permissions = vec!["storage-read".into()];
        plugins[0].manifest.version = "0.9.0".into();
        plugins[0].state = PluginState::Disabled;
        plugins[0].trust = TrustStatus::Unsigned;
        write_registry(dir.path(), &plugins).unwrap();

        // Re-seeding must refresh the manifest to the host's current copy and
        // upgrade trust to the first-party `Builtin` verdict, while keeping the
        // user's Disabled choice.
        seed_builtins(dir.path()).unwrap();

        let after = list(dir.path()).unwrap();
        assert_eq!(after.len(), 1, "builtin duplicated on refresh");
        let notes = &after[0];
        assert_eq!(notes.state, PluginState::Disabled, "user state must be kept");
        assert_eq!(notes.manifest.version, "1.0.0", "version refreshed");
        assert_eq!(
            notes.trust,
            TrustStatus::Builtin,
            "stale Unsigned trust must be refreshed to Builtin",
        );
        assert!(
            notes.manifest.permissions.contains(&"screens:add".to_owned()),
            "stale permissions must be refreshed to the current vocabulary",
        );
        // The refreshed manifest must still be valid against the host vocabulary.
        notes.manifest.validate().expect("refreshed builtin must validate");
    }

    #[test]
    fn seed_builtins_refreshes_trust_even_when_manifest_is_current() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();

        // Simulate the trust-only drift: a registry seeded before the Builtin
        // trust state existed, so the manifest is already current but the trust
        // verdict is the old `Unsigned`. The user had it disabled.
        let mut plugins = read_registry(dir.path()).unwrap();
        plugins[0].trust = TrustStatus::Unsigned;
        plugins[0].state = PluginState::Disabled;
        write_registry(dir.path(), &plugins).unwrap();

        seed_builtins(dir.path()).unwrap();

        let after = list(dir.path()).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].trust, TrustStatus::Builtin, "trust upgraded");
        assert_eq!(after[0].state, PluginState::Disabled, "user state kept");
    }

    #[test]
    fn set_state_allows_enabling_a_builtin() {
        let dir = scratch();
        seed_builtins(dir.path()).unwrap();
        set_state(dir.path(), "notes", PluginState::Disabled).unwrap();

        // A first-party `Builtin` trust verdict must not block activation.
        let enabled = set_state(dir.path(), "notes", PluginState::Enabled).unwrap();
        assert_eq!(enabled.trust, TrustStatus::Builtin);
        assert_eq!(enabled.state, PluginState::Enabled);
    }

    #[test]
    fn upsert_get_and_list_round_trip() {
        let dir = scratch();
        upsert(dir.path(), sample_plugin("alpha", TrustStatus::Unsigned)).unwrap();
        upsert(dir.path(), sample_plugin("beta", TrustStatus::Unsigned)).unwrap();

        assert_eq!(list(dir.path()).unwrap().len(), 2);
        assert_eq!(get(dir.path(), "beta").unwrap().manifest.id, "beta");
        assert!(matches!(
            get(dir.path(), "missing"),
            Err(StoreError::NotFound)
        ));
    }

    #[test]
    fn upsert_replaces_in_place_and_preserves_installed_at() {
        let dir = scratch();
        let first = upsert(dir.path(), sample_plugin("alpha", TrustStatus::Unsigned)).unwrap();

        // Reinstall a newer version with a later timestamp.
        let mut upgrade = sample_plugin("alpha", TrustStatus::Unsigned);
        upgrade.manifest.version = "2.0.0".into();
        upgrade.installed_at = "2099-01-01T00:00:00+00:00".into();
        let replaced = upsert(dir.path(), upgrade).unwrap();

        let plugins = list(dir.path()).unwrap();
        assert_eq!(plugins.len(), 1, "reinstall must not duplicate");
        assert_eq!(replaced.manifest.version, "2.0.0");
        // First-install timestamp is preserved, not overwritten by the upgrade.
        assert_eq!(replaced.installed_at, first.installed_at);
    }

    #[test]
    fn set_state_enable_disable_transitions() {
        let dir = scratch();
        upsert(dir.path(), sample_plugin("alpha", TrustStatus::Unsigned)).unwrap();

        let enabled = set_state(dir.path(), "alpha", PluginState::Enabled).unwrap();
        assert_eq!(enabled.state, PluginState::Enabled);
        assert_eq!(get(dir.path(), "alpha").unwrap().state, PluginState::Enabled);

        let disabled = set_state(dir.path(), "alpha", PluginState::Disabled).unwrap();
        assert_eq!(disabled.state, PluginState::Disabled);
        assert_eq!(
            get(dir.path(), "alpha").unwrap().state,
            PluginState::Disabled
        );
    }

    #[test]
    fn set_state_blocks_enabling_a_mismatched_plugin() {
        let dir = scratch();
        upsert(dir.path(), sample_plugin("tampered", TrustStatus::Mismatch)).unwrap();

        // Enabling a tampered plugin is refused.
        assert!(matches!(
            set_state(dir.path(), "tampered", PluginState::Enabled),
            Err(StoreError::Validation(_))
        ));
        // It stays Disabled.
        assert_eq!(
            get(dir.path(), "tampered").unwrap().state,
            PluginState::Disabled
        );
        // Disabling a mismatched plugin is still allowed (it is a no-op here but
        // must not error).
        set_state(dir.path(), "tampered", PluginState::Disabled).unwrap();
    }

    #[test]
    fn set_state_on_missing_plugin_is_not_found() {
        let dir = scratch();
        assert!(matches!(
            set_state(dir.path(), "ghost", PluginState::Enabled),
            Err(StoreError::NotFound)
        ));
    }

    #[test]
    fn remove_drops_registry_and_lock_records() {
        let dir = scratch();
        upsert(dir.path(), sample_plugin("alpha", TrustStatus::Unsigned)).unwrap();
        upsert(dir.path(), sample_plugin("beta", TrustStatus::Unsigned)).unwrap();

        assert!(remove(dir.path(), "alpha").unwrap());
        let plugins = list(dir.path()).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].manifest.id, "beta");

        // The lockfile is regenerated in lockstep with the registry.
        let lock = lock_entries(dir.path()).unwrap();
        assert_eq!(lock.len(), 1);
        assert_eq!(lock[0].id, "beta");

        // Removing again is a no-op that reports nothing was removed.
        assert!(!remove(dir.path(), "alpha").unwrap());
    }

    #[test]
    fn list_on_fresh_root_is_empty_not_error() {
        let dir = scratch();
        assert!(list(dir.path()).unwrap().is_empty());
        assert!(lock_entries(dir.path()).unwrap().is_empty());
    }
}
