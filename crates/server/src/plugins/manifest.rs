//! Plugin manifest: the metadata document every installable plugin ships as
//! `manifest.json`. The struct mirrors the marketplace contract — rich metadata
//! plus integrity/signature blocks — and `validate()` is the single gate every
//! install path runs before a plugin is allowed near the registry.
//!
//! Core stays plugin-agnostic: nothing here names a specific plugin. The known
//! permission/extension/interaction vocabularies live as enums so a manifest can
//! only declare capabilities the host actually understands.

use serde::{Deserialize, Serialize};

use crate::domain::API_VERSION;

/// Result type local to manifest handling; carries a human-readable message in
/// the same spirit as `StoreError::Validation`.
pub type ManifestResult<T> = Result<T, ManifestError>;

/// A manifest validation failure. One variant on purpose — the message already
/// pinpoints the offending field — so callers can surface it verbatim.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("manifesto inválido: {0}")]
pub struct ManifestError(pub String);

impl ManifestError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

/// The full plugin manifest. Field names are English here (the plugin contract
/// is the marketplace-facing surface, not a PROJECTUS domain entity), but the
/// surrounding host data keeps its Portuguese identifiers untouched.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Slug identity, e.g. `notes`. Must match `[a-z0-9-]+`.
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub short_description: String,
    #[serde(default)]
    pub long_description: String,
    /// Semver-ish `MAJOR.MINOR.PATCH`.
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub publisher: String,
    #[serde(default)]
    pub homepage: String,
    #[serde(default)]
    pub repository: String,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub changelog: String,
    /// Lowest host API version this plugin tolerates.
    pub min_api_version: u32,
    #[serde(default)]
    pub api_version_range: ApiVersionRange,
    /// ESM entry the frontend dynamically imports (a URL/path served by the host).
    pub frontend_entry: String,
    /// Optional native/backend entry; `None` for pure-frontend plugins.
    #[serde(default)]
    pub backend_entry: Option<String>,
    #[serde(default)]
    pub storage_schema_version: u32,
    #[serde(default)]
    pub migrations: Vec<Migration>,
    #[serde(default)]
    pub extension_points: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub shortcuts: Vec<Shortcut>,
    #[serde(default)]
    pub commands: Vec<Command>,
    /// Other plugin ids this one cooperates with.
    #[serde(default)]
    pub interacts_with: Vec<String>,
    /// Other plugin ids this one cannot coexist with.
    #[serde(default)]
    pub conflicts: Vec<String>,
    #[serde(default)]
    pub integrity: IntegrityMeta,
    #[serde(default)]
    pub signature: Option<SignatureMeta>,
    #[serde(default)]
    pub marketplace: MarketplaceMeta,
}

/// Inclusive host-API compatibility window. Defaults to "this build only".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiVersionRange {
    pub min: u32,
    pub max: u32,
}

impl Default for ApiVersionRange {
    fn default() -> Self {
        Self {
            min: API_VERSION,
            max: API_VERSION,
        }
    }
}

/// A single declared storage migration step. The host runs these in order when
/// `storage_schema_version` advances.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub from: u32,
    pub to: u32,
    #[serde(default)]
    pub description: String,
}

/// A keyboard shortcut a plugin requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shortcut {
    pub id: String,
    /// Accelerator string, e.g. `mod+shift+n`.
    pub keys: String,
    #[serde(default)]
    pub description: String,
}

/// A command surfaced in the command palette / menus.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
}

/// Integrity block. SHA-256 is the mandatory algorithm; MD5 is never accepted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityMeta {
    #[serde(default)]
    pub package_sha256: String,
    #[serde(default)]
    pub manifest_sha256: String,
    #[serde(default = "default_integrity_algorithm")]
    pub algorithm: String,
}

impl Default for IntegrityMeta {
    fn default() -> Self {
        Self {
            package_sha256: String::new(),
            manifest_sha256: String::new(),
            algorithm: default_integrity_algorithm(),
        }
    }
}

fn default_integrity_algorithm() -> String {
    "sha256".to_owned()
}

