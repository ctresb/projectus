use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{Arc, Mutex},
    time::Duration,
};

use anyhow::{Context, Result, bail};
use projectus_server::{RunOptions, server_auth};
use serde::Serialize;
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Rect as TrayRect, State,
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tracing_subscriber::EnvFilter;

const LOCAL_SERVER_URL: &str = "http://127.0.0.1:4387";
const AUTOSTART_LABEL: &str = "com.projectus.server-app";
const BACKGROUND_ARG: &str = "--background";
const POPOVER_MARGIN: f64 = 8.0;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum RuntimeState {
    Starting,
    Online,
    Error,
}

#[derive(Debug, Default)]
struct Runtime {
    state: Option<RuntimeState>,
    message: Option<String>,
}

#[derive(Clone, Default)]
struct AppData {
    runtime: Arc<Mutex<Runtime>>,
}

#[derive(Debug, Serialize)]
struct ServerAppStatus {
    state: RuntimeState,
    message: Option<String>,
    server_url: String,
    token_configurado: bool,
    token_mascarado: Option<String>,
    autostart: bool,
    data_root: String,
    logs_dir: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("projectus_server=info,tower_http=info")),
        )
        .try_init();

    tauri::Builder::default()
        .manage(AppData::default())
        .invoke_handler(tauri::generate_handler![
            server_status,
            server_token,
            regenerate_token,
            set_autostart,
            restart_server_app,
            hide_server_window,
            quit_server_app,
        ])
        .setup(|app| {
            let launched_in_background = std::env::args().any(|arg| arg == BACKGROUND_ARG);
            if let Err(error) = setup_tray(app) {
                eprintln!("PROJECTUS-SERVER: falha ao criar item da barra de menus: {error:#}");
                show_main_window_near_menu_bar(app.handle(), None);
            } else if !launched_in_background {
                show_main_window_near_menu_bar(app.handle(), None);
            }
            start_managed_server(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar PROJECTUS-SERVER");
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir PROJECTUS-SERVER", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Reiniciar servidor", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &restart, &quit])?;
    TrayIconBuilder::with_id("projectus-server")
        .icon(state_icon(&RuntimeState::Starting)?)
        .icon_as_template(true)
        .tooltip("PROJECTUS-SERVER - iniciando")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window_near_menu_bar(app, None),
            "restart" => {
                let _ = restart_server_app(app.clone());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle(), Some(rect));
            }
        })
        .build(app)?;
    Ok(())
}

fn show_main_window_near_menu_bar(app: &AppHandle, tray_rect: Option<TrayRect>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = position_window_near_menu_bar(app, &window, tray_rect);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_main_window(app: &AppHandle, tray_rect: Option<TrayRect>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_main_window_near_menu_bar(app, tray_rect);
        }
    }
}

fn position_window_near_menu_bar(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
    tray_rect: Option<TrayRect>,
) -> tauri::Result<()> {
    let window_size = window
        .outer_size()
        .unwrap_or_else(|_| PhysicalSize::new(390, 540));
    let scale_factor = window.scale_factor().unwrap_or(1.0);

    let monitor = tray_rect
        .as_ref()
        .and_then(|rect| {
            let (x, y, _, _) = tray_rect_physical(rect, scale_factor);
            app.monitor_from_point(x, y).ok().flatten()
        })
        .or_else(|| app.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return Ok(());
    };

    let work_area = monitor.work_area();
    let work_x = work_area.position.x as f64;
    let work_y = work_area.position.y as f64;
    let work_width = work_area.size.width as f64;
    let work_height = work_area.size.height as f64;
    let window_width = window_size.width as f64;
    let window_height = window_size.height as f64;

    let mut x = if let Some(rect) = tray_rect.as_ref() {
        let (rect_x, _, rect_width, _) = tray_rect_physical(rect, scale_factor);
        rect_x + (rect_width / 2.0) - (window_width / 2.0)
    } else {
        work_x + work_width - window_width - POPOVER_MARGIN
    };
    let mut y = work_y + POPOVER_MARGIN;

    if let Some(rect) = tray_rect.as_ref() {
        let (_, rect_y, _, rect_height) = tray_rect_physical(rect, scale_factor);
        y = rect_y + rect_height + POPOVER_MARGIN;
    }

    x = x.clamp(
        work_x + POPOVER_MARGIN,
        work_x + work_width - window_width - POPOVER_MARGIN,
    );
    y = y.clamp(
        work_y + POPOVER_MARGIN,
        work_y + work_height - window_height - POPOVER_MARGIN,
    );

    window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
}

fn tray_rect_physical(rect: &TrayRect, scale_factor: f64) -> (f64, f64, f64, f64) {
    let position = rect.position.to_physical::<f64>(scale_factor);
    let size = rect.size.to_physical::<f64>(scale_factor);
    (position.x, position.y, size.width, size.height)
}

fn start_managed_server(app: AppHandle) {
    set_runtime(&app, RuntimeState::Starting, None);
    tauri::async_runtime::spawn(async move {
        let token = match server_auth::ensure_managed_token() {
            Ok(token) => token,
            Err(error) => {
                set_runtime(&app, RuntimeState::Error, Some(format!("{error:#}")));
                return;
            }
        };
        set_runtime(&app, RuntimeState::Online, None);
        if let Err(error) = projectus_server::run(RunOptions::managed(token)).await {
            set_runtime(&app, RuntimeState::Error, Some(format!("{error:#}")));
        }
    });
}

