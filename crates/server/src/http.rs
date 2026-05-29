use std::{convert::Infallible, path::PathBuf, sync::Arc};

use async_stream::stream;
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::StatusCode,
    response::{
        IntoResponse, Sse,
        sse::{Event, KeepAlive},
    },
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::{
    backup_r2::BackupService,
    daemon,
    domain::*,
    lan::LanService,
    storage::{Storage, StoreError},
};

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<Storage>,
    pub backup: Arc<BackupService>,
    pub lan: Arc<LanService>,
}

#[derive(Debug, Serialize)]
struct ApiMessage {
    mensagem: String,
}

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    /// A `400 Bad Request` with a caller-supplied message. Used by the plugins
    /// router for malformed multipart uploads.
    pub fn bad_request(message: String) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(ApiMessage {
                mensagem: self.message,
            }),
        )
            .into_response()
    }
}

impl From<StoreError> for ApiError {
    fn from(error: StoreError) -> Self {
        let status = match error {
            StoreError::Conflict => StatusCode::CONFLICT,
            StoreError::NotFound => StatusCode::NOT_FOUND,
            StoreError::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        Self {
            status,
            message: error.to_string(),
        }
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(error: anyhow::Error) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            message: format!("{error:#}"),
        }
    }
}

pub fn router(state: AppState) -> Router {
    let root = state.storage.root().to_path_buf();
    let api = Router::new()
        .route("/health", get(health))
        .route("/bootstrap", get(bootstrap))
        .route("/config", get(config).put(update_config))
        .route("/history", get(history))
        .route("/events", get(events))
        .route("/archive", get(archive))
        .route("/archive/{id}", delete(delete_archived))
        .route("/archive/{id}/restore", post(restore_archived))
        .route("/projects", post(create_project))
        .route("/projects/move", post(move_project))
        .route("/projects/{id}/archive", post(archive_project))
        .route(
            "/projects/{id}",
            get(project).put(update_project).delete(delete_project),
        )
        .route("/projects/{id}/anexos", post(project_attachment))
        .route("/projects/{id}/tasks", post(create_task))
        .route("/projects/{project_id}/tasks/move", post(move_task))
        .route(
            "/projects/{project_id}/tasks/{task_id}/archive",
            post(archive_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}",
            get(task_markdown).put(update_task).delete(delete_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/anexos",
            post(task_attachment),
        )
        .route("/notes", get(notes).post(create_note))
        .route("/notes/{id}/archive", post(archive_note))
        .route(
            "/notes/{id}",
            get(note).put(update_note).delete(delete_note),
        )
        .route("/notes/{id}/anexos", post(note_attachment))
        .route("/backups", get(backup_history))
        .route(
            "/backups/credenciais",
            get(backup_credentials_status).post(backup_credentials),
        )
        .route("/backups/save", post(save_snapshot))
        .route("/backups/{id}/restore", post(restore_snapshot))
        .route("/daemon/status", get(daemon_status))
        .route("/daemon/instalar", post(daemon_install))
        .route("/daemon/reiniciar", post(daemon_restart))
        .route("/lan", get(lan_status).post(lan_toggle))
        .layer(DefaultBodyLimit::max(32 * 1024 * 1024))
        .with_state(state.clone());

    let mut application = Router::new()
        .nest("/api", api)
        .nest("/api/plugins", crate::plugins::http::router(state.clone()))
        .nest_service("/conteudo", ServeDir::new(root))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    if let Some(dist) = web_dist() {
        application = application.fallback_service(
            ServeDir::new(&dist).fallback(ServeFile::new(dist.join("index.html"))),
        );
    } else {
        application = application.route("/", get(no_frontend));
    }
    application
}

async fn health(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let config = state.storage.config()?;
    Ok(Json(
        serde_json::json!({
            "ok": true,
            "porta": config.porta,
            "porta_local": crate::LOCAL_CONTROL_PORT,
            "raiz": state.storage.root(),
            "server_version": env!("CARGO_PKG_VERSION"),
            "api_version": API_VERSION
        }),
    ))
}

async fn bootstrap(State(state): State<AppState>) -> Result<Json<Bootstrap>, ApiError> {
    Ok(Json(state.storage.bootstrap()?))
}

async fn config(State(state): State<AppState>) -> Result<Json<Config>, ApiError> {
    Ok(Json(state.storage.config()?))
}

async fn update_config(
    State(state): State<AppState>,
    Json(input): Json<Config>,
) -> Result<Json<Config>, ApiError> {
    let current = state.storage.config()?;
    let saved = state.storage.update_config(input)?;
    if saved.lan_exposto && current.porta != saved.porta {
        let _ = daemon::restart();
    }
    Ok(Json(saved))
}

async fn history(
    State(state): State<AppState>,
) -> Result<Json<crate::domain::HistoryLog>, ApiError> {
    Ok(Json(state.storage.history()?))
}

async fn archive(State(state): State<AppState>) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.archive()?))
}

async fn delete_archived(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.delete_archived(&id, query.revision)?))
}