/// Ed25519 signature block. Base64-encoded key + signature; the optional
/// `publisher_identity` is what a trust registry would be keyed on.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureMeta {
    #[serde(default = "default_signature_algorithm")]
    pub algorithm: String,
    pub public_key: String,
    pub signature: String,
    #[serde(default)]
    pub publisher_identity: String,
    #[serde(default)]
    pub verified_publisher: bool,
}

fn default_signature_algorithm() -> String {
    "ed25519".to_owned()
}

/// Marketplace-facing presentation metadata. Non-authoritative; the host's own
/// trust checks (SHA-256 + signature) decide what actually runs.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MarketplaceMeta {
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub verified: bool,
    #[serde(default)]
    pub featured: bool,
    #[serde(default)]
    pub downloads: u64,
    #[serde(default)]
    pub rating: f32,
}

/// Permissions the host knows how to grant. A manifest may only declare members
/// of this set; anything else fails `validate()`.
///
/// This vocabulary is the SINGLE source of truth shared with the frontend gate
/// (`apps/web/src/plugins/types/permissions.ts` / `permissions/checkPermission.ts`):
/// the backend `validate()` admits an external package only if every declared
/// permission is a member here, and the frontend `assertPermission` refuses any
/// capability whose gating permission the manifest did not declare. The two must
/// agree string-for-string, so the serde wire names below mirror `PermissionId`
/// exactly (colon-namespaced scopes, kebab-cased platform caps).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Permission {
    /// Read host Notes entities through the exposed notes API.
    #[serde(rename = "notes:read")]
    NotesRead,
    /// Create/update host Notes entities.
    #[serde(rename = "notes:write")]
    NotesWrite,
    /// Read host project entities.
    #[serde(rename = "projects:read")]
    ProjectsRead,
    /// Read host task entities.
    #[serde(rename = "tasks:read")]
    TasksRead,
    /// Contribute a routed screen + side-navigation entry.
    #[serde(rename = "screens:add")]
    ScreensAdd,
    /// Contribute a settings panel.
    #[serde(rename = "settings:add")]
    SettingsAdd,
    /// Register keyboard shortcuts through the host shortcut manager.
    #[serde(rename = "shortcuts:register")]
    ShortcutsRegister,
    /// Register command-palette commands.
    #[serde(rename = "commands:register")]
    CommandsRegister,
    /// Contribute a global-search results provider.
    #[serde(rename = "search:provide")]
    SearchProvide,
    /// Contribute editor nodes / transformers / slash + toolbar items.
    #[serde(rename = "editor:extend")]
    EditorExtend,
    /// Create entries in the host archive.
    #[serde(rename = "archive:create")]
    ArchiveCreate,
    /// Receive uploaded attachments / contribute an attachment endpoint.
    #[serde(rename = "attachments")]
    Attachments,
    /// Subscribe to the host live-event stream.
    #[serde(rename = "events")]
    Events,
    /// Make outbound network requests.
    #[serde(rename = "network")]
    Network,
    /// Read/write the plugin's own namespaced data store.
    #[serde(rename = "file:storage")]
    FileStorage,
    /// Store/read encrypted secrets in the host secret store.
    #[serde(rename = "secrets")]
    Secrets,
    /// Schedule background jobs / timers.
    #[serde(rename = "background-jobs")]
    BackgroundJobs,
}

impl Permission {
    /// Parse a manifest permission string against the known vocabulary.
    pub fn from_manifest(value: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::String(value.to_owned())).ok()
    }
}

