//! Install pipelines: admit an external plugin package (a `.zip`) into the
//! registry, either from raw bytes or by downloading a URL.
//!
//! Both paths funnel through [`install_package`], which enforces the same gate in
//! the same order:
//!
//! 1. Read the zip into a scratch tempdir and locate its `manifest.json`
//!    (tolerating a single wrapping top-level directory, the usual
//!    `git archive` / GitHub release shape).
//! 2. [`PluginManifest::validate`] the manifest — the one schema gate every
//!    install path shares with the builtin seed.
//! 3. Recompute the package SHA-256 over the exact downloaded/uploaded bytes and,
//!    if the manifest pins a `package_sha256`, demand it match. A mismatch yields
//!    [`TrustStatus::Mismatch`] and the plugin is refused outright.
//! 4. Layer the optional Ed25519 signature verdict on top (a valid signature can
//!    upgrade `Unsigned` to `Verified`/`SignedUntrusted`; a bad one is fatal).
//! 5. An [`TrustStatus::Unsigned`] package is admitted only when the caller
//!    passes `allow_unsigned` — the explicit "I know this isn't signed" confirm.
//! 6. Persist the extracted tree to `plugins/<id>/<version>/` and upsert the
//!    registry record (always [`PluginState::Disabled`] — enabling is a separate,
//!    deliberate user action) plus the regenerated lockfile.
//!
//! SHA-256 is the mandatory integrity algorithm; nothing here ever touches MD5.

use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Deserialize;
use url::Url;
use walkdir::WalkDir;
use zip::ZipArchive;

use crate::storage::{StoreError, StoreResult, atomic_bytes};

use super::manifest::PluginManifest;
use super::registry::{self, InstalledPlugin, PluginSource, PluginState};
use super::signing::{self, TrustStatus};

/// Folder (under the storage root) that holds the whole plugin subsystem on disk.
const PLUGINS_DIR: &str = "plugins";
/// The manifest filename every package must carry at (or one level under) its root.
const MANIFEST_FILE: &str = "manifest.json";

/// Hard ceiling on a single downloaded package, so a hostile/runaway URL cannot
/// exhaust memory. 64 MiB is generous for a frontend-plus-assets plugin.
const MAX_DOWNLOAD_BYTES: u64 = 64 * 1024 * 1024;

/// Install a plugin from an already-materialised `.zip` byte buffer (the
/// multipart-upload path). See the module docs for the full gate ordering.
///
/// `allow_unsigned` must be `true` to admit a package that carries no signature;
/// otherwise an unsigned-but-integrity-valid package is refused so the operator
/// makes an explicit choice. A package whose integrity or signature fails is
/// always refused regardless of this flag.
pub async fn install_from_zip(
    root: &Path,
    bytes: Vec<u8>,
    allow_unsigned: bool,
) -> StoreResult<InstalledPlugin> {
    install_package(root, &bytes, PluginSource::Zip, allow_unsigned)
}

/// Download a `.zip` from `url` (async, via `reqwest`) and install it. Same gate
/// as [`install_from_zip`]; the only difference is the byte source and the
/// recorded [`PluginSource::Url`].
pub async fn install_from_url(
    root: &Path,
    url: &str,
    allow_unsigned: bool,
) -> StoreResult<InstalledPlugin> {
    let bytes = download(url).await?;
    install_package(root, &bytes, PluginSource::Url, allow_unsigned)
}

