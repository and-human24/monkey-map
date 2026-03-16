mod commands;
pub mod error;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_mindmap,
            commands::write_mindmap,
            commands::pick_file,
            commands::pick_directory,
            commands::list_recent,
            commands::add_recent,
            commands::remove_recent,
            commands::list_flows,
            commands::save_flow,
            commands::delete_flow,
            commands::create_project,
            commands::rename_mindmap,
            watcher::start_watching,
            watcher::stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
