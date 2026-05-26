use std::{fs, path::PathBuf, process::Command};

use anyhow::{Context, Result, bail};
use serde::Serialize;

const LABEL: &str = "com.projectus.server";

#[derive(Debug, Serialize)]
pub struct DaemonStatus {
    pub suportado: bool,
    pub instalado: bool,
    pub instalacao_disponivel: bool,
    pub plist: Option<String>,
    pub executavel: String,
}

pub fn status() -> Result<DaemonStatus> {
    let executable = std::env::current_exe()?.to_string_lossy().to_string();
    let standalone = is_standalone_server();
    #[cfg(target_os = "macos")]
    {
        let plist = plist_path()?;
        return Ok(DaemonStatus {
            suportado: true,
            instalado: plist.exists(),
            instalacao_disponivel: standalone,
            plist: Some(plist.to_string_lossy().to_string()),
            executavel: executable,
        });
    }
    #[cfg(not(target_os = "macos"))]
    Ok(DaemonStatus {
        suportado: false,
        instalado: false,
        instalacao_disponivel: false,
        plist: None,
        executavel: executable,
    })
}

pub fn install() -> Result<DaemonStatus> {
    #[cfg(not(target_os = "macos"))]
    bail!("autostart está disponível apenas no macOS");
    #[cfg(target_os = "macos")]
    {
        if !is_standalone_server() {
            bail!("execute scripts/instalar-autostart.sh para instalar o servidor persistente");
        }
        let executable = std::env::current_exe()?.to_string_lossy().to_string();
        let plist = plist_path()?;
        if let Some(parent) = plist.parent() {
            fs::create_dir_all(parent)?;
        }
        let logs = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("PROJECTUS");
        fs::create_dir_all(&logs)?;
        let body = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{LABEL}</string>
<key>ProgramArguments</key><array><string>{executable}</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>{}/server.log</string>
<key>StandardErrorPath</key><string>{}/server.err.log</string>
</dict></plist>
"#,
            logs.display(),
            logs.display()
        );
        fs::write(&plist, body)?;
        let domain = format!("gui/{}", unsafe { libc::geteuid() });
        let _ = Command::new("launchctl")
            .args(["bootout", &domain, plist.to_string_lossy().as_ref()])
            .output();
        let output = Command::new("launchctl")
            .args(["bootstrap", &domain, plist.to_string_lossy().as_ref()])
            .output()
            .context("não foi possível chamar launchctl")?;
        if !output.status.success() {
            bail!(
                "launchctl falhou: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        status()
    }
}

fn is_standalone_server() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.file_stem().map(|name| name.to_owned()))
        .and_then(|name| name.to_str().map(str::to_owned))
        .is_some_and(|name| name == "projectus-server")
}

#[cfg(target_os = "macos")]
fn plist_path() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("pasta pessoal não encontrada"))?
        .join("Library/LaunchAgents")
        .join(format!("{LABEL}.plist")))
}