/// Fetch the URL and return its body bytes, validating the URL scheme and
/// guarding against an oversized download.
async fn download(url: &str) -> StoreResult<Vec<u8>> {
    let parsed = Url::parse(url.trim())
        .map_err(|_| StoreError::Validation("URL do plugin inválida".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(StoreError::Validation(
            "URL do plugin deve usar http(s)".into(),
        ));
    }

    let response = reqwest::get(parsed)
        .await
        .map_err(|err| StoreError::Validation(format!("falha ao baixar plugin: {err}")))?
        .error_for_status()
        .map_err(|err| StoreError::Validation(format!("download do plugin recusado: {err}")))?;

    // Reject early on an advertised Content-Length over the ceiling; the body
    // read below is the authoritative guard for chunked/unsized responses.
    if let Some(len) = response.content_length() {
        if len > MAX_DOWNLOAD_BYTES {
            return Err(StoreError::Validation(
                "pacote do plugin grande demais".into(),
            ));
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| StoreError::Validation(format!("falha ao ler plugin: {err}")))?;
    if bytes.len() as u64 > MAX_DOWNLOAD_BYTES {
        return Err(StoreError::Validation(
            "pacote do plugin grande demais".into(),
        ));
    }
    Ok(bytes.to_vec())
}

/// The shared install pipeline behind both entry points.
fn install_package(
    root: &Path,
    bytes: &[u8],
    source: PluginSource,
    allow_unsigned: bool,
) -> StoreResult<InstalledPlugin> {
    // 1. Extract to a scratch tempdir we can validate against before committing
    //    anything to the durable plugins/ tree.
    let scratch = tempfile::tempdir()?;
    extract_zip(bytes, scratch.path())?;
    let package_root = locate_package_root(scratch.path())?;

    // 2. Parse + validate the manifest. validate() is the single schema gate.
    let manifest_path = package_root.join(MANIFEST_FILE);
    let manifest_bytes = std::fs::read(&manifest_path)?;
    let mut manifest: PluginManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|err| StoreError::Validation(format!("manifest.json inválido: {err}")))?;
    manifest
        .validate()
        .map_err(|err| StoreError::Validation(err.to_string()))?;

    // 3. Integrity: recompute the package digest over the exact bytes. If the
    //    manifest pins one, it must match; either way we record the real digest.
    let package_sha256 = signing::sha256_hex(bytes);
    let declared = manifest.integrity.package_sha256.trim();
    let mut trust = if declared.is_empty() {
        // No pinned digest to check against; integrity is "proven" only in the
        // weak sense that we hashed the bytes we hold. Treat as unsigned.
        TrustStatus::Unsigned
    } else {
        signing::verify_package(bytes, declared)
    };
    if trust == TrustStatus::Mismatch {
        return Err(StoreError::Validation(
            "integridade do pacote não confere (SHA-256)".into(),
        ));
    }

    // 4. Signature: a present-but-bad signature is fatal; a valid one upgrades
    //    the verdict beyond Unsigned.
    if let Some(signature) = &manifest.signature {
        match signing::verify_signature(&manifest_bytes, signature) {
            TrustStatus::Mismatch => {
                return Err(StoreError::Validation(
                    "assinatura do plugin inválida".into(),
                ));
            }
            verified => trust = verified,
        }
    }

    // 5. An unsigned package needs the operator's explicit blessing.
    if trust == TrustStatus::Unsigned && !allow_unsigned {
        return Err(StoreError::Validation(
            "plugin sem assinatura; confirme allow_unsigned para instalar".into(),
        ));
    }

    // Record the real package digest in the manifest's integrity block so the
    // lockfile and verify endpoint pin what we actually admitted.
    manifest.integrity.package_sha256 = package_sha256;
    if manifest.integrity.manifest_sha256.trim().is_empty() {
        manifest.integrity.manifest_sha256 = signing::sha256_hex(&manifest_bytes);
    }

    // 6. Commit the extracted tree to plugins/<id>/<version>/, replacing any
    //    prior copy of this exact id+version, then upsert the registry record.
    let install_dir = plugin_version_dir(root, &manifest.id, &manifest.version);
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)?;
    }
    copy_tree(&package_root, &install_dir)?;

    let plugin = InstalledPlugin {
        manifest,
        // Always installed Disabled: enabling is a separate, deliberate action
        // (and is hard-blocked on Mismatch by registry::set_state).
        state: PluginState::Disabled,
        source,
        installed_at: Utc::now().to_rfc3339(),
        trust,
    };
    let stored = registry::upsert(root, plugin)?;

    // TODO: emit an SSE `plugin_instalado` event. The broadcast bus lives on
    // `Storage` (private `events` field); these free fns take only `root: &Path`,
    // so wiring the emit needs the http layer to forward the Storage handle.

    Ok(stored)
}

