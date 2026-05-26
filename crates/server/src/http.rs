use std::{convert::Infallible, path::PathBuf, sync::Arc};

use async_stream::stream;
use axum::{
    Json, Router,
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::{
        IntoResponse, Sse,
        sse::{Event, KeepAlive},
    },
    routing::{get, post},
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
    storage::{Storage, StoreError},
};

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<Storage>,
    pub backup: Arc<BackupService>,
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
            message: error.to_string(),
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
        .route("/projects", post(create_project))
        .route("/projects/move", post(move_project))
        .route(
            "/projects/{id}",
            get(project).put(update_project).delete(delete_project),
        )
        .route("/projects/{id}/anexos", post(project_attachment))
        .route("/projects/{id}/tasks", post(create_task))
        .route("/projects/{project_id}/tasks/move", post(move_task))
        .route(
            "/projects/{project_id}/tasks/{task_id}",
            get(task_markdown).put(update_task).delete(delete_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/anexos",
            post(task_attachment),
        )
        .route("/ideas", get(ideas).post(create_idea))
        .route(
            "/ideas/{id}",
            get(idea).put(update_idea).delete(delete_idea),
        )
        .route("/ideas/{id}/anexos", post(idea_attachment))
        .route("/backups", get(backup_history))
        .route(
            "/backups/credenciais",
            get(backup_credentials_status).post(backup_credentials),
        )
        .route("/backups/save", post(save_snapshot))
        .route("/backups/{id}/restore", post(restore_snapshot))
        .route("/daemon/status", get(daemon_status))
        .route("/daemon/instalar", post(daemon_install))
        .with_state(state.clone());

    let mut application = Router::new()
        .nest("/api", api)
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
        serde_json::json!({"ok": true, "porta": config.porta, "raiz": state.storage.root()}),
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
    Ok(Json(state.storage.update_config(input)?))
}

async fn history(
    State(state): State<AppState>,
) -> Result<Json<crate::domain::HistoryLog>, ApiError> {
    Ok(Json(state.storage.history()?))
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

async fn ideas(State(state): State<AppState>) -> Result<Json<IdeasIndex>, ApiError> {
    Ok(Json(state.storage.ideas()?))
}

async fn idea(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DocumentResponse<IdeaCard>>, ApiError> {
    Ok(Json(state.storage.idea(&id)?))
}

async fn create_idea(
    State(state): State<AppState>,
    Json(input): Json<CreateIdea>,
) -> Result<Json<DocumentResponse<IdeaCard>>, ApiError> {
    Ok(Json(state.storage.create_idea(input)?))
}

async fn update_idea(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(input): Json<UpdateIdea>,
) -> Result<Json<DocumentResponse<IdeaCard>>, ApiError> {
    Ok(Json(state.storage.update_idea(&id, input)?))
}

async fn delete_idea(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<RevisionQuery>,
) -> Result<Json<IdeasIndex>, ApiError> {
    Ok(Json(state.storage.delete_idea(&id, query.revision)?))
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

async fn idea_attachment(
    State(state): State<AppState>,
    Path(id): Path<String>,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (name, bytes) = image_from_multipart(multipart).await?;
    Ok(Json(
        serde_json::json!({"url": state.storage.save_idea_attachment(&id, &name, &bytes)?}),
    ))
}

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
        return Ok((name, field.bytes().await.map_err(bad_request)?.to_vec()));
    }
    Err(ApiError {
        status: StatusCode::BAD_REQUEST,
        message: "nenhuma imagem recebida".into(),
    })
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
