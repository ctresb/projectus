pub mod backup_r2;
pub mod daemon;
pub mod domain;
pub mod http;
pub mod scheduler;
pub mod secrets;
pub mod storage;

use std::sync::Arc;

use anyhow::Result;
use backup_r2::BackupService;
use http::AppState;
use storage::Storage;
use tokio::net::TcpListener;
use tracing::info;

pub async fn run() -> Result<()> {
    let storage = Arc::new(Storage::open_default()?);
    let config = storage.config()?;
    let address = format!("127.0.0.1:{}", config.porta);
    let listener = TcpListener::bind(&address).await?;
    let backup = Arc::new(BackupService::new(storage.clone()));
    scheduler::spawn(storage.clone(), backup.clone());
    info!(%address, root = %storage.root().display(), "PROJECTUS pronto");
    axum::serve(listener, http::router(AppState { storage, backup })).await?;
    Ok(())
}
