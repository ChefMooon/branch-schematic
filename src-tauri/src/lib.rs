use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_window_state::{AppHandleExt, WindowExt};

mod auth;
mod db;
mod git;
mod health;
mod layout;
mod manager;
mod refresh;

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
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5))
        .foreign_keys(true))
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
            Some(Image::new_owned(
                rgba.into_vec(),
                icon.width(),
                icon.height(),
            ))
        })
        .or_else(|| app.default_window_icon().cloned())
        .ok_or_else(|| "Unable to locate or decode a tray icon".to_string())?;

    let menu = MenuBuilder::new(app)
        .item(
            &MenuItem::with_id(app, "show-window", "Show window", true, None::<&str>)
                .map_err(|error| format!("Failed to create tray menu item: {error}"))?,
        )
        .item(
            &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
                .map_err(|error| format!("Failed to create quit tray menu item: {error}"))?,
        )
        .build()
        .map_err(|error| format!("Failed to build tray menu: {error}"))?;

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Branch Schematic")
        .menu(&menu)
        .on_menu_event({
            move |app_handle, event| match event.id.as_ref() {
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseStartupInfo {
    status: String,
    message: Option<String>,
    database_path: String,
}

struct DatabaseStartupState(Mutex<DatabaseStartupInfo>);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SingleInstanceActivation {
    args: Vec<String>,
    cwd: String,
}

fn activate_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.restore_state(tauri_plugin_window_state::StateFlags::all());
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn mark_database_recovery_required(app: &tauri::AppHandle, message: String) {
    let startup_state = app.state::<DatabaseStartupState>();
    let mut state = startup_state
        .0
        .lock()
        .expect("database startup state mutex poisoned");
    state.status = "recovery_required".to_string();
    state.message = Some(message);
}

#[tauri::command]
fn get_database_startup_state(
    state: tauri::State<'_, DatabaseStartupState>,
) -> DatabaseStartupInfo {
    state
        .0
        .lock()
        .expect("database startup state mutex poisoned")
        .clone()
}

fn require_database_recovery_state(
    state: &tauri::State<'_, DatabaseStartupState>,
) -> Result<(), String> {
    let status = state
        .0
        .lock()
        .map_err(|_| "database startup state mutex poisoned".to_string())?
        .status
        .clone();
    if status == "recovery_required" {
        Ok(())
    } else {
        Err("Database recovery actions are only available when recovery is required".to_string())
    }
}

#[tauri::command]
fn backup_database_file() -> Result<String, String> {
    let database_path = resolve_database_path();
    if !database_path.exists() {
        return Err("The database file does not exist".to_string());
    }

    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let backup_path = database_path.with_file_name(format!(
        "{}.backup-{timestamp}",
        database_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("branch-schematic.db")
    ));
    std::fs::copy(&database_path, &backup_path)
        .map_err(|error| format!("Failed to back up database: {error}"))?;
    Ok(backup_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn backup_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseStartupState>,
) -> Result<String, String> {
    require_database_recovery_state(&state)?;
    let backup_path = backup_database_file()?;
    let _ = app.emit("database-recovery-backup-created", &backup_path);
    Ok(backup_path)
}

#[tauri::command]
fn reset_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseStartupState>,
) -> Result<String, String> {
    require_database_recovery_state(&state)?;
    let database_path = resolve_database_path();
    let backup_path = if database_path.exists() {
        Some(backup_database_file()?)
    } else {
        None
    };

    for suffix in ["", "-wal", "-shm"] {
        let path = if suffix.is_empty() {
            database_path.clone()
        } else {
            std::path::PathBuf::from(format!("{}{}", database_path.to_string_lossy(), suffix))
        };
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|error| format!("Failed to remove database file: {error}"))?;
        }
    }
    ensure_sqlite_db_file(&database_path)?;

    let message = match backup_path {
        Some(path) => format!("Database reset. Original database backed up to {path}. Restart the app to apply migrations."),
        None => "Database reset. Restart the app to apply migrations.".to_string(),
    };
    mark_database_recovery_required(&app, message.clone());
    Ok(message)
}

#[tauri::command]
fn exit_for_database_recovery(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn refresh_repository_full_command(
    state: tauri::State<'_, DbState>,
    writer: tauri::State<'_, refresh::RepositoryCacheWriter>,
    path_id: String,
    absolute_path: String,
) -> Result<refresh::RefreshOutcome, String> {
    refresh::refresh_repository_full(
        state.inner().pool(),
        writer.inner(),
        &path_id,
        &absolute_path,
    )
    .await
}

#[tauri::command]
async fn ensure_repository_monitored_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    path_id: String,
    absolute_path: String,
) -> Result<(), String> {
    manager
        .ensure_monitored(path_id, absolute_path, manager::RefreshPriority::Background)
        .await
}

#[tauri::command]
async fn begin_repository_detail_session_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    path_id: String,
    absolute_path: String,
    session_id: String,
) -> Result<(), String> {
    manager
        .begin_detail_session(path_id, absolute_path, session_id)
        .await
}

