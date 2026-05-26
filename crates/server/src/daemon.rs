use anyhow::Result;
use serde::Serialize;

use crate::platform;

#[derive(Debug, Serialize)]
pub struct DaemonStatus {
    pub suportado: bool,
    pub instalado: bool,
    pub instalacao_disponivel: bool,
    pub service_path: Option<String>,
    pub executavel: String,
    pub plataforma: String,
    pub autostart_nome: String,
    pub instalacao_manual: Option<String>,
}

fn build_status(info: platform::AutostartInfo) -> Result<DaemonStatus> {
    let executavel = std::env::current_exe()?.to_string_lossy().to_string();
    Ok(DaemonStatus {
        suportado: info.suportado,
        instalado: info.instalado,
        instalacao_disponivel: info.instalacao_disponivel,
        service_path: info.service_path,
        executavel,
        plataforma: info.plataforma,
        autostart_nome: info.autostart_nome,
        instalacao_manual: info.instalacao_manual,
    })
}

pub fn status() -> Result<DaemonStatus> {
    build_status(platform::autostart_info()?)
}

pub fn install() -> Result<DaemonStatus> {
    build_status(platform::autostart_install()?)
}

pub fn restart() -> Result<DaemonStatus> {
    build_status(platform::autostart_restart()?)
}
