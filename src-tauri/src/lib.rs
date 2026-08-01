use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use tauri::{image::Image, menu::{MenuBuilder, MenuItem}, tray::TrayIconBuilder, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_window_state::{AppHandleExt, WindowExt};

mod auth;
mod daemon;
mod db;
mod git;

fn ensure_sqlite_db_file(path: &std::path::Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create DB directory: {error}"))?;
    }

    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("Failed to create/open DB file: {error}"))?;

    Ok(())
}

fn sqlite_connect_options(path: &std::path::Path) -> Result<SqliteConnectOptions, String> {
    Ok(SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true))
}

const APP_DATA_DIR_NAME: &str = "com.justi.branch-schematic";

#[cfg(debug_assertions)]
const WINDOW_STATE_FILE: &str = ".window-state-dev.json";

#[cfg(not(debug_assertions))]
const WINDOW_STATE_FILE: &str = ".window-state.json";

fn resolve_app_data_directory() -> std::path::PathBuf {
    std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default())
        .join(APP_DATA_DIR_NAME)
}

fn resolve_database_path() -> std::path::PathBuf {
    resolve_app_data_directory().join(db::DB_NAME)
}

#[tauri::command]
fn get_database_path() -> Result<String, String> {
    Ok(resolve_database_path().to_string_lossy().into_owned())
}

fn apply_autostart_preference(app: &tauri::AppHandle, launch_at_login: bool) {
    let autostart_manager = app.autolaunch();
    if launch_at_login {
        let _ = autostart_manager.enable();
    } else {
        let _ = autostart_manager.disable();
    }
}

fn apply_window_runtime_preferences(app: &tauri::AppHandle) {
    if let Some(window_handle) = app.get_webview_window("main") {
        let start_minimized = db::should_start_minimized(app);
        if start_minimized {
            let _ = window_handle.hide();
        } else {
            let _ = window_handle.show();
            let _ = window_handle.set_focus();
        }
    }
}

fn sync_runtime_preferences(app: &tauri::AppHandle) -> Result<(), String> {
    let launch_at_login = db::should_launch_at_login(app);
    apply_autostart_preference(app, launch_at_login);
    apply_window_runtime_preferences(app);
    Ok(())
}