#[derive(Deserialize)]
struct RevisionInput {
    revision: u64,
}

async fn restore_archived(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<RestoreArchive>,
) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.restore_archived(&id, input)?))
}

async fn project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DocumentResponse<Project>>, ApiError> {
    Ok(Json(state.storage.project(&id)?))
}

async fn create_project(
    State(state): State<AppState>,
    Json(input): Json<CreateProject>,
) -> Result<Json<DocumentResponse<Project>>, ApiError> {
    Ok(Json(state.storage.create_project(input)?))
}

async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<UpdateProject>,
) -> Result<Json<DocumentResponse<Project>>, ApiError> {
    Ok(Json(state.storage.update_project(&id, input)?))
}

#[derive(Deserialize)]
struct RevisionQuery {
    revision: u64,
}

async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<Board>, ApiError> {
    Ok(Json(state.storage.delete_project(&id, query.revision)?))
}

async fn archive_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<RevisionInput>,
) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.archive_project(&id, input.revision)?))
}

async fn move_project(
    State(state): State<AppState>,
    Json(input): Json<MoveItem>,
) -> Result<Json<Board>, ApiError> {
    Ok(Json(state.storage.move_project(input)?))
}

async fn create_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<CreateTask>,
) -> Result<Json<DocumentResponse<Project>>, ApiError> {
    Ok(Json(state.storage.create_task(&id, input)?))
}

async fn task_markdown(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(
        serde_json::json!({"markdown": state.storage.task_markdown(&project_id, &task_id)?}),
    ))
}

async fn update_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(String, String)>,
    Json(input): Json<UpdateTask>,
) -> Result<Json<Project>, ApiError> {
    Ok(Json(state.storage.update_task(
        &project_id,
        &task_id,
        input,
    )?))
}

async fn move_task(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(input): Json<MoveItem>,
) -> Result<Json<Project>, ApiError> {
    Ok(Json(state.storage.move_task(&project_id, input)?))
}

async fn delete_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(String, String)>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<Project>, ApiError> {
    Ok(Json(state.storage.delete_task(
        &project_id,
        &task_id,
        query.revision,
    )?))
}

async fn archive_task(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(String, String)>,
    Json(input): Json<RevisionInput>,
) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.archive_task(
        &project_id,
        &task_id,
        input.revision,
    )?))
}

async fn notes(State(state): State<AppState>) -> Result<Json<NotesIndex>, ApiError> {
    Ok(Json(state.storage.notes()?))
}

async fn note(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DocumentResponse<Note>>, ApiError> {
    Ok(Json(state.storage.note(&id)?))
}

async fn create_note(
    State(state): State<AppState>,
    Json(input): Json<CreateNote>,
) -> Result<Json<DocumentResponse<Note>>, ApiError> {
    Ok(Json(state.storage.create_note(input)?))
}

async fn update_note(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<UpdateNote>,
) -> Result<Json<DocumentResponse<Note>>, ApiError> {
    Ok(Json(state.storage.update_note(&id, input)?))
}

async fn delete_note(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<NotesIndex>, ApiError> {
    Ok(Json(state.storage.delete_note(&id, query.revision)?))
}

async fn archive_note(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<RevisionInput>,
) -> Result<Json<ArchiveIndex>, ApiError> {
    Ok(Json(state.storage.archive_note(&id, input.revision)?))
}

async fn project_attachment(
    State(state): State<AppState>,
    Path(id): Path<String>,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (name, bytes) = image_from_multipart(multipart).await?;
    Ok(Json(
        serde_json::json!({"url": state.storage.save_project_attachment(&id, &name, &bytes)?}),
    ))
}

async fn task_attachment(
    State(state): State<AppState>,
    Path((project_id, task_id)): Path<(String, String)>,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (name, bytes) = image_from_multipart(multipart).await?;
    Ok(Json(
        serde_json::json!({"url": state.storage.save_task_attachment(&project_id, &task_id, &name, &bytes)?}),
    ))
}

async fn note_attachment(
    State(state): State<AppState>,
    Path(id): Path<String>,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (name, bytes) = image_from_multipart(multipart).await?;
    Ok(Json(
        serde_json::json!({"url": state.storage.save_note_attachment(&id, &name, &bytes)?}),
    ))
}

const MAX_IMAGE_DIM: u32 = 1600;
const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

async fn image_from_multipart(mut multipart: Multipart) -> Result<(String, Vec<u8>), ApiError> {
    while let Some(field) = multipart.next_field().await.map_err(bad_request)? {
        let content_type = field.content_type().unwrap_or_default().to_owned();
        if !content_type.starts_with("image/") {
            return Err(ApiError {
                status: StatusCode::UNPROCESSABLE_ENTITY,
                message: "somente imagens podem ser anexadas pelo editor".into(),
            });
        }
        let name = field.file_name().unwrap_or("imagem.png").to_owned();
        let raw = field.bytes().await.map_err(bad_request)?.to_vec();
        if raw.len() > MAX_IMAGE_BYTES {
            return Err(ApiError {
                status: StatusCode::PAYLOAD_TOO_LARGE,
                message: "imagem maior que 25 MB; reduza antes de enviar".into(),
            });
        }
        let (final_name, final_bytes) = downscale_if_huge(name, raw);
        return Ok((final_name, final_bytes));
    }
    Err(ApiError {
        status: StatusCode::BAD_REQUEST,
        message: "nenhuma imagem recebida".into(),
    })
}

/// Decode image; if either dim > MAX_IMAGE_DIM, downscale (Lanczos3) and re-encode as JPEG (quality 82) or PNG (if alpha).
/// On any decode failure, fall through and store original bytes.
fn downscale_if_huge(name: String, raw: Vec<u8>) -> (String, Vec<u8>) {
    let Ok(img) = image::load_from_memory(&raw) else {
        return (name, raw);
    };
    let (w, h) = (img.width(), img.height());
    if w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM {
        return (name, raw);
    }
    let resized = img.resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, image::imageops::FilterType::Lanczos3);
    let has_alpha = matches!(
        resized.color(),
        image::ColorType::La8 | image::ColorType::La16 | image::ColorType::Rgba8 | image::ColorType::Rgba16
    );
    let mut out = std::io::Cursor::new(Vec::new());
    let final_name = if has_alpha {
        if resized.write_to(&mut out, image::ImageFormat::Png).is_err() {
            return (name, raw);
        }
        swap_extension(&name, "png")
    } else {
        let rgb = resized.to_rgb8();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 82);
        if encoder.encode(&rgb, rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8).is_err() {
            return (name, raw);
        }
        swap_extension(&name, "jpg")
    };
    (final_name, out.into_inner())
}

