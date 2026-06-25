use sqlx::sqlite::SqlitePool;
use tauri::{tray::TrayIconBuilder, tray::TrayIconEvent, Manager};
use tauri_plugin_window_state::WindowExt;

mod daemon;
mod db;
mod git;

// Shared Tauri State container for our background SQLx Pool
pub struct DbState(pub SqlitePool);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn watch_project_directory(
    app: tauri::AppHandle,
    state: tauri::State<'_, DbState>,
    path_id: String,
    absolute_path: String,
) -> Result<(), String> {
    let daemon = daemon::IndexerDaemon::new(app, state.0.clone());
    daemon.start_watching(path_id, absolute_path).await?;
    Ok(())
}

#[tauri::command]
async fn get_active_tracked_paths(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::TrackedPathRow>, String> {
    db::fetch_active_tracked_paths(&state.0)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_workspace_nodes(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::WorkspaceNodeRow>, String> {
    db::fetch_workspace_nodes(&state.0)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_card_position(
    state: tauri::State<'_, DbState>,
    id: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    db::update_canvas_card_position(&state.0, &id, x, y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_manual_edges(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::CanvasEdgeRow>, String> {
    db::fetch_canvas_manual_edges(&state.0)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_manual_edge(
    state: tauri::State<'_, DbState>,
    id: String,
    source: String,
    target: String,
) -> Result<(), String> {
    db::insert_canvas_manual_edge(&state.0, &id, &source, &target, "BEZIER")
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn soft_archive_repository(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<(), String> {
    db::archive_tracked_path(&state.0, &path_id)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 1. Initialize the SQLite Connection Pool for the Daemon matching db::DB_URL location
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to locate app data directory");
            std::fs::create_dir_all(&app_dir).unwrap();

            // Build absolute path targeting the exact same file location managed by Tauri Plugin SQL
            let db_file_path = app_dir.join(db::DB_NAME);
            let db_url = format!("sqlite:{}", db_file_path.to_string_lossy());

            // Block asynchronously on setup to spin up our daemon SQLx engine pool
            tauri::async_runtime::block_on(async {
                let pool = SqlitePool::connect(&db_url)
                    .await
                    .expect("Failed to connect to SQLite Pool");
                app.manage(DbState(pool));
            });

            // 2. Window state lifecycle configuration matching your db settings
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

            // 3. Tray Event Handlers
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

            // 4. Close interception rules mapped to db settings
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                let window_handle = window.clone();

                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
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
        // 5. Consolidated single-entry invoke handler registry
        .invoke_handler(tauri::generate_handler![
            greet,
            watch_project_directory,
            get_active_tracked_paths,
            get_workspace_nodes,
            update_card_position,
            get_manual_edges,
            save_manual_edge,
            soft_archive_repository,
            git::scan_local_repository,
            git::execute_git_checkout,
            git::create_git_branch,
            git::add_new_tracked_path,
            git::untrack_repository,
            git::get_tracked_workspaces,
            git::set_repository_alias,
            git::determine_branch_topology,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
