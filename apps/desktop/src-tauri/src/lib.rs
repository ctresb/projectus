#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_connection,
            save_connection,
            clear_connection,
            discover_servers,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar PROJECTUS");
}

use std::{
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs, UdpSocket},
    time::{Duration, Instant},
};

use keyring::Entry;
use serde::{Deserialize, Serialize};

const CONNECTION_SERVICE: &str = "com.projectus.client";
const SERVER_URL_USER: &str = "server-url";
const API_TOKEN_USER: &str = "api-token";
const DISCOVERY_PORT: u16 = 4388;
const DISCOVERY_MAGIC: &[u8] = b"PROJECTUS_DISCOVER_V1";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionConfig {
    server_url: String,
    api_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DiscoveredServer {
    produto: String,
    versao: String,
    server_url: String,
    lan_exposto: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct DiscoveryInfo {
    produto: String,
    versao: String,
    porta_local: u16,
    porta_lan: u16,
    lan_exposto: bool,
}

#[tauri::command]
fn load_connection() -> Result<Option<ConnectionConfig>, String> {
    let url = Entry::new(CONNECTION_SERVICE, SERVER_URL_USER)
        .map_err(|error| format!("{error:#}"))?
        .get_password()
        .ok();
    let token = Entry::new(CONNECTION_SERVICE, API_TOKEN_USER)
        .map_err(|error| format!("{error:#}"))?
        .get_password()
        .ok();
    Ok(match (url, token) {
        (Some(server_url), Some(api_token)) if !api_token.trim().is_empty() => Some(ConnectionConfig {
            server_url,
            api_token,
        }),
        _ => None,
    })
}

#[tauri::command]
fn save_connection(input: ConnectionConfig) -> Result<ConnectionConfig, String> {
    let server_url = normalize_url(&input.server_url)?;
    let api_token = input.api_token.trim().to_owned();
    if api_token.len() < 24 {
        return Err("token PROJECTUS inválido".into());
    }
    Entry::new(CONNECTION_SERVICE, SERVER_URL_USER)
        .map_err(|error| format!("{error:#}"))?
        .set_password(&server_url)
        .map_err(|error| format!("não foi possível salvar endereço no Keychain: {error:#}"))?;
    Entry::new(CONNECTION_SERVICE, API_TOKEN_USER)
        .map_err(|error| format!("{error:#}"))?
        .set_password(&api_token)
        .map_err(|error| format!("não foi possível salvar token no Keychain: {error:#}"))?;
    Ok(ConnectionConfig {
        server_url,
        api_token,
    })
}

#[tauri::command]
fn clear_connection() -> Result<(), String> {
    let _ = Entry::new(CONNECTION_SERVICE, SERVER_URL_USER)
        .map_err(|error| format!("{error:#}"))?
        .delete_credential();
    let _ = Entry::new(CONNECTION_SERVICE, API_TOKEN_USER)
        .map_err(|error| format!("{error:#}"))?
        .delete_credential();
    Ok(())
}

#[tauri::command]
fn discover_servers() -> Vec<DiscoveredServer> {
    let mut found = Vec::new();
    if let Some(local) = probe_http_discovery("http://127.0.0.1:4387") {
        found.push(local);
    }
    found.extend(udp_discovery());
    found.sort_by(|a, b| a.server_url.cmp(&b.server_url));
    found.dedup_by(|a, b| a.server_url == b.server_url);
    found
}

fn udp_discovery() -> Vec<DiscoveredServer> {
    let socket = match UdpSocket::bind(("0.0.0.0", 0)) {
        Ok(socket) => socket,
        Err(_) => return Vec::new(),
    };
    let _ = socket.set_broadcast(true);
    let _ = socket.set_read_timeout(Some(Duration::from_millis(650)));
    let _ = socket.send_to(DISCOVERY_MAGIC, ("255.255.255.255", DISCOVERY_PORT));

    let started = Instant::now();
    let mut buf = [0_u8; 1024];
    let mut found = Vec::new();
    while started.elapsed() < Duration::from_millis(700) {
        let Ok((len, peer)) = socket.recv_from(&mut buf) else {
            break;
        };
        if let Ok(info) = serde_json::from_slice::<DiscoveryInfo>(&buf[..len]) {
            let port = if info.lan_exposto {
                info.porta_lan
            } else {
                info.porta_local
            };
            found.push(DiscoveredServer {
                produto: info.produto,
                versao: info.versao,
                server_url: format!("http://{}:{port}", peer.ip()),
                lan_exposto: info.lan_exposto,
            });
        }
    }
    found
}

fn probe_http_discovery(base: &str) -> Option<DiscoveredServer> {
    let url = normalize_url(base).ok()?;
    let host = url.strip_prefix("http://")?.split('/').next()?;
    let addr = host.to_socket_addrs().ok()?.next()?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(200)).ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let request = format!("GET /api/discovery HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let body = response.split("\r\n\r\n").nth(1)?;
    let info = serde_json::from_str::<DiscoveryInfo>(body).ok()?;
    Some(DiscoveredServer {
        produto: info.produto,
        versao: info.versao,
        server_url: url,
        lan_exposto: info.lan_exposto,
    })
}

fn normalize_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("informe o endereço do PROJECTUS-SERVER".into());
    }
    let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_owned()
    } else {
        format!("http://{trimmed}")
    };
    let host = with_scheme
        .strip_prefix("http://")
        .or_else(|| with_scheme.strip_prefix("https://"))
        .ok_or_else(|| "endereço inválido".to_owned())?;
    let socket_host = host.split('/').next().unwrap_or_default();
    if socket_host.is_empty() {
        return Err("endereço inválido".into());
    }
    Ok(with_scheme)
}