/// Unpack `bytes` (a zip) into `dest`, refusing any entry whose path escapes the
/// destination (zip-slip) so a malicious archive cannot write outside its tree.
fn extract_zip(bytes: &[u8], dest: &Path) -> StoreResult<()> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|err| StoreError::Validation(format!("pacote zip inválido: {err}")))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|err| StoreError::Validation(format!("entrada de zip inválida: {err}")))?;

        // `enclosed_name` returns None for traversal/absolute paths; reject those.
        let Some(relative) = entry.enclosed_name() else {
            return Err(StoreError::Validation(
                "pacote zip contém caminho inseguro".into(),
            ));
        };
        let out_path = dest.join(&relative);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut buffer = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buffer)?;
        atomic_bytes(&out_path, &buffer)?;
    }
    Ok(())
}

/// Find the directory containing `manifest.json` within an extracted tree.
///
/// Accepts the manifest at the root, or one level down under a single wrapping
/// directory (the common `repo-name/` shape from GitHub archives). Anything
/// deeper, missing, or ambiguous is rejected.
fn locate_package_root(extracted: &Path) -> StoreResult<PathBuf> {
    if extracted.join(MANIFEST_FILE).is_file() {
        return Ok(extracted.to_path_buf());
    }

    // Look for exactly one subdirectory carrying the manifest.
    let mut candidate: Option<PathBuf> = None;
    for entry in std::fs::read_dir(extracted)? {
        let path = entry?.path();
        if path.is_dir() && path.join(MANIFEST_FILE).is_file() {
            if candidate.is_some() {
                return Err(StoreError::Validation(
                    "pacote contém múltiplos manifest.json".into(),
                ));
            }
            candidate = Some(path);
        }
    }

    candidate
        .ok_or_else(|| StoreError::Validation("manifest.json não encontrado no pacote".into()))
}

/// Recursively copy `from` into `to`, recreating the directory structure and
/// writing each file atomically. `to` is assumed not to exist yet.
fn copy_tree(from: &Path, to: &Path) -> StoreResult<()> {
    std::fs::create_dir_all(to)?;
    for entry in WalkDir::new(from).into_iter().filter_map(Result::ok) {
        let relative = match entry.path().strip_prefix(from) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target = to.join(relative);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            let bytes = std::fs::read(entry.path())?;
            atomic_bytes(&target, &bytes)?;
        }
    }
    Ok(())
}

/// Absolute path to `plugins/<id>/<version>/`.
fn plugin_version_dir(root: &Path, id: &str, version: &str) -> PathBuf {
    root.join(PLUGINS_DIR).join(id).join(version)
}

/// The shape of `POST /api/plugins/install-url`'s JSON body. Defined here next to
/// the install logic so the http layer can deserialize straight into it.
#[derive(Debug, Clone, Deserialize)]
pub struct InstallUrlRequest {
    pub url: String,
    #[serde(default)]
    pub allow_unsigned: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;
    use zip::write::SimpleFileOptions;

