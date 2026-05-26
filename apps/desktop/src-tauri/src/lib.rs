#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                if let Err(error) = projectus_server::run().await {
                    eprintln!("servidor local já ativo ou indisponível: {error}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar PROJECTUS");
}