#[tauri::command]
async fn request_repository_refresh_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    path_id: String,
) -> Result<(), String> {
    manager
        .request_refresh(path_id, manager::RefreshPriority::Foreground)
        .await
}

#[tauri::command]
async fn stop_repository_monitoring_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    path_id: String,
) -> Result<(), String> {
    manager.stop_monitored(&path_id).await
}

#[tauri::command]
async fn set_repository_detail_active_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    path_id: String,
    session_id: String,
    active: bool,
) -> Result<(), String> {
    manager
        .set_detail_session(&path_id, &session_id, active)
        .await
}

#[tauri::command]
async fn set_branch_map_visible_repositories_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    repository_ids: Vec<String>,
) -> Result<(), String> {
    manager.set_visible_repositories(repository_ids).await
}

#[tauri::command]
async fn set_selected_repository_command(
    manager: tauri::State<'_, manager::WatcherManager>,
    repository_id: Option<String>,
) -> Result<(), String> {
    manager.set_selected_repository(repository_id).await
}

#[tauri::command]
async fn get_watcher_manager_diagnostics_command(
    manager: tauri::State<'_, manager::WatcherManager>,
) -> Result<manager::ManagerDiagnostics, String> {
    Ok(manager.diagnostics().await)
}

#[tauri::command]
async fn get_watcher_manager_debug_snapshot_command(
    manager: tauri::State<'_, manager::WatcherManager>,
) -> Result<manager::WatcherDebugSnapshot, String> {
    Ok(manager.debug_snapshot().await)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_detail_status_refresh_interval(
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    db::fetch_detail_status_refresh_interval(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn set_detail_status_refresh_interval(
    state: tauri::State<'_, DbState>,
    value: i64,
) -> Result<i64, String> {
    db::update_detail_status_refresh_interval(state.inner().pool(), value)
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_repository_path_valid;

    #[test]
    fn validates_real_git_directories_and_rejects_missing_paths() {
        let temp_dir = std::env::temp_dir().join(format!(
            "branch-schematic-repo-check-{}",
            std::process::id()
        ));
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
        let (path, is_valid) =
            result.map_err(|error| format!("Failed to verify repository path: {error}"))?;
        if !is_valid {
            missing_paths.push(path);
        }
    }

    Ok(missing_paths)
}

#[tauri::command]
async fn validate_repository_path(path: String) -> Result<bool, String> {
    Ok(
        tokio::task::spawn_blocking(move || is_repository_path_valid(&path))
            .await
            .map_err(|error| format!("Failed to verify repository path: {error}"))?,
    )
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
    db::snapshot_canvas_view_baseline_viewport(
        state.inner().pool(),
        &view_id,
        baseline_zoom,
        baseline_pan_x,
        baseline_pan_y,
    )
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
async fn restore_saved_card_locations(
    state: tauri::State<'_, DbState>,
    view_id: String,
    locations: Vec<db::SavedCardLocation>,
) -> Result<db::RestoreCardLocationsResult, String> {
    db::restore_saved_card_locations(state.inner().pool(), &view_id, &locations)
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
    db::insert_canvas_manual_edge(
        state.inner().pool(),
        &view_id,
        &id,
        &source,
        &target,
        "BEZIER",
    )
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
    db::update_canvas_card_config(
        state.inner().pool(),
        &view_id,
        &repo_path_id,
        &view_mode,
        commit_density,
        &theme_color_hex,
        explode_branches,
    )
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
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    let normalized_icon = icon_name.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });

    db::update_repository_theme(
        state.inner().pool(),
        &path_id,
        normalized_color.as_deref(),
        normalized_icon.as_deref(),
    )
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
async fn get_notifications(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::NotificationRow>, String> {
    db::fetch_notifications(state.inner().pool())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_notification(
    state: tauri::State<'_, DbState>,
    notification: db::NotificationRow,
) -> Result<(), String> {
    db::insert_notification(state.inner().pool(), &notification)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn mark_notification_read(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    db::mark_notification_read(state.inner().pool(), &id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn toggle_notification_pin(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
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
    let pending_activations = Arc::new(Mutex::new(Vec::<SingleInstanceActivation>::new()));
    let pending_activations_for_plugin = Arc::clone(&pending_activations);
    let startup_ready = Arc::new(AtomicBool::new(false));
    let startup_ready_for_plugin = Arc::clone(&startup_ready);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(move |app, args, cwd| {
            let activation = SingleInstanceActivation { args, cwd };
            if startup_ready_for_plugin.load(Ordering::Acquire) {
                let _ = app.emit("single-instance-activation", activation);
            } else if let Ok(mut pending) = pending_activations_for_plugin.lock() {
                pending.push(activation);
            }
            activate_main_window(app);
        }))
        .setup(move |app| {
            let handle = app.handle().clone();
            let db_path = target_db_path.clone();
            let database_path = db_path.to_string_lossy().into_owned();

            app.manage(DatabaseStartupState(Mutex::new(DatabaseStartupInfo {
                status: "starting".to_string(),
                message: None,
                database_path,
            })));
            if let Err(error) = ensure_sqlite_db_file(&db_path) {
                mark_database_recovery_required(&handle, error);
                activate_main_window(&handle);
                return Ok(());
            }
            let connect_options = match sqlite_connect_options(&db_path) {
                Ok(options) => options,
                Err(error) => {
                    mark_database_recovery_required(&handle, error);
                    activate_main_window(&handle);
                    return Ok(());
                }
            };

            let database_result = tauri::async_runtime::block_on(async move {
                let pool = SqlitePool::connect_with(connect_options)
                    .await
                    .map_err(|error| format!("Failed to connect to SQLite database: {error}"))?;
                db::validate_schema(&pool).await?;
                Ok::<SqlitePool, String>(pool)
            });

            let pool = match database_result {
                Ok(pool) => pool,
                Err(error) => {
                    mark_database_recovery_required(&handle, error);
                    activate_main_window(&handle);
                    return Ok(());
                }
            };

            handle.manage(DbState(pool));
            let writer = refresh::RepositoryCacheWriter::default();
            handle.manage(writer.clone());
            let watcher_manager = manager::WatcherManager::new(
                handle.state::<DbState>().inner().pool().clone(),
                writer,
            )
            .with_app_handle(handle.clone());
            handle.manage(watcher_manager.clone());
            let startup_manager = watcher_manager.clone();
            let startup_pool = handle.state::<DbState>().inner().pool().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(paths) = db::fetch_active_tracked_paths(&startup_pool).await {
                    startup_manager.register_active_paths(paths).await;
                }
            });
            {
                let startup_state = handle.state::<DatabaseStartupState>();
                let mut state = startup_state
                    .0
                    .lock()
                    .expect("database startup state mutex poisoned");
                state.status = "ready".to_string();
            }

            startup_ready.store(true, Ordering::Release);
            if let Ok(mut pending) = pending_activations.lock() {
                for activation in pending.drain(..) {
                    let _ = handle.emit("single-instance-activation", activation);
                }
            }

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
                    let _ =
                        window_handle.restore_state(tauri_plugin_window_state::StateFlags::all());
                }

                let _ = window_handle.on_window_event({
                    let app_handle = app.handle().clone();
                    let window_handle = window_handle.clone();
                    move |event| match event {
                        tauri::WindowEvent::Focused(true) => {
                            if let Some(manager) = app_handle.try_state::<manager::WatcherManager>()
                            {
                                let manager = manager.inner().clone();
                                tauri::async_runtime::spawn(async move {
                                    manager.recover_after_wake().await;
                                });
                            }
                        }
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            let hide_to_tray = db::should_hide_to_tray(&app_handle);
                            let restore_window = db::should_restore_window(&app_handle);
                            if hide_to_tray {
                                api.prevent_close();
                                let _ = window_handle.hide();
                            } else {
                                if let Some(manager) =
                                    app_handle.try_state::<manager::WatcherManager>()
                                {
                                    let manager = manager.inner().clone();
                                    tauri::async_runtime::spawn(async move {
                                        manager.stop_all().await;
                                    });
                                }
                                if restore_window {
                                    let _ = app_handle.save_window_state(
                                        tauri_plugin_window_state::StateFlags::all(),
                                    );
                                }
                            }
                        }
                        _ => {}
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
            get_database_startup_state,
            refresh_repository_full_command,
            backup_database,
            reset_database,
            exit_for_database_recovery,
            get_detail_status_refresh_interval,
            set_detail_status_refresh_interval,
            sync_runtime_settings_command,
            verify_repo_paths,
            validate_repository_path,
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
            restore_saved_card_locations,
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
            git::get_repository_changes_if_changed,
            git::get_latest_commit,
            git::get_repository_file_diff,
            git::stage_repository_paths,
            git::unstage_repository_paths,
            git::create_commit,
            git::undo_latest_commit,
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
            git::set_repository_pinned,
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
            ensure_repository_monitored_command,
            begin_repository_detail_session_command,
            request_repository_refresh_command,
            stop_repository_monitoring_command,
            set_repository_detail_active_command,
            set_branch_map_visible_repositories_command,
            set_selected_repository_command,
            get_watcher_manager_diagnostics_command,
            get_watcher_manager_debug_snapshot_command,
        ])
        .build(context)
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let Some(manager) = app_handle.try_state::<manager::WatcherManager>() else {
                    return;
                };
                if manager.is_shutting_down() {
                    return;
                }
                api.prevent_exit();
                let manager = manager.inner().clone();
                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    manager.stop_all().await;
                    app_handle.exit(0);
                });
            }
        });
}