/// Interaction targets the host recognises — the surfaces a plugin may declare
/// it cooperates with via `interacts_with`. Keeps cross-plugin coupling honest.
///
/// Mirrors the frontend `InteractionId` union
/// (`apps/web/src/plugins/types/interactions.ts`) string-for-string so a manifest
/// authored once validates on the backend and renders in the Plugin Manager's
/// `InteractionList` on the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Interaction {
    #[serde(rename = "MARKDOWN_EDITOR")]
    MarkdownEditor,
    #[serde(rename = "SIDE_NAVIGATION")]
    SideNavigation,
    #[serde(rename = "GLOBAL_SEARCH")]
    GlobalSearch,
    #[serde(rename = "SETTINGS")]
    Settings,
    #[serde(rename = "PROJECT_CARDS")]
    ProjectCards,
    #[serde(rename = "TASK_CARDS")]
    TaskCards,
    #[serde(rename = "TAGS")]
    Tags,
    #[serde(rename = "ARCHIVE")]
    Archive,
    #[serde(rename = "BACKUP")]
    Backup,
    #[serde(rename = "SECRETS")]
    Secrets,
    #[serde(rename = "NETWORK")]
    Network,
    #[serde(rename = "FILE_STORAGE")]
    FileStorage,
    #[serde(rename = "SHORTCUTS")]
    Shortcuts,
    #[serde(rename = "BACKGROUND_JOBS")]
    BackgroundJobs,
}

impl Interaction {
    /// Parse an `interacts_with` entry against the known vocabulary.
    pub fn from_manifest(value: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::String(value.to_owned())).ok()
    }
}

/// Extension points the host exposes for UI/behaviour contributions. A manifest
/// may only target points the host actually renders.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExtensionPoint {
    /// A left-rail navigation/section entry.
    NavSection,
    /// A standalone routed view.
    Route,
    /// A command-palette provider.
    CommandPalette,
    /// A global-search results provider.
    SearchProvider,
    /// A context-menu contribution on host entities.
    ContextMenu,
    /// A settings panel.
    SettingsPanel,
    /// A toolbar action.
    Toolbar,
    /// An editor toolbar/behaviour contribution.
    EditorToolbar,
}

impl ExtensionPoint {
    /// Parse an `extension_points` entry against the known vocabulary.
    pub fn from_manifest(value: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::String(value.to_owned())).ok()
    }
}

impl PluginManifest {
    /// Gate every install path runs before a plugin reaches the registry.
    ///
    /// Checks, in order: required fields are non-empty, `version` is semver-ish,
    /// `id` is a slug, the API-version range is sane and includes
    /// `min_api_version`, the integrity algorithm is SHA-256 (never MD5), and
    /// every declared permission / interaction / extension point is a member of
    /// the host's known vocabulary.
    pub fn validate(&self) -> ManifestResult<()> {
        require_field("id", &self.id)?;
        require_field("title", &self.title)?;
        require_field("version", &self.version)?;
        require_field("frontend_entry", &self.frontend_entry)?;

        if !is_slug(&self.id) {
            return Err(ManifestError::new(format!(
                "id '{}' deve conter apenas [a-z0-9-]",
                self.id
            )));
        }

        if !is_semver_ish(&self.version) {
            return Err(ManifestError::new(format!(
                "version '{}' deve ser MAJOR.MINOR.PATCH",
                self.version
            )));
        }

        let range = &self.api_version_range;
        if range.min > range.max {
            return Err(ManifestError::new(format!(
                "api_version_range inválido: min {} > max {}",
                range.min, range.max
            )));
        }
        if self.min_api_version > range.max {
            return Err(ManifestError::new(format!(
                "min_api_version {} acima de api_version_range.max {}",
                self.min_api_version, range.max
            )));
        }

        // SHA-256 is mandatory; MD5 (or anything else) is rejected outright.
        let algorithm = self.integrity.algorithm.to_ascii_lowercase();
        if algorithm != "sha256" {
            return Err(ManifestError::new(format!(
                "integrity.algorithm '{}' não suportado; use sha256",
                self.integrity.algorithm
            )));
        }

        for permission in &self.permissions {
            if Permission::from_manifest(permission).is_none() {
                return Err(ManifestError::new(format!(
                    "permissão desconhecida: '{permission}'"
                )));
            }
        }

        for target in &self.interacts_with {
            if Interaction::from_manifest(target).is_none() {
                return Err(ManifestError::new(format!(
                    "interação desconhecida: '{target}'"
                )));
            }
        }

        for point in &self.extension_points {
            if ExtensionPoint::from_manifest(point).is_none() {
                return Err(ManifestError::new(format!(
                    "extension point desconhecido: '{point}'"
                )));
            }
        }

        Ok(())
    }
}

