pub mod backup_r2;
pub mod daemon;
pub mod domain;
pub mod http;
pub mod lan;
pub mod scheduler;
pub mod secrets;
pub mod storage;

use std::sync::Arc;

use anyhow::{Context, Result};
use backup_r2::BackupService;
use http::AppState;
use lan::LanService;
use storage::Storage;
use tokio::net::TcpListener;
use tracing::{info, warn};

pub async fn run() -> Result<()> {
    let storage = Arc::new(Storage::open_default()?);
    let config = storage.config()?;
    let host = if config.lan_exposto { "0.0.0.0" } else { "127.0.0.1" };
    let address = format!("{host}:{}", config.porta);
    // Tenta o host pedido; se LAN falhar (permissão de rede local, EADDRINUSE…), cai pra loopback
    // pra não derrubar o app inteiro e registra o erro pra UI exibir.
    let (listener, bound_lan, bind_error) = match TcpListener::bind(&address).await {
        Ok(l) => (l, config.lan_exposto, None),
        Err(err) if config.lan_exposto => {
            warn!(?err, "falha ao expor LAN, voltando a 127.0.0.1");
            let fallback = format!("127.0.0.1:{}", config.porta);
            let listener = TcpListener::bind(&fallback)
                .await
                .with_context(|| format!("falha ao bind {fallback}"))?;
            (
                listener,
                false,
                Some(format!("não foi possível abrir {address}: {err}")),
            )
        }
        Err(err) => return Err(err).with_context(|| format!("falha ao bind {address}")),
    };
    let backup = Arc::new(BackupService::new(storage.clone()));
    let lan_service = LanService::with_boot_state(bound_lan, bind_error);
    scheduler::spawn(storage.clone(), backup.clone());
    let state = AppState {
        storage: storage.clone(),
        backup,
        lan: lan_service.clone(),
    };
    info!(%address, root = %storage.root().display(), "PROJECTUS pronto");
    axum::serve(listener, http::router(state)).await?;
    Ok(())
}
