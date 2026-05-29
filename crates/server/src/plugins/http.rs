//! The `/api/plugins` HTTP surface: marketplace/registry listing, install
//! pipelines (zip upload + url), enable/disable/uninstall lifecycle, the
//! integrity `verify` endpoint, the namespaced plugin data CRUD, and static
//! asset serving of each installed plugin's extracted tree.
//!
//! Core stays plugin-agnostic: this router speaks only the generic plugin
//! contract (manifests, ids, collections) and never names a specific plugin. All
//! durable writes go through `Storage` (data CRUD) or the registry free
//! functions, keeping the backend the sole writer.

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Multipart, Path, State},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_http::services::ServeDir;

use crate::http::{ApiError, AppState};
use crate::storage::StoreError;

use super::install::{self, InstallUrlRequest};
use super::registry::{self, InstalledPlugin, LockEntry, PluginState};
use super::signing::{self, TrustStatus};
use super::storage::PluginData;

/// Folder (under the storage root) that holds the whole plugin subsystem on disk.
const PLUGINS_DIR: &str = "plugins";
/// Generous body cap for an uploaded plugin package (frontend + assets).
const MAX_PACKAGE_BYTES: usize = 64 * 1024 * 1024;

/// Build the `/api/plugins` router. The host nests this under `/api/plugins`, so
/// the routes below are relative to that prefix.
///
/// The static-asset `ServeDir` is nested at the router root so any path that does
/// not match an API route (i.e. `/<id>/<version>/<file>`) is served from the
/// on-disk `plugins/` tree. The concrete API routes take precedence over it.
pub fn router(state: AppState) -> Router {
    let assets = ServeDir::new(state.storage.root().join(PLUGINS_DIR));
    Router::new()
        .route("/", get(list_plugins))
        .route("/install", post(install_zip))
        .route("/install-url", post(install_url))
        .route("/{id}/enable", post(enable_plugin))
        .route("/{id}/disable", post(disable_plugin))
        .route("/{id}/verify", get(verify_plugin))
        .route("/{id}/data/{collection}", get(read_data).put(write_data))
        .route("/{id}/data", delete(delete_data))
        .route("/{id}", delete(uninstall_plugin))
        .layer(DefaultBodyLimit::max(MAX_PACKAGE_BYTES))
        .with_state(state)
        // Fallback: serve each plugin's extracted tree as static assets. Concrete
        // routes above win; only unmatched `/<id>/<version>/<file>` paths fall
        // through to disk. registry.json / installed.lock.json live at the
        // plugins/ root and are reachable only via the API, not as bare files,
        // because every first path segment that is an installed id is shadowed by
        // the `/{id}` API routes for the verbs they define.
        .fallback_service(assets)
}

/// `GET /api/plugins` — the full installed-plugin list with lockfile pins folded
/// in, so the marketplace UI gets registry detail + integrity state in one shot.
async fn list_plugins(State(state): State<AppState>) -> Result<Json<PluginListResponse>, ApiError> {
    let root = state.storage.root();
    let plugins = registry::list(root)?;
    let lock = registry::lock_entries(root)?;
    let itens = plugins
        .into_iter()
        .map(|plugin| {
            let lock = lock.iter().find(|entry| entry.id == plugin.id()).cloned();
            PluginListItem { plugin, lock }
        })
        .collect();
    Ok(Json(PluginListResponse { plugins: itens }))
}

/// `POST /api/plugins/install` — multipart upload of a `.zip` package. The
/// optional `allow_unsigned` form field (truthy values: `true`/`1`) admits an
/// unsigned-but-integrity-valid package.
async fn install_zip(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<InstalledPlugin>, ApiError> {
    let mut package: Option<Vec<u8>> = None;
    let mut allow_unsigned = false;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::bad_request(err.to_string()))?
    {
        match field.name() {
            Some("allow_unsigned") => {
                let value = field
                    .text()
                    .await
                    .map_err(|err| ApiError::bad_request(err.to_string()))?;
                allow_unsigned = matches!(value.trim(), "true" | "1" | "on" | "yes");
            }
            // Any binary field is treated as the package payload.
            _ => {
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|err| ApiError::bad_request(err.to_string()))?;
                package = Some(bytes.to_vec());
            }
        }
    }

    let bytes = package
        .ok_or_else(|| ApiError::bad_request("nenhum pacote .zip recebido".to_owned()))?;
    let installed = install::install_from_zip(state.storage.root(), bytes, allow_unsigned).await?;
    state.storage.emit("plugin_instalado", "plugin", installed.id());
    Ok(Json(installed))
}

