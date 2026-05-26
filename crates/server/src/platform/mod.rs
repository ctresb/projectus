#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "linux")]
pub mod linux;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetOs {
    Macos,
    Linux,
    Other,
}

#[derive(Debug, Clone)]
pub struct PlatformLabels {
    pub os_label: &'static str,
    pub credential_store_label: &'static str,
    pub autostart_label: &'static str,
}

pub struct AutostartInfo {
    pub suportado: bool,
    pub instalado: bool,
    pub instalacao_disponivel: bool,
    pub service_path: Option<String>,
    pub plataforma: String,
    pub autostart_nome: String,
    pub instalacao_manual: Option<String>,
}

pub fn platform_labels(os: TargetOs) -> PlatformLabels {
    match os {
        TargetOs::Macos => PlatformLabels {
            os_label: "macOS",
            credential_store_label: "Keychain",
            autostart_label: "LaunchAgent",
        },
        TargetOs::Linux => PlatformLabels {
            os_label: "Linux",
            credential_store_label: "Secret Service",
            autostart_label: "systemd user service",
        },
        TargetOs::Other => PlatformLabels {
            os_label: "sistema atual",
            credential_store_label: "cofre do sistema",
            autostart_label: "autostart",
        },
    }
}

pub fn current_os() -> TargetOs {
    #[cfg(target_os = "macos")]
    return TargetOs::Macos;
    #[cfg(target_os = "linux")]
    return TargetOs::Linux;
    #[allow(unreachable_code)]
    TargetOs::Other
}

pub fn credential_store_label() -> &'static str {
    platform_labels(current_os()).credential_store_label
}

pub fn manual_install_hint(os: TargetOs) -> String {
    match os {
        TargetOs::Macos => "./scripts/instalar-autostart-macos.sh".to_owned(),
        TargetOs::Linux => "./scripts/instalar-autostart-linux.sh".to_owned(),
        TargetOs::Other => String::new(),
    }
}

pub fn is_standalone_server() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.file_stem().map(|n| n.to_owned()))
        .and_then(|n| n.to_str().map(str::to_owned))
        .is_some_and(|n| n == "projectus-server")
}

#[cfg(target_os = "macos")]
pub fn autostart_info() -> anyhow::Result<AutostartInfo> {
    macos::autostart_info()
}

#[cfg(target_os = "linux")]
pub fn autostart_info() -> anyhow::Result<AutostartInfo> {
    linux::autostart_info()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn autostart_info() -> anyhow::Result<AutostartInfo> {
    let labels = platform_labels(TargetOs::Other);
    Ok(AutostartInfo {
        suportado: false,
        instalado: false,
        instalacao_disponivel: false,
        service_path: None,
        plataforma: labels.os_label.to_owned(),
        autostart_nome: labels.autostart_label.to_owned(),
        instalacao_manual: None,
    })
}

#[cfg(target_os = "macos")]
pub fn autostart_install() -> anyhow::Result<AutostartInfo> {
    macos::autostart_install()
}

#[cfg(target_os = "linux")]
pub fn autostart_install() -> anyhow::Result<AutostartInfo> {
    linux::autostart_install()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn autostart_install() -> anyhow::Result<AutostartInfo> {
    anyhow::bail!("autostart não disponível nesta plataforma")
}

#[cfg(target_os = "macos")]
pub fn autostart_restart() -> anyhow::Result<AutostartInfo> {
    macos::autostart_restart()
}

#[cfg(target_os = "linux")]
pub fn autostart_restart() -> anyhow::Result<AutostartInfo> {
    linux::autostart_restart()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn autostart_restart() -> anyhow::Result<AutostartInfo> {
    anyhow::bail!("reinício automático não disponível nesta plataforma")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daemon_status_on_linux_reports_systemd_user_service() {
        let labels = platform_labels(TargetOs::Linux);
        assert_eq!(labels.autostart_label, "systemd user service");
        assert_eq!(labels.os_label, "Linux");
    }

    #[test]
    fn daemon_status_on_macos_reports_launch_agent() {
        let labels = platform_labels(TargetOs::Macos);
        assert_eq!(labels.autostart_label, "LaunchAgent");
        assert_eq!(labels.os_label, "macOS");
    }

    #[test]
    fn credential_store_label_matches_platform() {
        assert_eq!(
            platform_labels(TargetOs::Macos).credential_store_label,
            "Keychain"
        );
        assert_eq!(
            platform_labels(TargetOs::Linux).credential_store_label,
            "Secret Service"
        );
        assert_eq!(
            platform_labels(TargetOs::Other).credential_store_label,
            "cofre do sistema"
        );
    }

    #[test]
    fn manual_install_message_mentions_correct_script() {
        let linux_hint = manual_install_hint(TargetOs::Linux);
        assert!(
            linux_hint.contains("linux"),
            "Linux hint should reference linux script: {linux_hint}"
        );
        let macos_hint = manual_install_hint(TargetOs::Macos);
        assert!(
            macos_hint.contains("macos") || macos_hint.contains("instalar-autostart"),
            "macOS hint should reference autostart script: {macos_hint}"
        );
    }
}
