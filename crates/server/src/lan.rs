//! Estado da exposição LAN. O endpoint de controle do aplicativo permanece em
//! loopback; quando ativado, um listener adicional atende a rede na porta
//! escolhida. Se a porta publicada for a própria porta local, há apenas um
//! listener wildcard.

use std::{
    net::{IpAddr, Ipv4Addr},
    sync::Arc,
};

use crate::domain::LanStatus;

#[derive(Debug)]
pub struct LanService {
    /// O servidor inicializou com listener acessível pela LAN?
    bound_lan: bool,
    /// Erro do bind LAN no boot (se houve fallback pra loopback).
    boot_error: Option<String>,
}

impl LanService {
    pub fn with_boot_state(bound_lan: bool, boot_error: Option<String>) -> Arc<Self> {
        Arc::new(Self {
            bound_lan,
            boot_error,
        })
    }

    pub fn status(&self, porta: u16, flag_desejada: bool) -> LanStatus {
        LanStatus {
            ativo: self.bound_lan,
            porta,
            urls: if self.bound_lan { lan_urls(porta) } else { Vec::new() },
            erro: self.boot_error.clone(),
            precisa_reiniciar: flag_desejada != self.bound_lan,
        }
    }
}

/// Enumera IPv4 não-loopback e monta URLs http.
pub fn lan_urls(porta: u16) -> Vec<String> {
    match if_addrs::get_if_addrs() {
        Ok(list) => list
            .into_iter()
            .filter(|i| !i.is_loopback())
            .filter_map(|i| match i.ip() {
                IpAddr::V4(v4)
                    if !v4.is_link_local() && !v4.is_unspecified() && v4 != Ipv4Addr::BROADCAST =>
                {
                    Some(format!("http://{v4}:{porta}"))
                }
                _ => None,
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}