/// `POST /api/plugins/install-url` — download + install from a URL. Body:
/// `{ "url": "...", "allow_unsigned": false }`.
async fn install_url(
    State(state): State<AppState>,
    Json(input): Json<InstallUrlRequest>,
) -> Result<Json<InstalledPlugin>, ApiError> {
    let installed =
        install::install_from_url(state.storage.root(), &input.url, input.allow_unsigned).await?;
    state.storage.emit("plugin_instalado", "plugin", installed.id());
    Ok(Json(installed))
}

/// `POST /api/plugins/{id}/enable` — activate a plugin. Refused on `Mismatch`
/// (the registry guard returns `Validation`).
async fn enable_plugin(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<InstalledPlugin>, ApiError> {
    let updated = registry::set_state(state.storage.root(), &id, PluginState::Enabled)?;
    state.storage.emit("plugin_ativado", "plugin", &id);
    Ok(Json(updated))
}

/// `POST /api/plugins/{id}/disable` — deactivate a plugin (always allowed).
async fn disable_plugin(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<InstalledPlugin>, ApiError> {
    let updated = registry::set_state(state.storage.root(), &id, PluginState::Disabled)?;
    state.storage.emit("plugin_desativado", "plugin", &id);
    Ok(Json(updated))
}

/// `DELETE /api/plugins/{id}` — uninstall, keeping the plugin's data. Removes the
/// registry/lock record and the extracted tree under `plugins/<id>/`, but leaves
/// `plugins/<id>/data/` intact so a reinstall can recover it. A purge is a
/// separate, explicit `DELETE /{id}/data` call.
async fn uninstall_plugin(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiMessage>, ApiError> {
    let removed = registry::remove(state.storage.root(), &id)?;
    if !removed {
        return Err(StoreError::NotFound.into());
    }
    remove_plugin_tree_keep_data(state.storage.root(), &id)?;
    state.storage.emit("plugin_desinstalado", "plugin", &id);
    Ok(Json(ApiMessage {
        mensagem: "plugin desinstalado; dados preservados".to_owned(),
    }))
}

/// `DELETE /api/plugins/{id}/data` — explicit purge of a plugin's data sandbox.
/// Independent of uninstall; the plugin record (if any) is untouched.
async fn delete_data(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiMessage>, ApiError> {
    let removed = state.storage.purge_plugin_data(&id)?;
    Ok(Json(ApiMessage {
        mensagem: if removed {
            "dados do plugin removidos".to_owned()
        } else {
            "nenhum dado de plugin para remover".to_owned()
        },
    }))
}

/// `GET /api/plugins/{id}/verify` — recompute integrity against the lockfile pin
/// (and re-check the signature) so the UI can flag tampering after install.
async fn verify_plugin(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<VerifyResponse>, ApiError> {
    let root = state.storage.root();
    let plugin = registry::get(root, &id)?;
    let lock = registry::lock_entry(root, &id)?;

    // Recompute the package digest over the bytes currently on disk: re-hash the
    // extracted tree's manifest as the anchor we always have, then layer the
    // signature verdict. (The original .zip is not retained, so we verify against
    // the manifest digest pin rather than the package digest.)
    let manifest_path = root
        .join(PLUGINS_DIR)
        .join(&plugin.manifest.id)
        .join(&plugin.manifest.version)
        .join("manifest.json");

    let trust = match std::fs::read(&manifest_path) {
        Ok(manifest_bytes) => verdict_for(&manifest_bytes, &lock, &plugin),
        // The tree is gone (e.g. builtin with no extracted package, or a
        // tampered/removed file): fall back to the recorded verdict.
        Err(_) => lock.verified,
    };

    Ok(Json(VerifyResponse {
        id: plugin.manifest.id.clone(),
        trust,
        recorded: lock.verified,
        matches: trust == lock.verified,
    }))
}

/// Derive a fresh trust verdict for a plugin from its on-disk manifest bytes,
/// the lockfile pin, and the recorded signature.
fn verdict_for(manifest_bytes: &[u8], lock: &LockEntry, plugin: &InstalledPlugin) -> TrustStatus {
    // Integrity: the manifest digest must still match the pin.
    if !lock.manifest_sha256.trim().is_empty() {
        let actual = signing::sha256_hex(manifest_bytes);
        if !actual.eq_ignore_ascii_case(lock.manifest_sha256.trim()) {
            return TrustStatus::Mismatch;
        }
    }
    // Signature: if one was recorded, re-verify it; a bad one is fatal.
    if let Some(signature) = &plugin.manifest.signature {
        return signing::verify_signature(manifest_bytes, signature);
    }
    TrustStatus::Unsigned
}

/// `GET /api/plugins/{id}/data/{collection}` — read a plugin's data collection.
async fn read_data(
    State(state): State<AppState>,
    Path((id, collection)): Path<(String, String)>,
) -> Result<Json<PluginData>, ApiError> {
    Ok(Json(state.storage.plugin_data(&id, &collection)?))
}

/// `PUT /api/plugins/{id}/data/{collection}` — write a plugin's data collection
/// under optimistic concurrency. Body: `{ "revision": N, "items": <json> }`.
async fn write_data(
    State(state): State<AppState>,
    Path((id, collection)): Path<(String, String)>,
    Json(input): Json<WriteDataRequest>,
) -> Result<Json<PluginData>, ApiError> {
    Ok(Json(state.storage.write_plugin_data(
        &id,
        &collection,
        input.revision,
        input.items,
    )?))
}

/// Remove a plugin's extracted tree under `plugins/<id>/` while preserving its
/// `plugins/<id>/data/` sandbox. Removes each direct child of `plugins/<id>/`
/// except `data/`, then drops the now-empty parent if no data remains.
fn remove_plugin_tree_keep_data(root: &std::path::Path, id: &str) -> Result<(), ApiError> {
    let plugin_dir = root.join(PLUGINS_DIR).join(id);
    if !plugin_dir.exists() {
        return Ok(());
    }
    let mut kept_data = false;
    for entry in std::fs::read_dir(&plugin_dir).map_err(StoreError::from)? {
        let entry = entry.map_err(StoreError::from)?;
        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some("data") {
            kept_data = true;
            continue;
        }
        if path.is_dir() {
            std::fs::remove_dir_all(&path).map_err(StoreError::from)?;
        } else {
            std::fs::remove_file(&path).map_err(StoreError::from)?;
        }
    }
    // No data to preserve → drop the empty parent so an uninstall leaves no trace.
    if !kept_data {
        let _ = std::fs::remove_dir(&plugin_dir);
    }
    Ok(())
}

/// A generic message body, mirroring the host's `ApiMessage` shape.
#[derive(Debug, Serialize)]
struct ApiMessage {
    mensagem: String,
}

/// The list endpoint's response: each installed plugin paired with its lock pin.
#[derive(Debug, Serialize)]
struct PluginListResponse {
    plugins: Vec<PluginListItem>,
}

#[derive(Debug, Serialize)]
struct PluginListItem {
    #[serde(flatten)]
    plugin: InstalledPlugin,
    lock: Option<LockEntry>,
}

/// The verify endpoint's response: the freshly computed verdict vs. the recorded
/// one, plus whether they agree.
#[derive(Debug, Serialize)]
struct VerifyResponse {
    id: String,
    trust: TrustStatus,
    recorded: TrustStatus,
    matches: bool,
}

/// The data-write body.
#[derive(Debug, Deserialize)]
struct WriteDataRequest {
    revision: u64,
    #[serde(default)]
    items: Value,
}
