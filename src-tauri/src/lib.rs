use tauri::{Manager, tray::TrayIconBuilder, tray::TrayIconEvent};
use tauri_plugin_window_state::WindowExt;

mod db;
mod git;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Call explicitly through your new module namespace
            let restore_window = db::should_restore_window(app.handle());
            let start_minimized = db::should_start_minimized(app.handle());

            if let Some(window) = app.get_webview_window("main") {
                if restore_window && !start_minimized {
                    let _ = window.restore_state(tauri_plugin_window_state::StateFlags::all());
                }

                if start_minimized {
                    let _ = window.hide(); 
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            let app_handle = app.handle().clone();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                let window_handle = window.clone();

                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Point tracking validation checks directly to db file
                        if db::should_hide_to_tray(&app_handle) {
                            api.prevent_close();
                            let _ = window_handle.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::empty())
                .skip_initial_state("main")
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}