fn require_field(name: &str, value: &str) -> ManifestResult<()> {
    if value.trim().is_empty() {
        Err(ManifestError::new(format!("campo obrigatório vazio: {name}")))
    } else {
        Ok(())
    }
}

/// `[a-z0-9-]+` with at least one character; mirrors the slug shape the host
/// uses for on-disk folder names.
fn is_slug(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Loose semver: three dot-separated numeric components, optional `-prerelease`
/// / `+build` suffix on the patch component.
fn is_semver_ish(value: &str) -> bool {
    let core = value
        .split_once('+')
        .map(|(left, _)| left)
        .unwrap_or(value);
    let core = core.split_once('-').map(|(left, _)| left).unwrap_or(core);
    let parts: Vec<&str> = core.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal manifest that passes `validate()`; tests mutate clones of it to
    /// exercise each failure path.
    fn valid_manifest() -> PluginManifest {
        PluginManifest {
            id: "notes".into(),
            title: "Notas".into(),
            short_description: "Notas rápidas".into(),
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
            extension_points: vec!["nav-section".into(), "route".into()],
            permissions: vec!["notes:read".into(), "screens:add".into()],
            shortcuts: Vec::new(),
            commands: Vec::new(),
            interacts_with: vec!["GLOBAL_SEARCH".into()],
            conflicts: Vec::new(),
            integrity: IntegrityMeta::default(),
            signature: None,
            marketplace: MarketplaceMeta::default(),
        }
    }

    #[test]
    fn accepts_a_well_formed_manifest() {
        valid_manifest().validate().expect("should be valid");
    }

    #[test]
    fn rejects_empty_required_field() {
        let mut manifest = valid_manifest();
        manifest.title = "  ".into();
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_non_slug_id() {
        let mut manifest = valid_manifest();
        manifest.id = "Notes Plugin".into();
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_bad_version() {
        let mut manifest = valid_manifest();
        manifest.version = "1.0".into();
        assert!(manifest.validate().is_err());
        manifest.version = "v1.0.0".into();
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn accepts_semver_with_prerelease_and_build() {
        let mut manifest = valid_manifest();
        manifest.version = "2.3.1-beta.1+build.5".into();
        manifest.validate().expect("prerelease/build should pass");
    }

    #[test]
    fn rejects_inverted_api_version_range() {
        let mut manifest = valid_manifest();
        manifest.api_version_range = ApiVersionRange { min: 9, max: 3 };
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_min_api_above_range_max() {
        let mut manifest = valid_manifest();
        manifest.api_version_range = ApiVersionRange { min: 1, max: 5 };
        manifest.min_api_version = 99;
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_non_sha256_integrity_algorithm() {
        let mut manifest = valid_manifest();
        manifest.integrity.algorithm = "md5".into();
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_unknown_permission() {
        let mut manifest = valid_manifest();
        manifest.permissions.push("launch-missiles".into());
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_unknown_interaction() {
        let mut manifest = valid_manifest();
        manifest.interacts_with.push("nonexistent-surface".into());
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn rejects_unknown_extension_point() {
        let mut manifest = valid_manifest();
        manifest.extension_points.push("mystery-point".into());
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn known_vocabularies_round_trip_from_strings() {
        assert_eq!(
            Permission::from_manifest("notes:read"),
            Some(Permission::NotesRead)
        );
        assert_eq!(
            Permission::from_manifest("screens:add"),
            Some(Permission::ScreensAdd)
        );
        assert_eq!(Permission::from_manifest("nope"), None);
        assert_eq!(
            Interaction::from_manifest("GLOBAL_SEARCH"),
            Some(Interaction::GlobalSearch)
        );
        assert_eq!(
            ExtensionPoint::from_manifest("command-palette"),
            Some(ExtensionPoint::CommandPalette)
        );
    }
}