fn swap_extension(name: &str, ext: &str) -> String {
    let stem = std::path::Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imagem");
    format!("{stem}.{ext}")
}

async fn backup_credentials(
    State(state): State<AppState>,
    Json(input): Json<BackupCredentials>,
) -> Result<Json<ApiMessage>, ApiError> {
    state.backup.save_credentials(input).await?;
    Ok(Json(ApiMessage {
        mensagem: "credenciais salvas no Keychain".into(),
    }))
}

async fn backup_credentials_status(
    State(state): State<AppState>,
) -> Result<Json<BackupCredentialStatus>, ApiError> {
    Ok(Json(state.backup.credentials_status()))
}

async fn backup_history(State(state): State<AppState>) -> Result<Json<RemoteHistory>, ApiError> {
    Ok(Json(state.backup.history().await?))
}

async fn save_snapshot(State(state): State<AppState>) -> Result<Json<SnapshotRecord>, ApiError> {
    Ok(Json(state.backup.snapshot(SnapshotOrigin::Manual).await?))
}

async fn restore_snapshot(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiMessage>, ApiError> {
    state.backup.restore(&id).await?;
    Ok(Json(ApiMessage {
        mensagem: "snapshot restaurado".into(),
    }))
}

async fn daemon_status() -> Result<Json<daemon::DaemonStatus>, ApiError> {
    Ok(Json(daemon::status().map_err(anyhow::Error::from)?))
}

async fn daemon_install() -> Result<Json<daemon::DaemonStatus>, ApiError> {
    Ok(Json(daemon::install().map_err(anyhow::Error::from)?))
}

async fn daemon_restart() -> Result<Json<daemon::DaemonStatus>, ApiError> {
    Ok(Json(daemon::restart().map_err(anyhow::Error::from)?))
}

async fn lan_status(State(state): State<AppState>) -> Result<Json<LanStatus>, ApiError> {
    let config = state.storage.config()?;
    Ok(Json(state.lan.status(config.porta, config.lan_exposto)))
}

async fn lan_toggle(
    State(state): State<AppState>,
    Json(input): Json<LanToggle>,
) -> Result<Json<LanStatus>, ApiError> {
    let saved = state.storage.set_lan_exposto(input.ativo)?;
    // Tenta reiniciar automaticamente quando o daemon está instalado; ignora se não está
    // (dev runs) — a UI mostra `precisa_reiniciar` e pede ação manual.
    let _ = daemon::restart();
    Ok(Json(state.lan.status(saved.porta, saved.lan_exposto)))
}

async fn events(
    State(state): State<AppState>,
) -> Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>> {
    let mut receiver = state.storage.subscribe();
    Sse::new(stream! {
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".into());
                    yield Ok(Event::default().event("mudanca").data(payload));
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    })
    .keep_alive(KeepAlive::default())
}

async fn no_frontend() -> &'static str {
    "projectus server em execução. compile apps/web ou informe PROJECTUS_WEB_DIST."
}

fn bad_request(error: axum::extract::multipart::MultipartError) -> ApiError {
    ApiError {
        status: StatusCode::BAD_REQUEST,
        message: error.to_string(),
    }
}

fn web_dist() -> Option<PathBuf> {
    let candidate = std::env::var_os("PROJECTUS_WEB_DIST")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/dist"));
    candidate.join("index.html").exists().then_some(candidate)
}