fn set_runtime(app: &AppHandle, state: RuntimeState, message: Option<String>) {
    if let Some(tray) = app.tray_by_id("projectus-server") {
        if let Ok(icon) = state_icon(&state) {
            let _ = tray.set_icon_with_as_template(Some(icon), true);
        }
        let _ = tray.set_tooltip(Some(format!("PROJECTUS-SERVER - {}", state.label())));
    }
    let data = app.state::<AppData>();
    if let Ok(mut runtime) = data.runtime.lock() {
        runtime.state = Some(state);
        runtime.message = message;
    }
}

#[tauri::command]
fn server_status(data: State<'_, AppData>) -> Result<ServerAppStatus, String> {
    status_inner(&data).map_err(|error| format!("{error:#}"))
}

#[tauri::command]
fn server_token() -> Result<String, String> {
    server_auth::ensure_managed_token().map_err(|error| format!("{error:#}"))
}

#[tauri::command]
fn regenerate_token(data: State<'_, AppData>) -> Result<ServerAppStatus, String> {
    server_auth::regenerate_managed_token()
        .map_err(|error| format!("{error:#}"))
        .and_then(|_| status_inner(&data).map_err(|error| format!("{error:#}")))
}

#[tauri::command]
fn set_autostart(enabled: bool, data: State<'_, AppData>) -> Result<ServerAppStatus, String> {
    autostart_set(enabled)
        .map_err(|error| format!("{error:#}"))
        .and_then(|_| status_inner(&data).map_err(|error| format!("{error:#}")))
}

#[tauri::command]
fn restart_server_app(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|error| format!("{error:#}"))?;
    Command::new(exe)
        .spawn()
        .map_err(|error| format!("não foi possível reiniciar: {error:#}"))?;
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(250));
        app.exit(0);
    });
    Ok(())
}

#[tauri::command]
fn hide_server_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn quit_server_app(app: AppHandle) {
    app.exit(0);
}

fn status_inner(data: &AppData) -> Result<ServerAppStatus> {
    let runtime = data.runtime.lock().ok();
    let token = server_auth::status();
    Ok(ServerAppStatus {
        state: runtime
            .as_ref()
            .and_then(|runtime| runtime.state.clone())
            .unwrap_or(RuntimeState::Starting),
        message: runtime.and_then(|runtime| runtime.message.clone()),
        server_url: LOCAL_SERVER_URL.to_owned(),
        token_configurado: token.configurado,
        token_mascarado: token.mascarado,
        autostart: autostart_enabled(),
        data_root: default_data_root().display().to_string(),
        logs_dir: default_logs_dir().display().to_string(),
    })
}

fn autostart_set(enabled: bool) -> Result<()> {
    let plist = autostart_plist()?;
    if enabled {
        if let Some(parent) = plist.parent() {
            fs::create_dir_all(parent)?;
        }
        let exe = std::env::current_exe()?.display().to_string();
        let logs = default_logs_dir();
        fs::create_dir_all(&logs)?;
        let body = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{AUTOSTART_LABEL}</string>
<key>ProgramArguments</key><array><string>{exe}</string><string>{BACKGROUND_ARG}</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>{}/server-app.log</string>
<key>StandardErrorPath</key><string>{}/server-app.err.log</string>
</dict></plist>
"#,
            logs.display(),
            logs.display()
        );
        fs::write(&plist, body)?;
        launchctl("bootstrap", &plist)?;
    } else if plist.exists() {
        let _ = launchctl("bootout", &plist);
        fs::remove_file(plist)?;
    }
    Ok(())
}

fn autostart_enabled() -> bool {
    autostart_plist().is_ok_and(|path| path.exists())
}

fn launchctl(action: &str, plist: &PathBuf) -> Result<()> {
    let domain = format!("gui/{}", unsafe { libc::geteuid() });
    if action == "bootstrap" {
        let _ = Command::new("launchctl")
            .args(["bootout", &domain, plist.to_string_lossy().as_ref()])
            .output();
    }
    let output = Command::new("launchctl")
        .args([action, &domain, plist.to_string_lossy().as_ref()])
        .output()
        .context("não foi possível chamar launchctl")?;
    if !output.status.success() {
        bail!(
            "launchctl falhou: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    Ok(())
}

fn autostart_plist() -> Result<PathBuf> {
    Ok(dirs::home_dir()
        .context("pasta pessoal não encontrada")?
        .join("Library/LaunchAgents")
        .join(format!("{AUTOSTART_LABEL}.plist")))
}

fn default_data_root() -> PathBuf {
    dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("PROJECTUS")
}

fn default_logs_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("Library/Logs/PROJECTUS")
}

impl RuntimeState {
    fn label(&self) -> &'static str {
        match self {
            RuntimeState::Starting => "iniciando",
            RuntimeState::Online => "online",
            RuntimeState::Error => "erro",
        }
    }
}

fn state_icon(state: &RuntimeState) -> tauri::Result<Image<'static>> {
    let bytes = match state {
        RuntimeState::Starting => include_bytes!("../assets/tray_starting.png").as_slice(),
        RuntimeState::Online => include_bytes!("../assets/tray_on.png").as_slice(),
        RuntimeState::Error => include_bytes!("../assets/tray_off.png").as_slice(),
    };
    Image::from_bytes(bytes)
}
