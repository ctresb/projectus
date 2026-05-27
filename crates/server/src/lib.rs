pub mod backup_r2;
pub mod daemon;
pub mod domain;
pub mod http;
pub mod lan;
pub mod platform;
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

pub const LOCAL_CONTROL_PORT: u16 = 4387;

pub async fn run() -> Result<()> {
    let storage = Arc::new(Storage::open_default()?);
    let config = storage.config()?;
    let local_address = format!("127.0.0.1:{LOCAL_CONTROL_PORT}");
    let published_address = format!("0.0.0.0:{}", config.porta);
    let (local_listener, lan_listener, bound_lan, bind_error) =
        if config.lan_exposto && config.porta == LOCAL_CONTROL_PORT {
            let listener = TcpListener::bind(&published_address)
                .await
                .with_context(|| format!("falha ao bind {published_address}"))?;
            (listener, None, true, None)
        } else {
            let listener = TcpListener::bind(&local_address)
                .await
                .with_context(|| format!("falha ao bind {local_address}"))?;
            if config.lan_exposto {
                match TcpListener::bind(&published_address).await {
                    Ok(published) => (listener, Some(published), true, None),
                    Err(err) => {
                        warn!(?err, "falha ao expor LAN; mantendo endpoint local");
                        (
                            listener,
                            None,
                            false,
                            Some(format!("não foi possível abrir {published_address}: {err}")),
                        )
                    }
                }
            } else {
                (listener, None, false, None)
            }
        };
    let backup = Arc::new(BackupService::new(storage.clone()));
    let lan_service = LanService::with_boot_state(bound_lan, bind_error);
    scheduler::spawn(storage.clone(), backup.clone());
    let state = AppState {
        storage: storage.clone(),
        backup,
        lan: lan_service.clone(),
    };
    let application = http::router(state);
    if let Some(listener) = lan_listener {
        let lan_application = application.clone();
        tokio::spawn(async move {
            if let Err(error) = axum::serve(listener, lan_application).await {
                warn!(?error, "listener LAN encerrou");
            }
        });
    }
    info!(
        local = %local_address,
        lan = bound_lan.then_some(published_address.as_str()).unwrap_or("desligada"),
        root = %storage.root().display(),
        "PROJECTUS pronto"
    );
    axum::serve(local_listener, application).await?;
    Ok(())
}
