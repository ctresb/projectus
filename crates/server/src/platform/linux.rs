use std::{fs, path::PathBuf, process::Command};

use anyhow::{Context, Result, bail};

use super::{AutostartInfo, TargetOs, is_standalone_server, manual_install_hint, platform_labels};

pub fn autostart_info() -> Result<AutostartInfo> {
    let standalone = is_standalone_server();
    let service_path = service_file_path()?;
    let instalado = service_path.exists() && is_service_active();
    let labels = platform_labels(TargetOs::Linux);
    Ok(AutostartInfo {
        suportado: true,
        instalado,
        instalacao_disponivel: standalone,
        service_path: Some(service_path.to_string_lossy().to_string()),
        plataforma: labels.os_label.to_owned(),
        autostart_nome: labels.autostart_label.to_owned(),
        instalacao_manual: Some(manual_install_hint(TargetOs::Linux)),
    })
}

pub fn autostart_install() -> Result<AutostartInfo> {
    if !is_standalone_server() {
        bail!("execute scripts/instalar-autostart-linux.sh para instalar o servidor persistente");
    }
    let executable = std::env::current_exe()?.to_string_lossy().to_string();
    let working_directory = std::env::current_dir()?.to_string_lossy().to_string();
    let web_dist = std::env::var("PROJECTUS_WEB_DIST")
        .unwrap_or_else(|_| format!("{working_directory}/apps/web/dist"));

    let service_path = service_file_path()?;
    if let Some(parent) = service_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let unit = format!(
        "[Unit]\nDescription=PROJECTUS local server\nAfter=network-online.target\n\n\
         [Service]\nType=simple\nWorkingDirectory={working_directory}\n\
         ExecStart={executable}\nEnvironment=PROJECTUS_WEB_DIST={web_dist}\n\
         Restart=on-failure\nRestartSec=3\n\n\
         [Install]\nWantedBy=default.target\n"
    );
    fs::write(&service_path, unit)?;

    let reload = Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .output()
        .context("não foi possível chamar systemctl")?;
    if !reload.status.success() {
        bail!(
            "systemd user indisponível; rode manualmente ou habilite linger com: sudo loginctl enable-linger \"$USER\""
        );
    }

    let enable = Command::new("systemctl")
        .args(["--user", "enable", "--now", "projectus.service"])
        .output()
        .context("systemctl enable falhou")?;
    if !enable.status.success() {
        bail!(
            "systemctl enable falhou: {}",
            String::from_utf8_lossy(&enable.stderr)
        );
    }

    autostart_info()
}

pub fn autostart_restart() -> Result<AutostartInfo> {
    let current = autostart_info()?;
    if !current.instalado || !is_standalone_server() {
        bail!("o servidor persistente não está instalado; instale o autostart primeiro");
    }
    let output = Command::new("systemctl")
        .args(["--user", "restart", "projectus.service"])
        .output()
        .context("não foi possível reiniciar via systemctl")?;
    if !output.status.success() {
        bail!(
            "systemctl restart falhou: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    autostart_info()
}

fn service_file_path() -> Result<PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("diretório de configuração não encontrado"))?;
    Ok(config_dir
        .join("systemd")
        .join("user")
        .join("projectus.service"))
}

fn is_service_active() -> bool {
    Command::new("systemctl")
        .args(["--user", "is-active", "--quiet", "projectus.service"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