fn setup_tray_icon(app: &tauri::AppHandle) -> Result<(), String> {
    let mut candidate_paths = vec![];

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidate_paths.push(resource_dir.join("icons").join("32x32.png"));
        candidate_paths.push(resource_dir.join("icons").join("64x64.png"));
        candidate_paths.push(resource_dir.join("icons").join("icon.png"));
        candidate_paths.push(resource_dir.join("icons").join("icon.ico"));
        candidate_paths.push(resource_dir.join("32x32.png"));
        candidate_paths.push(resource_dir.join("64x64.png"));
        candidate_paths.push(resource_dir.join("icon.png"));
        candidate_paths.push(resource_dir.join("icon.ico"));
    }

    for root in std::iter::once(std::env::current_dir().ok()).flatten() {
        let mut current = root;
        loop {
            candidate_paths.push(current.join("src-tauri").join("icons").join("32x32.png"));
            candidate_paths.push(current.join("src-tauri").join("icons").join("64x64.png"));
            candidate_paths.push(current.join("src-tauri").join("icons").join("icon.png"));
            candidate_paths.push(current.join("src-tauri").join("icons").join("icon.ico"));
            candidate_paths.push(current.join("src-tauri").join("32x32.png"));
            candidate_paths.push(current.join("src-tauri").join("64x64.png"));
            candidate_paths.push(current.join("src-tauri").join("icon.png"));
            candidate_paths.push(current.join("src-tauri").join("icon.ico"));
            if !current.pop() {
                break;
            }
        }
    }

    if let Ok(executable_path) = std::env::current_exe() {
        if let Some(parent) = executable_path.parent() {
            let mut current = parent.to_path_buf();
            loop {
                candidate_paths.push(current.join("src-tauri").join("icons").join("32x32.png"));
                candidate_paths.push(current.join("src-tauri").join("icons").join("64x64.png"));
                candidate_paths.push(current.join("src-tauri").join("icons").join("icon.png"));
                candidate_paths.push(current.join("src-tauri").join("icons").join("icon.ico"));
                candidate_paths.push(current.join("src-tauri").join("32x32.png"));
                candidate_paths.push(current.join("src-tauri").join("64x64.png"));
                candidate_paths.push(current.join("src-tauri").join("icon.png"));
                candidate_paths.push(current.join("src-tauri").join("icon.ico"));
                if !current.pop() {
                    break;
                }
            }
        }
    }

    let icon = candidate_paths
        .into_iter()
        .find(|path| path.exists())
        .and_then(|icon_path| {
            let icon_bytes = std::fs::read(&icon_path).ok()?;
            let icon = image::load_from_memory(&icon_bytes).ok()?;
            let rgba = icon.to_rgba8();
            Some(Image::new_owned(rgba.into_vec(), icon.width(), icon.height()))
        })
        .or_else(|| app.default_window_icon().cloned())
        .ok_or_else(|| "Unable to locate or decode a tray icon".to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&MenuItem::with_id(app, "show-window", "Show window", true, None::<&str>).map_err(|error| format!("Failed to create tray menu item: {error}"))?)
        .item(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).map_err(|error| format!("Failed to create quit tray menu item: {error}"))?)
        .build()
        .map_err(|error| format!("Failed to build tray menu: {error}"))?;

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Branch Schematic")
        .menu(&menu)
        .on_menu_event({
            move |app_handle, event| {
                match event.id.as_ref() {
                    "show-window" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let _ = app_handle.exit(0);
                    }
                    _ => {}
                }
            }
        })
        .on_tray_icon_event({
            let app_handle = app.clone();
            move |_tray, event| {
                if let tauri::tray::TrayIconEvent::Click {
                    button,
                    button_state,
                    ..
                } = event
                {
                    if button == tauri::tray::MouseButton::Left
                        && button_state == tauri::tray::MouseButtonState::Up
                    {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)
        .map_err(|error| format!("Failed to create tray icon: {error}"))?;

    let _ = tray.set_visible(true);

    Ok(())
}

#[tauri::command]
fn sync_runtime_settings_command(app: tauri::AppHandle) -> Result<(), String> {
    sync_runtime_preferences(&app)
}

// Shared Tauri State container for our background SQLx Pool
pub struct DbState(pub SqlitePool);

impl DbState {
    pub fn pool(&self) -> &SqlitePool {
        &self.0
    }
}

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
    let daemon = daemon::IndexerDaemon::new(app, state.inner().pool().clone());
    daemon.start_watching(path_id, absolute_path).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_repository_path_valid;

    #[test]
    fn validates_real_git_directories_and_rejects_missing_paths() {
        let temp_dir = std::env::temp_dir().join(format!("branch-schematic-repo-check-{}", std::process::id()));
        std::fs::create_dir_all(&temp_dir).unwrap();

        let repo = git2::Repository::init(&temp_dir).unwrap();
        let _ = repo; // keep the repository alive for the duration of the test

        assert!(is_repository_path_valid(&temp_dir));

        let missing_dir = temp_dir.join("missing-target");
        assert!(!is_repository_path_valid(&missing_dir));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

fn is_repository_path_valid(path: impl AsRef<std::path::Path>) -> bool {
    let path = path.as_ref();
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };

    if !metadata.is_dir() {
        return false;
    }

    git2::Repository::open(path).is_ok()
}

#[tauri::command]
async fn verify_repo_paths(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut checks = tokio::task::JoinSet::new();

    for path in &paths {
        let candidate = path.clone();
        checks.spawn_blocking(move || {
            let is_valid = is_repository_path_valid(&candidate);
            (candidate, is_valid)
        });
    }

    let mut missing_paths = Vec::new();
    while let Some(result) = checks.join_next().await {
        let (path, is_valid) = result.map_err(|error| format!("Failed to verify repository path: {error}"))?;
        if !is_valid {
            missing_paths.push(path);
        }
    }

    Ok(missing_paths)
}

#[tauri::command]
async fn validate_repository_path(path: String) -> Result<bool, String> {
    Ok(tokio::task::spawn_blocking(move || is_repository_path_valid(&path))
        .await
        .map_err(|error| format!("Failed to verify repository path: {error}"))?)
}

#[tauri::command]
async fn get_active_tracked_paths(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::TrackedPathRow>, String> {
    db::fetch_active_tracked_paths(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_canvas_views(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::CanvasViewRow>, String> {
    db::fetch_all_canvas_views(state.inner().pool())
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
    db::create_new_environment_view(state.inner().pool(), &id, &name, zoom_level, pan_x, pan_y)
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
    db::clone_canvas_view(state.inner().pool(), &source_id, &new_id, &new_name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_canvas_view(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<(), String> {
    db::delete_canvas_view(state.inner().pool(), &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn rename_canvas_view(
    state: tauri::State<'_, DbState>,
    view_id: String,
    name: String,
) -> Result<(), String> {
    db::rename_canvas_view(state.inner().pool(), &view_id, &name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_canvas_view_favorite(
    state: tauri::State<'_, DbState>,
    view_id: String,
    is_favorite: bool,
) -> Result<(), String> {
    db::set_canvas_view_favorite(state.inner().pool(), &view_id, is_favorite)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn move_canvas_view_display_order(
    state: tauri::State<'_, DbState>,
    view_id: String,
    direction: i64,
) -> Result<(), String> {
    db::move_canvas_view_display_order(state.inner().pool(), &view_id, direction)
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
    db::update_canvas_viewport_state(state.inner().pool(), &view_id, zoom_level, pan_x, pan_y)
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
    db::snapshot_canvas_view_baseline_viewport(state.inner().pool(), &view_id, baseline_zoom, baseline_pan_x, baseline_pan_y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_canvas_view_card_state(
    state: tauri::State<'_, DbState>,
    view_id: String,
    card_state_json: String,
) -> Result<(), String> {
    db::update_canvas_view_card_state(state.inner().pool(), &view_id, &card_state_json)
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
    db::set_canvas_view_path_visibility(state.inner().pool(), &view_id, &repo_path_id, visible)
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
    db::set_canvas_view_branch_visibility(state.inner().pool(), &view_id, &branch_id, visible)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_canvas_view_scope(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<db::CanvasViewScopeState, String> {
    db::fetch_canvas_view_scope(state.inner().pool(), &view_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_workspace_nodes(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<Vec<db::WorkspaceNodeRow>, String> {
    db::fetch_workspace_nodes(state.inner().pool(), &view_id)
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
    db::update_canvas_card_position(state.inner().pool(), &view_id, &id, x, y)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_manual_edges(
    state: tauri::State<'_, DbState>,
    view_id: String,
) -> Result<Vec<db::CanvasEdgeRow>, String> {
    db::fetch_canvas_manual_edges(state.inner().pool(), &view_id)
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
    db::insert_canvas_manual_edge(state.inner().pool(), &view_id, &id, &source, &target, "BEZIER")
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn delete_manual_edge(
    state: tauri::State<'_, DbState>,
    view_id: String,
    id: String,
) -> Result<(), String> {
    db::delete_canvas_manual_edge(state.inner().pool(), &view_id, &id)
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
    db::update_canvas_card_config(state.inner().pool(), &view_id, &repo_path_id, &view_mode, commit_density, &theme_color_hex, explode_branches)
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
async fn set_repository_theme(
    state: tauri::State<'_, DbState>,
    path_id: String,
    color_hex: Option<String>,
    icon_name: Option<String>,
) -> Result<(), String> {
    let normalized_color = color_hex.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
    });
    let normalized_icon = icon_name.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
    });

    db::update_repository_theme(state.inner().pool(), &path_id, normalized_color.as_deref(), normalized_icon.as_deref())
        .await
        .map_err(|error| format!("Failed to persist repository theme: {error}"))?;

    Ok(())
}

#[tauri::command]
async fn get_branch_commits(
    state: tauri::State<'_, DbState>,
    branch_id: String,
    limit: i64,
) -> Result<Vec<db::CachedCommitRow>, String> {
    db::fetch_branch_commits(state.inner().pool(), &branch_id, limit)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_notifications(state: tauri::State<'_, DbState>) -> Result<Vec<db::NotificationRow>, String> {
    db::fetch_notifications(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_notification(state: tauri::State<'_, DbState>, notification: db::NotificationRow) -> Result<(), String> {
    db::insert_notification(state.inner().pool(), &notification)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn mark_notification_read(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    db::mark_notification_read(state.inner().pool(), &id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn toggle_notification_pin(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    db::toggle_notification_pin(state.inner().pool(), &id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn archive_notification(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    db::archive_notification(state.inner().pool(), &id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn mark_all_notifications_read(state: tauri::State<'_, DbState>) -> Result<(), String> {
    db::mark_all_notifications_read(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn archive_all_notifications(state: tauri::State<'_, DbState>) -> Result<(), String> {
    db::archive_all_notifications(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Generate context cleanly
    let context = tauri::generate_context!();

    // Resolve the app data directory used by Tauri and ensure the migration plugin
    // and the runtime SQLx pool target the exact same SQLite file.
    let app_dir = resolve_app_data_directory();
    let _ = std::fs::create_dir_all(&app_dir);
    let target_db_path = resolve_database_path();
    let _ = ensure_sqlite_db_file(&target_db_path);
    let target_db_url = format!("sqlite:{}", target_db_path.to_string_lossy());
    let migration_db_url = target_db_url.clone();

    tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle().clone();
            let db_path = target_db_path.clone();

            ensure_sqlite_db_file(&db_path).expect("Failed to prepare SQLite database file");
            let connect_options = sqlite_connect_options(&db_path).expect("Failed to build SQLite connection options");

            let app_handle_for_db = handle.clone();
            tauri::async_runtime::block_on(async move {
                let pool = SqlitePool::connect_with(connect_options)
                    .await
                    .expect("Failed to connect to SQLite database");
                app_handle_for_db.manage(DbState(pool));
            });

            let restore_window = db::should_restore_window(&handle);
            let _hide_to_tray = db::should_hide_to_tray(&handle);
            let _start_minimized = db::should_start_minimized(&handle);

            let launch_at_login = db::should_launch_at_login(&handle);
            apply_autostart_preference(&handle, launch_at_login);

            if let Err(error) = setup_tray_icon(&handle) {
                eprintln!("Failed to initialize tray icon: {error}");
            }

            if let Some(window_handle) = app.get_webview_window("main") {
                if restore_window {
                    let _ = window_handle.restore_state(tauri_plugin_window_state::StateFlags::all());
                }

                let _ = window_handle.on_window_event({
                    let app_handle = app.handle().clone();
                    let window_handle = window_handle.clone();
                    move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            let hide_to_tray = db::should_hide_to_tray(&app_handle);
                            let restore_window = db::should_restore_window(&app_handle);
                            if hide_to_tray {
                                api.prevent_close();
                                let _ = window_handle.hide();
                            } else if restore_window {
                                let _ = app_handle.save_window_state(tauri_plugin_window_state::StateFlags::all());
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_filename(WINDOW_STATE_FILE)
                .with_state_flags(tauri_plugin_window_state::StateFlags::empty())
                .skip_initial_state("main")
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&migration_db_url, db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_database_path,
            sync_runtime_settings_command,
            verify_repo_paths,
            validate_repository_path,
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
            git::relink_repository_path,
            git::untrack_repository,
            git::get_tracked_workspaces,
            git::refresh_repository_git_status,
            git::get_repository_changes,
            git::get_repository_file_diff,
            git::stage_repository_paths,
            git::unstage_repository_paths,
            git::create_commit,
            git::git_fetch_operation,
            git::git_pull_operation,
            git::git_push_operation,
            git::list_remote_repositories,
            git::list_enterprise_repositories,
            git::list_remote_branches,
            git::parse_remote_repository_slug,
            git::clone_remote_repository,
            git::set_repository_alias,
            git::set_repository_favorite,
            git::set_repository_origin_type,
            git::set_repository_group,
            set_repository_theme,
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
            auth::get_profiles,
            auth::add_profile,
            auth::update_profile,
            auth::delete_profile,
            auth::check_profile_tokens,
            auth::begin_oauth_loopback_listener,
            auth::exchange_code_for_token,
            get_notifications,
            save_notification,
            mark_notification_read,
            toggle_notification_pin,
            archive_notification,
            mark_all_notifications_read,
            archive_all_notifications,
        ])
        .run(context)
        .expect("error while running tauri application");
}