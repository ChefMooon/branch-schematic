use sqlx::sqlite::SqlitePool;
use tauri::Manager;

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
async fn get_canvas_views(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::CanvasViewRow>, String> {
    db::fetch_all_canvas_views(&state.0)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn create_canvas_view(
    state: tauri::State<'_, DbState>,
    id: String,
    name: String,
    zoom_level: f64,
    pan_x: f64,
    pan_y: f64,
) -> Result<(), String> {
    db::create_new_environment_view(&state.0, &id, &name, zoom_level, pan_x, pan_y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn clone_view(
    state: tauri::State<'_, DbState>,
    source_id: String,
    new_id: String,
    new_name: String,
) -> Result<(), String> {
    db::clone_canvas_view(&state.0, &source_id, &new_id, &new_name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_canvas_view(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<(), String> {
    db::delete_canvas_view(&state.0, &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn rename_canvas_view(
    state: tauri::State<'_, DbState>,
    view_id: String,
    name: String,
) -> Result<(), String> {
    db::rename_canvas_view(&state.0, &view_id, &name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_canvas_view_favorite(
    state: tauri::State<'_, DbState>,
    view_id: String,
    is_favorite: bool,
) -> Result<(), String> {
    db::set_canvas_view_favorite(&state.0, &view_id, is_favorite)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn move_canvas_view_display_order(
    state: tauri::State<'_, DbState>,
    view_id: String,
    direction: i64,
) -> Result<(), String> {
    db::move_canvas_view_display_order(&state.0, &view_id, direction)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_viewport_state(
    state: tauri::State<'_, DbState>,
    view_id: String,
    zoom_level: f64,
    pan_x: f64,
    pan_y: f64,
) -> Result<(), String> {
    db::update_canvas_viewport_state(&state.0, &view_id, zoom_level, pan_x, pan_y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn snapshot_canvas_view_baseline_viewport(
    state: tauri::State<'_, DbState>,
    view_id: String,
    baseline_zoom: f64,
    baseline_pan_x: f64,
    baseline_pan_y: f64,
) -> Result<(), String> {
    db::snapshot_canvas_view_baseline_viewport(&state.0, &view_id, baseline_zoom, baseline_pan_x, baseline_pan_y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_canvas_view_card_state(
    state: tauri::State<'_, DbState>,
    view_id: String,
    card_state_json: String,
) -> Result<(), String> {
    db::update_canvas_view_card_state(&state.0, &view_id, &card_state_json)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_canvas_view_path_visibility(
    state: tauri::State<'_, DbState>,
    view_id: String,
    repo_path_id: String,
    visible: bool,
) -> Result<(), String> {
    db::set_canvas_view_path_visibility(&state.0, &view_id, &repo_path_id, visible)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_canvas_view_branch_visibility(
    state: tauri::State<'_, DbState>,
    view_id: String,
    branch_id: String,
    visible: bool,
) -> Result<(), String> {
    db::set_canvas_view_branch_visibility(&state.0, &view_id, &branch_id, visible)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_canvas_view_scope(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<db::CanvasViewScopeState, String> {
    db::fetch_canvas_view_scope(&state.0, &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_workspace_nodes(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<Vec<db::WorkspaceNodeRow>, String> {
    db::fetch_workspace_nodes(&state.0, &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_card_position(
    state: tauri::State<'_, DbState>,
    view_id: String,
    id: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    db::update_canvas_card_position(&state.0, &view_id, &id, x, y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_manual_edges(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<Vec<db::CanvasEdgeRow>, String> {
    db::fetch_canvas_manual_edges(&state.0, &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_manual_edge(
    state: tauri::State<'_, DbState>,
    view_id: String,
    id: String,
    source: String,
    target: String,
) -> Result<(), String> {
    db::insert_canvas_manual_edge(&state.0, &view_id, &id, &source, &target, "BEZIER")
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_manual_edge(
    state: tauri::State<'_, DbState>,
    view_id: String,
    id: String,
) -> Result<(), String> {
    db::delete_canvas_manual_edge(&state.0, &view_id, &id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_branch_card_config(
    state: tauri::State<'_, DbState>,
    view_id: String,
    repo_path_id: String,
    view_mode: String,
    commit_density: i64,
    theme_color_hex: String,
    explode_branches: i64,
) -> Result<(), String> {
    db::update_canvas_card_config(&state.0, &view_id, &repo_path_id, &view_mode, commit_density, &theme_color_hex, explode_branches)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn soft_archive_repository(
    _state: tauri::State<'_, DbState>,
    _path_id: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn get_branch_commits(
    state: tauri::State<'_, DbState>,
    branch_id: String,
    limit: i64,
) -> Result<Vec<db::CachedCommitRow>, String> {
    db::fetch_branch_commits(&state.0, &branch_id, limit)
        .await
        .map_err(|error| error.to_string())
}

pub fn run() {
    // Generate context cleanly
    let context = tauri::generate_context!();

    // Resolve the app data directory used by Tauri and ensure the migration plugin
    // and the runtime SQLx pool target the exact same SQLite file.
    let app_dir = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default())
        .join("com.justi.branch-schematic");
    let _ = std::fs::create_dir_all(&app_dir);
    let target_db_url = format!("sqlite:{}", app_dir.join(db::DB_NAME).to_string_lossy());

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            let app_dir = app.path().app_data_dir().expect("Failed to resolve App Data directory");
            let _ = std::fs::create_dir_all(&app_dir);
            let db_path = app_dir.join(db::DB_NAME);
            let target_db_url = format!("sqlite:{}", db_path.to_string_lossy());

            tauri::async_runtime::block_on(async move {
                let pool = SqlitePool::connect(&target_db_url).await.expect("Failed to connect to SQLite database");
                handle.manage(DbState(pool));
            });

            if let Some(window_handle) = app.get_webview_window("main") {
                let _ = window_handle.show();
                let _ = window_handle.set_focus();

                let _ = window_handle.on_window_event({
                    let app_handle = app.handle().clone();
                    move |event| {
                        if let tauri::WindowEvent::CloseRequested { .. } = event {
                            let _ = tauri_plugin_window_state::AppHandleExt::save_window_state(
                                &app_handle,
                                tauri_plugin_window_state::StateFlags::all(),
                            );
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
                .add_migrations(&target_db_url, db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            watch_project_directory,
            get_active_tracked_paths,
            get_canvas_views,
            create_canvas_view,
            clone_view,
            delete_canvas_view,
            rename_canvas_view,
            set_canvas_view_favorite,
            move_canvas_view_display_order,
            save_viewport_state,
            snapshot_canvas_view_baseline_viewport,
            save_canvas_view_card_state,
            set_canvas_view_path_visibility,
            set_canvas_view_branch_visibility,
            get_canvas_view_scope,
            get_workspace_nodes,
            update_card_position,
            get_manual_edges,
            save_manual_edge,
            delete_manual_edge,
            soft_archive_repository,
            get_branch_commits,
            update_branch_card_config,
            git::scan_local_repository,
            git::execute_git_checkout,
            git::create_git_branch,
            git::initialize_new_repository,
            git::crawl_repositories_command,
            git::add_new_tracked_path,
            git::untrack_repository,
            git::get_tracked_workspaces,
            git::refresh_repository_git_status,
            git::git_fetch_operation,
            git::git_pull_operation,
            git::git_push_operation,
            git::set_repository_alias,
            git::set_repository_favorite,
            git::set_repository_origin_type,
            git::set_repository_group,
            git::create_custom_group,
            git::update_custom_group,
            git::delete_custom_group,
            git::get_custom_groups_with_usage,
            git::create_global_tag,
            git::add_repository_tag,
            git::remove_repository_tag,
            git::get_repository_tags,
            git::get_global_tags_with_usage,
            git::update_global_tag,
            git::delete_global_tag,
            git::cleanup_dangling_global_tags,
            git::touch_repository_last_accessed,
            git::get_quick_filter_metadata,
            git::determine_branch_topology,
        ])
        .run(context)
        .expect("error while running tauri application");
}