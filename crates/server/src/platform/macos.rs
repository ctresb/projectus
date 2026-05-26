use std::{fs, path::PathBuf, process::Command};

use anyhow::{Context, Result, bail};

use super::{AutostartInfo, TargetOs, is_standalone_server, manual_install_hint, platform_labels};

const LABEL: &str = "com.projectus.server";

pub fn autostart_info() -> Result<AutostartInfo> {
    let standalone = is_standalone_server();
    let plist = plist_path()?;
    let labels = platform_labels(TargetOs::Macos);
    Ok(AutostartInfo {
        suportado: true,
        instalado: plist.exists(),
        instalacao_disponivel: standalone,
        service_path: Some(plist.to_string_lossy().to_string()),
        plataforma: labels.os_label.to_owned(),
        autostart_nome: labels.autostart_label.to_owned(),
        instalacao_manual: Some(manual_install_hint(TargetOs::Macos)),
    })
}

pub fn autostart_install() -> Result<AutostartInfo> {
    if !is_standalone_server() {
        bail!("execute scripts/instalar-autostart-macos.sh para instalar o servidor persistente");
    }
    let executable = std::env::current_exe()?.to_string_lossy().to_string();
    let working_directory = std::env::current_dir()?.to_string_lossy().to_string();
    let web_dist = installed_web_dist()
        .map(|path| {
            format!(
                "<key>EnvironmentVariables</key><dict>\n<key>PROJECTUS_WEB_DIST</key><string>{}</string>\n</dict>\n",
                path.display()
            )
        })
        .unwrap_or_default();
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
<key>WorkingDirectory</key><string>{working_directory}</string>
{web_dist}<key>RunAtLoad</key><true/>
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
    autostart_info()
}

pub fn autostart_restart() -> Result<AutostartInfo> {
    let current = autostart_info()?;
    if !current.instalado || !is_standalone_server() {
        bail!("o servidor persistente não está instalado; instale o autostart primeiro");
    }
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(250));
        std::process::exit(0);
    });
    Ok(current)
}

fn installed_web_dist() -> Option<PathBuf> {
    std::env::var_os("PROJECTUS_WEB_DIST")
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .and_then(|path| path.ancestors().nth(3).map(PathBuf::from))
                .map(|root| root.join("apps/web/dist"))
                .filter(|path| path.exists())
        })
}

fn plist_path() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("pasta pessoal não encontrada"))?
        .join("Library/LaunchAgents")
        .join(format!("{LABEL}.plist")))
}
