// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use sqlx::SqlitePool;
use tauri::{Manager, tray::TrayIconBuilder, tray::TrayIconEvent};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::WindowExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn read_bool_setting(app: &tauri::AppHandle, column: &str) -> bool {
    let db_path = app.path().app_config_dir().unwrap_or_default().join("tauri-basic-template.db");
    let db_url = format!("sqlite:{}", db_path.to_string_lossy());

    tauri::async_runtime::block_on(async move {
        let pool = SqlitePool::connect(&db_url).await.ok()?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                hide_to_tray INTEGER DEFAULT 0,
                restore_window INTEGER DEFAULT 1,
                launch_at_login INTEGER DEFAULT 0,
                start_minimized INTEGER DEFAULT 0,
                theme TEXT DEFAULT 'system'
            );"
        )
        .execute(&pool)
        .await
        .ok()?;

        sqlx::query(
            "INSERT OR IGNORE INTO settings (id, hide_to_tray, restore_window, launch_at_login, start_minimized, theme)
             VALUES (1, 0, 1, 0, 0, 'system');"
        )
        .execute(&pool)
        .await
        .ok()?;

        let value: i64 = sqlx::query_scalar(&format!("SELECT {column} FROM settings WHERE id = 1"))
            .fetch_one(&pool)
            .await
            .ok()?;

        pool.close().await;

        Some(value != 0)
    })
    .unwrap_or(false)
}

fn should_restore_window(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "restore_window")
}

fn should_hide_to_tray(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "hide_to_tray")
}

fn should_start_minimized(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "start_minimized")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
             description: "create_initial_tables",
             sql: "CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );",
             kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_settings_table",
            sql: "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                hide_to_tray INTEGER DEFAULT 0,
                restore_window INTEGER DEFAULT 1,
                launch_at_login INTEGER DEFAULT 0,
                start_minimized INTEGER DEFAULT 0,
                theme TEXT DEFAULT 'system'
            );
            -- This line automatically inserts our initial default row if it doesn't exist yet!
            INSERT OR IGNORE INTO settings (id, hide_to_tray, restore_window, launch_at_login, start_minimized, theme) 
            VALUES (1, 0, 1, 0, 0, 'system');",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .setup(|app| {
            let restore_window = should_restore_window(app.handle());
            let start_minimized = should_start_minimized(app.handle());

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
                        if should_hide_to_tray(&app_handle) {
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
                .add_migrations("sqlite:tauri-basic-template.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
