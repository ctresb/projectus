use std::{net::SocketAddr, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::net::UdpSocket;
use tracing::warn;

use crate::{LOCAL_CONTROL_PORT, domain::API_VERSION};

pub const DISCOVERY_PORT: u16 = 4388;
pub const DISCOVERY_MAGIC: &[u8] = b"PROJECTUS_DISCOVER_V1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryInfo {
    pub produto: String,
    pub versao: String,
    pub api_version: u32,
    pub porta_local: u16,
    pub porta_lan: u16,
    pub lan_exposto: bool,
}

impl DiscoveryInfo {
    pub fn new(porta_lan: u16, lan_exposto: bool) -> Self {
        Self {
            produto: "PROJECTUS-SERVER".to_owned(),
            versao: env!("CARGO_PKG_VERSION").to_owned(),
            api_version: API_VERSION,
            porta_local: LOCAL_CONTROL_PORT,
            porta_lan,
            lan_exposto,
        }
    }
}

pub fn spawn(info: DiscoveryInfo) {
    tokio::spawn(async move {
        if let Err(error) = serve(Arc::new(info)).await {
            warn!(?error, "discovery LAN indisponível");
        }
    });
}

async fn serve(info: Arc<DiscoveryInfo>) -> anyhow::Result<()> {
    let socket = UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)).await?;
    let payload = serde_json::to_vec(info.as_ref())?;
    let mut buf = [0_u8; 256];
    loop {
        let (len, peer) = socket.recv_from(&mut buf).await?;
        if &buf[..len] != DISCOVERY_MAGIC {
            continue;
        }
        reply(&socket, peer, &payload).await;
    }
}

async fn reply(socket: &UdpSocket, peer: SocketAddr, payload: &[u8]) {
    if let Err(error) = socket.send_to(payload, peer).await {
        warn!(?error, %peer, "falha ao responder discovery PROJECTUS");
    }
}
