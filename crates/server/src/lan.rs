//! Optional secondary HTTP listener bound to 0.0.0.0 so other devices on the LAN
//! (phone, tablet, another laptop on the same Wi-Fi) can open the web frontend.
//!
//! The primary 127.0.0.1 listener stays untouched. Toggling LAN exposure spins up
//! or shuts down this second listener at runtime — no restart required.

use std::{
    net::{IpAddr, Ipv4Addr},
    sync::Arc,
};

use axum::Router;
use tokio::{
    net::TcpListener,
    sync::{Mutex, oneshot},
    task::JoinHandle,
};
use tracing::{info, warn};

use crate::{domain::LanStatus, http::AppState};

/// Holds the running LAN listener handle (if any) so we can shut it down on toggle.
#[derive(Default)]
pub struct LanService {
    inner: Mutex<Option<RunningLan>>,
    last_error: Mutex<Option<String>>,
}

struct RunningLan {
    shutdown: oneshot::Sender<()>,
    handle: JoinHandle<()>,
    porta: u16,
}

impl LanService {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub async fn is_active(&self) -> bool {
        self.inner.lock().await.is_some()
    }

    pub async fn status(&self, porta: u16) -> LanStatus {
        let guard = self.inner.lock().await;
        let ativo = guard.is_some();
        let porta_real = guard.as_ref().map(|r| r.porta).unwrap_or(porta);
        drop(guard);
        let erro = self.last_error.lock().await.clone();
        LanStatus {
            ativo,
            porta: porta_real,
            urls: lan_urls(porta_real),
            erro,
        }
    }

    /// Spawn the LAN listener using a clone of the existing router state.
    /// If it's already running on the same port, no-op.
    pub async fn enable(&self, porta: u16, router_factory: impl FnOnce() -> Router) -> Result<(), String> {
        let mut guard = self.inner.lock().await;
        if let Some(running) = guard.as_ref() {
            if running.porta == porta {
                return Ok(());
            }
        }
        // Replace any previous instance.
        if let Some(prev) = guard.take() {
            let _ = prev.shutdown.send(());
            let _ = prev.handle.await;
        }
        let listener = match TcpListener::bind(("0.0.0.0", porta)).await {
            Ok(l) => l,
            Err(err) => {
                let msg = format!("não foi possível abrir porta {porta} na LAN: {err}");
                *self.last_error.lock().await = Some(msg.clone());
                return Err(msg);
            }
        };
        let (tx, rx) = oneshot::channel();
        let app = router_factory();
        let handle = tokio::spawn(async move {
            let shutdown = async move {
                let _ = rx.await;
            };
            if let Err(err) = axum::serve(listener, app)
                .with_graceful_shutdown(shutdown)
                .await
            {
                warn!(?err, "listener LAN encerrou com erro");
            }
        });
        info!(porta, "LAN exposta em 0.0.0.0");
        *guard = Some(RunningLan {
            shutdown: tx,
            handle,
            porta,
        });
        *self.last_error.lock().await = None;
        Ok(())
    }

    pub async fn disable(&self) {
        let mut guard = self.inner.lock().await;
        if let Some(running) = guard.take() {
            let _ = running.shutdown.send(());
            let _ = running.handle.await;
            info!(porta = running.porta, "LAN encerrada");
        }
    }
}

/// Best-effort: enumerate non-loopback IPv4 addresses and build URLs.
pub fn lan_urls(porta: u16) -> Vec<String> {
    match if_addrs::get_if_addrs() {
        Ok(list) => list
            .into_iter()
            .filter(|i| !i.is_loopback())
            .filter_map(|i| match i.ip() {
                IpAddr::V4(v4) if !v4.is_link_local() && !v4.is_unspecified() && v4 != Ipv4Addr::BROADCAST => {
                    Some(format!("http://{v4}:{porta}"))
                }
                _ => None,
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Convenience for the boot path: if config has `lan_exposto`, start it.
pub async fn boot_from_config(service: &Arc<LanService>, porta: u16, exposto: bool, state: AppState) {
    if !exposto {
        return;
    }
    let state_clone = state.clone();
    let _ = service
        .enable(porta, move || crate::http::router(state_clone))
        .await;
}