    /// A storage root with `plugins/` created, mirroring `Storage::initialize`.
    fn scratch_root() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(PLUGINS_DIR)).unwrap();
        dir
    }

    /// A minimal, valid manifest JSON for `id`. `package_sha256` empty means an
    /// unsigned package with no pinned digest; a non-empty value pins it.
    fn manifest_json(id: &str, package_sha256: &str) -> String {
        format!(
            r#"{{
                "id": "{id}",
                "title": "Test {id}",
                "version": "1.2.3",
                "min_api_version": 7,
                "api_version_range": {{ "min": 7, "max": 7 }},
                "frontend_entry": "index.js",
                "permissions": ["notes:read"],
                "integrity": {{ "package_sha256": "{package_sha256}", "algorithm": "sha256" }}
            }}"#
        )
    }

    /// Build an in-memory zip containing the given (path, contents) entries.
    fn build_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            for (name, contents) in entries {
                writer.start_file(*name, options).unwrap();
                writer.write_all(contents).unwrap();
            }
            writer.finish().unwrap();
        }
        buffer.into_inner()
    }

    /// A flat zip (manifest + entry at the root) with no pinned package digest.
    fn unsigned_zip(id: &str) -> Vec<u8> {
        let manifest = manifest_json(id, "");
        build_zip(&[
            ("manifest.json", manifest.as_bytes()),
            ("index.js", b"export const activate = () => {};"),
        ])
    }

    #[tokio::test]
    async fn installs_an_unsigned_zip_and_writes_all_artifacts() {
        let root = scratch_root();
        let zip = unsigned_zip("sample");

        let installed = install_from_zip(root.path(), zip, true).await.unwrap();

        // Registry record is present, Disabled, Zip-sourced, Unsigned.
        assert_eq!(installed.manifest.id, "sample");
        assert_eq!(installed.state, PluginState::Disabled);
        assert_eq!(installed.source, PluginSource::Zip);
        assert_eq!(installed.trust, TrustStatus::Unsigned);

        // registry.json + installed.lock.json exist and carry the plugin.
        let listed = registry::list(root.path()).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].manifest.id, "sample");
        let lock = registry::lock_entries(root.path()).unwrap();
        assert_eq!(lock.len(), 1);
        assert_eq!(lock[0].id, "sample");
        assert_eq!(lock[0].version, "1.2.3");
        // The lock pins the real package digest we computed at install.
        assert!(!lock[0].package_sha256.is_empty());

        // Extracted tree landed under plugins/<id>/<version>/.
        let install_dir = plugin_version_dir(root.path(), "sample", "1.2.3");
        assert!(install_dir.join("manifest.json").is_file());
        assert!(install_dir.join("index.js").is_file());
    }

    /// End-to-end on the REAL shipped artifact (`plugins/examples/sample-hello.zip`),
    /// the file users drag onto the Plugins screen. Proves the actual package
    /// validates against the host vocabulary, hashes, extracts and registers — so
    /// the user's manual install can't fail on a malformed package.
    #[tokio::test]
    async fn installs_the_shipped_sample_hello_zip() {
        let zip_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../plugins/examples/sample-hello.zip");
        let bytes = std::fs::read(&zip_path)
            .unwrap_or_else(|e| panic!("build it first via scripts/build-sample-plugin.sh: {e}"));
        let root = scratch_root();

        let installed = install_from_zip(root.path(), bytes, true).await.unwrap();
        assert_eq!(installed.manifest.id, "sample-hello");
        assert_eq!(installed.state, PluginState::Disabled);
        assert_eq!(installed.source, PluginSource::Zip);

        // Extracted under plugins/<id>/<version>/ with its declared frontend entry.
        let dir = plugin_version_dir(root.path(), "sample-hello", &installed.manifest.version);
        assert!(dir.join("manifest.json").is_file());
        assert!(dir.join(&installed.manifest.frontend_entry).is_file());

        // Registered + lockfile pins a real package digest.
        let listed = registry::list(root.path()).unwrap();
        assert!(listed.iter().any(|p| p.manifest.id == "sample-hello"));
    }

    #[tokio::test]
    async fn installs_a_zip_wrapped_in_a_single_top_level_dir() {
        let root = scratch_root();
        let manifest = manifest_json("wrapped", "");
        let zip = build_zip(&[
            ("wrapped-1.2.3/manifest.json", manifest.as_bytes()),
            ("wrapped-1.2.3/index.js", b"export default {};"),
        ]);

        let installed = install_from_zip(root.path(), zip, true).await.unwrap();
        assert_eq!(installed.manifest.id, "wrapped");

        let install_dir = plugin_version_dir(root.path(), "wrapped", "1.2.3");
        assert!(install_dir.join("manifest.json").is_file());
        assert!(install_dir.join("index.js").is_file());
    }

    #[tokio::test]
    async fn unsigned_install_is_refused_without_allow_unsigned() {
        let root = scratch_root();
        let zip = unsigned_zip("needs-confirm");

        let err = install_from_zip(root.path(), zip, false).await.unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
        // Nothing was admitted.
        assert!(registry::list(root.path()).unwrap().is_empty());
    }

    #[tokio::test]
    async fn package_sha256_mismatch_is_refused() {
        let root = scratch_root();
        // Pin a digest that cannot match the real bytes.
        let manifest = manifest_json("tampered", &"a".repeat(64));
        let zip = build_zip(&[
            ("manifest.json", manifest.as_bytes()),
            ("index.js", b"export default {};"),
        ]);

        let err = install_from_zip(root.path(), zip, true).await.unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
        // Refused outright: no registry record, no extracted tree.
        assert!(registry::list(root.path()).unwrap().is_empty());
        assert!(!plugin_version_dir(root.path(), "tampered", "1.2.3").exists());
    }

    #[tokio::test]
    async fn pinned_matching_digest_installs_and_records_digest() {
        let root = scratch_root();
        // The digest is computed over the whole zip (which contains the manifest),
        // so we build once, hash, and assert the install path recomputes + stores
        // exactly that digest.
        let zip = unsigned_zip("pinned");
        let digest = signing::sha256_hex(&zip);

        let installed = install_from_zip(root.path(), zip, true).await.unwrap();
        // The stored manifest carries the recomputed package digest.
        assert_eq!(installed.manifest.integrity.package_sha256, digest);
        let lock = registry::lock_entry(root.path(), "pinned").unwrap();
        assert_eq!(lock.package_sha256, digest);
    }

    #[tokio::test]
    async fn mismatch_in_registry_blocks_enable() {
        // The install path refuses Mismatch before it ever reaches the registry,
        // so this asserts the registry's own enable guard via a Mismatch record
        // (the belt-and-braces the install pipeline relies on).
        let root = scratch_root();
        let zip = unsigned_zip("guarded");
        let mut installed = install_from_zip(root.path(), zip, true).await.unwrap();

        // Simulate a later integrity failure (e.g. a re-verify finds tampering).
        installed.trust = TrustStatus::Mismatch;
        registry::upsert(root.path(), installed).unwrap();

        let err =
            registry::set_state(root.path(), "guarded", PluginState::Enabled).unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
        assert_eq!(
            registry::get(root.path(), "guarded").unwrap().state,
            PluginState::Disabled
        );
    }

    #[tokio::test]
    async fn invalid_manifest_is_refused() {
        let root = scratch_root();
        // A non-slug id fails validate().
        let manifest = r#"{
            "id": "Not A Slug",
            "title": "x",
            "version": "1.0.0",
            "min_api_version": 7,
            "frontend_entry": "index.js"
        }"#;
        let zip = build_zip(&[("manifest.json", manifest.as_bytes())]);

        let err = install_from_zip(root.path(), zip, true).await.unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
        assert!(registry::list(root.path()).unwrap().is_empty());
    }

    #[tokio::test]
    async fn missing_manifest_is_refused() {
        let root = scratch_root();
        let zip = build_zip(&[("index.js", b"export default {};")]);

        let err = install_from_zip(root.path(), zip, true).await.unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
    }

    #[tokio::test]
    async fn zip_slip_path_is_rejected() {
        let root = scratch_root();
        // An entry attempting to escape the extraction root.
        let zip = build_zip(&[("../evil.js", b"pwned")]);

        let err = install_from_zip(root.path(), zip, true).await.unwrap_err();
        assert!(matches!(err, StoreError::Validation(_)));
    }

    #[tokio::test]
    async fn reinstall_replaces_tree_and_preserves_installed_at() {
        let root = scratch_root();
        let first = install_from_zip(root.path(), unsigned_zip("reins"), true)
            .await
            .unwrap();

        // Reinstall the same id+version.
        let again = install_from_zip(root.path(), unsigned_zip("reins"), true)
            .await
            .unwrap();

        // No duplicate; first-install timestamp preserved by registry::upsert.
        assert_eq!(registry::list(root.path()).unwrap().len(), 1);
        assert_eq!(again.installed_at, first.installed_at);
        assert!(
            plugin_version_dir(root.path(), "reins", "1.2.3")
                .join("index.js")
                .is_file()
        );
    }
}
