use serde::{Deserialize, Serialize};
use sqlx::migrate::{Migration as SqlxMigration, MigrationType, Migrator};
use sqlx::{FromRow, Row, SqliteConnection, SqlitePool};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use uuid::Uuid;

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct TrackedPathRow {
    pub id: String,
    pub display_name: String,
    pub absolute_path: String,
    pub remote_url: Option<String>,
    pub is_active: i64,
    pub archived_at: Option<String>,
    pub theme_color_hex: Option<String>,
    pub icon_name: Option<String>,
    pub is_pinned: i64,
    pub health_state: String,
    pub is_cache_stale: i64,
    pub last_verified_at: Option<String>,
    pub last_successful_verification_at: Option<String>,
    pub verification_failure_count: i64,
    pub last_verification_error: Option<String>,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct CanvasViewRow {
    pub id: String,
    pub view_name: String,
    pub zoom_level: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    pub is_favorite: i64,
    pub display_order: i64,
    pub card_state_json: Option<String>,
    pub baseline_zoom: Option<f64>,
    pub baseline_pan_x: Option<f64>,
    pub baseline_pan_y: Option<f64>,
    pub created_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CanvasViewScopeState {
    pub visible_path_ids: Vec<String>,
    pub hidden_path_ids: Vec<String>,
    pub branch_visibility: HashMap<String, bool>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedCardLocation {
    pub kind: String,
    pub repo_path_id: String,
    pub branch_id: Option<String>,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RestoreCardLocationsResult {
    pub restored: u64,
    pub skipped: u64,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct WorkspaceNodeRow {
    pub repo_path_id: String,
    pub display_name: String,
    pub explode_branches: i64,
    pub is_explicit_branch: i64,
    pub branch_id: String,
    pub branch_name: String,
    pub is_head: i64,
    pub ahead_count: i64,
    pub behind_count: i64,
    pub last_commit_hash: String,
    pub commit_message: Option<String>,
    pub pos_x: Option<f64>,
    pub pos_y: Option<f64>,
    pub view_mode: String,
    pub commit_density: i64,
    pub theme_color_hex: String,
    pub group_theme_color_hex: Option<String>,
    pub tags_json: Option<String>,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct RepoTagRow {
    pub id: String,
    pub tag_name: String,
    pub color_hex: String,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct TagFilterSummaryRow {
    pub id: String,
    pub tag_name: String,
    pub color_hex: String,
    pub repo_count: i64,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct CustomGroupRow {
    pub id: String,
    pub group_name: String,
    pub color_hex: String,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct GroupSummaryRow {
    pub id: String,
    pub group_name: String,
    pub color_hex: String,
    pub repo_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataExport {
    pub format: String,
    pub version: i64,
    pub exported_at: String,
    pub repositories: Vec<WorkspaceMetadataRepository>,
    pub groups: Vec<WorkspaceMetadataGroup>,
    pub tags: Vec<WorkspaceMetadataTag>,
    pub assignments: Vec<WorkspaceMetadataAssignment>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataRepository {
    pub id: String,
    pub display_name: String,
    pub alias_name: Option<String>,
    pub absolute_path: String,
    pub remote_url: Option<String>,
    pub repo_origin_type: String,
    pub group_id: Option<String>,
    pub is_favorite: i64,
    pub theme_color_hex: Option<String>,
    pub icon_name: Option<String>,
    pub is_pinned: i64,
    pub is_active: i64,
    pub archived_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataGroup {
    pub id: String,
    pub group_name: String,
    pub color_hex: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataTag {
    pub id: String,
    pub tag_name: String,
    pub color_hex: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataAssignment {
    pub repository_id: String,
    pub tag_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationExport {
    pub format: String,
    pub version: i64,
    pub exported_at: String,
    pub workspace: WorkspaceMetadataExport,
    pub preferences: PortablePreferences,
    pub views: Vec<ApplicationExportView>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortablePreferences {
    pub theme: String,
    pub detail_status_refresh_interval: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationExportView {
    pub id: String,
    pub view_name: String,
    pub zoom_level: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    pub is_favorite: i64,
    pub display_order: i64,
    pub card_state_json: Option<String>,
    pub baseline_zoom: Option<f64>,
    pub baseline_pan_x: Option<f64>,
    pub baseline_pan_y: Option<f64>,
    pub created_at: String,
    pub archived_at: Option<String>,
    pub repository_cards: Vec<ApplicationExportRepositoryCard>,
    pub visible_paths: Vec<ApplicationExportPathVisibility>,
    pub manual_edges: Vec<ApplicationExportEdge>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationExportRepositoryCard {
    pub repository_path: String,
    pub pos_x: f64,
    pub pos_y: f64,
    pub view_mode: String,
    pub commit_density: i64,
    pub theme_color_hex: String,
    pub explode_branches: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationExportPathVisibility {
    pub repository_path: String,
    pub is_visible: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationExportEdge {
    pub id: String,
    pub source_repository_path: String,
    pub target_repository_path: String,
    pub edge_style: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnavailableRepositoryDetails {
    pub id: String,
    pub display_name: String,
    pub absolute_path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub imported_repositories: usize,
    pub new_repositories: usize,
    pub existing_repositories: usize,
    pub restored_archived_repositories: usize,
    pub imported_views: usize,
    pub new_views: usize,
    pub existing_views: usize,
    pub skipped_views: usize,
    pub unavailable_repositories: Vec<String>,
    pub unavailable_repository_details: Vec<UnavailableRepositoryDetails>,
    pub skipped_layout_records: usize,
    pub conflicts: Vec<String>,
}

#[derive(Default)]
struct ImportRepositoryCounts {
    new_repositories: usize,
    existing_repositories: usize,
    restored_archived_repositories: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct QuickFilterMetadata {
    pub groups: Vec<String>,
    pub favorites_count: i64,
    pub tags: Vec<TagFilterSummaryRow>,
    pub dangling_tags: Vec<TagFilterSummaryRow>,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct CachedCommitRow {
    pub commit_hash: String,
    pub author_name: String,
    pub commit_message: String,
    pub committed_at: String,
    pub signature_status: Option<String>,
    pub push_state: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct CachedBranchContext {
    pub branch_name: String,
    pub absolute_path: String,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct CanvasEdgeRow {
    pub id: String,
    pub source_repo_id: String,
    pub target_repo_id: String,
    pub edge_style: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRow {
    pub id: String,
    pub title: String,
    pub message: String,
    pub variant: String,
    pub is_read: i64,
    pub is_pinned: i64,
    pub is_archived: i64,
    pub created_at: String,
    pub route: Option<String>,
    pub route_params_json: Option<String>,
}

#[cfg(debug_assertions)]
pub const DB_NAME: &str = "branch-schematic-dev.db";
#[cfg(not(debug_assertions))]
pub const DB_NAME: &str = "branch-schematic.db";

pub const EXPECTED_SCHEMA_VERSION: i64 = 7;
pub const ONBOARDING_VERSION: i64 = 1;
pub const DEFAULT_DETAIL_STATUS_REFRESH_INTERVAL: i64 = 5;
pub const MIN_DETAIL_STATUS_REFRESH_INTERVAL: i64 = 2;
pub const MAX_DETAIL_STATUS_REFRESH_INTERVAL: i64 = 5;

pub fn get_app_data_db_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to resolve App Data directory");
    let _ = std::fs::create_dir_all(&app_dir);
    app_dir.join(DB_NAME)
}

pub fn get_app_data_db_url(app: &tauri::AppHandle) -> String {
    format!("sqlite:{}", get_app_data_db_path(app).to_string_lossy())
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_settings_table",
            sql: "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                hide_to_tray INTEGER DEFAULT 0,
                restore_window INTEGER DEFAULT 1,
                launch_at_login INTEGER DEFAULT 0,
                start_minimized INTEGER DEFAULT 0,
                theme TEXT DEFAULT 'system',
                detail_status_refresh_interval INTEGER NOT NULL DEFAULT 5
            );
            INSERT OR IGNORE INTO settings (id, hide_to_tray, restore_window, launch_at_login, start_minimized, theme) 
            VALUES (1, 0, 1, 0, 0, 'system');",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_core_workspace_tables",
            sql: "
            -- Multi-directory local path tracks
            CREATE TABLE IF NOT EXISTS tracked_paths (
                id TEXT PRIMARY KEY NOT NULL,
                display_name TEXT NOT NULL,
                alias_name TEXT,
                absolute_path TEXT NOT NULL UNIQUE,
                remote_url TEXT,
                
                repo_origin_type TEXT NOT NULL DEFAULT 'LOCAL_ONLY', -- Values: 'OWNED', 'FORK', 'CONTRIBUTOR', 'LOCAL_ONLY'
                uncommitted_changes_count INTEGER NOT NULL DEFAULT 0,
                last_viewed_at DATETIME DEFAULT NULL,
                group_id TEXT DEFAULT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                last_accessed_at TEXT DEFAULT NULL,
                default_branch_name TEXT DEFAULT NULL,

                theme_color_hex TEXT DEFAULT NULL,
                icon_name TEXT DEFAULT NULL,
                github_owner_login TEXT DEFAULT NULL,

                is_pinned INTEGER NOT NULL DEFAULT 0,
                health_state TEXT NOT NULL DEFAULT 'unverified',
                is_cache_stale INTEGER NOT NULL DEFAULT 1,
                last_verified_at DATETIME DEFAULT NULL,
                last_successful_verification_at DATETIME DEFAULT NULL,
                verification_failure_count INTEGER NOT NULL DEFAULT 0,
                last_verification_error TEXT DEFAULT NULL,
                
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                archived_at DATETIME DEFAULT NULL,
                FOREIGN KEY(group_id) REFERENCES custom_groups(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_active ON tracked_paths(is_active) WHERE archived_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_recent ON tracked_paths(last_viewed_at) WHERE last_viewed_at IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_last_accessed ON tracked_paths(last_accessed_at) WHERE last_accessed_at IS NOT NULL;

            CREATE TABLE IF NOT EXISTS custom_groups (
                id TEXT PRIMARY KEY NOT NULL,
                group_name TEXT UNIQUE NOT NULL,
                color_hex TEXT NOT NULL DEFAULT '#64748B',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS global_tags (
                id TEXT PRIMARY KEY NOT NULL,
                tag_name TEXT UNIQUE NOT NULL,
                color_hex TEXT NOT NULL DEFAULT '#3B82F6'
            );

            CREATE TABLE IF NOT EXISTS tracked_path_tags (
                repo_path_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (repo_path_id, tag_id),
                FOREIGN KEY(repo_path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES global_tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_tracked_path_tags_tag_id ON tracked_path_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_tracked_path_tags_repo_path_id ON tracked_path_tags(repo_path_id);

            -- Spatial View presets
            CREATE TABLE IF NOT EXISTS canvas_views (
                id TEXT PRIMARY KEY NOT NULL,
                view_name TEXT NOT NULL,
                zoom_level REAL NOT NULL DEFAULT 1.0,
                pan_x REAL NOT NULL DEFAULT 0.0,
                pan_y REAL NOT NULL DEFAULT 0.0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                display_order INTEGER NOT NULL DEFAULT 0,
                card_state_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                archived_at DATETIME DEFAULT NULL,
                baseline_zoom REAL DEFAULT NULL,
                baseline_pan_x REAL DEFAULT NULL,
                baseline_pan_y REAL DEFAULT NULL
            );
            INSERT OR IGNORE INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order)
            VALUES ('default-workspace-view', 'Default Workspace', 1.0, 0.0, 0.0, 1, 0);

            -- Daemon local cache index tables
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                variant TEXT NOT NULL DEFAULT 'info',
                is_read INTEGER NOT NULL DEFAULT 0,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                route TEXT,
                route_params_json TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_unarchived ON notifications(is_archived, created_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_pinned ON notifications(is_pinned DESC, created_at);

            CREATE TABLE IF NOT EXISTS cached_git_branches (
                id TEXT PRIMARY KEY NOT NULL,
                path_id TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                is_head INTEGER NOT NULL DEFAULT 0,
                ahead_count INTEGER NOT NULL DEFAULT 0,
                behind_count INTEGER NOT NULL DEFAULT 0,
                has_upstream INTEGER NOT NULL DEFAULT 0,
                ahead_of_default_count INTEGER NOT NULL DEFAULT 0,
                behind_default_count INTEGER NOT NULL DEFAULT 0,
                last_commit_hash TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_path_branch ON cached_git_branches(path_id, branch_name);

            CREATE TABLE IF NOT EXISTS canvas_view_visible_paths (
                view_id TEXT NOT NULL,
                repo_path_id TEXT NOT NULL,
                is_visible INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (view_id, repo_path_id),
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(repo_path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS canvas_view_visible_branches (
                view_id TEXT NOT NULL,
                branch_id TEXT NOT NULL,
                is_visible INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (view_id, branch_id),
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cached_git_commits (
                commit_hash TEXT PRIMARY KEY NOT NULL,
                branch_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                commit_message TEXT NOT NULL,
                committed_at DATETIME NOT NULL,
                signature_status TEXT DEFAULT 'NONE',
                FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );

            -- Component layout rendering definitions (Decoupled coordinates)
            CREATE TABLE IF NOT EXISTS canvas_view_cards (
                view_id TEXT NOT NULL,
                repo_path_id TEXT NOT NULL,
                pos_x REAL NOT NULL DEFAULT 0.0,
                pos_y REAL NOT NULL DEFAULT 0.0,
                view_mode TEXT NOT NULL DEFAULT 'EXPANDED',
                commit_density INTEGER NOT NULL DEFAULT 5,
                theme_color_hex TEXT DEFAULT '#4F46E5',
                explode_branches INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (view_id, repo_path_id),
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(repo_path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
            );

            -- Branch-level layout overrides used by exploded branch mode
            CREATE TABLE IF NOT EXISTS canvas_view_branch_cards (
                view_id TEXT NOT NULL,
                branch_id TEXT NOT NULL,
                pos_x REAL NOT NULL DEFAULT 0.0,
                pos_y REAL NOT NULL DEFAULT 0.0,
                PRIMARY KEY (view_id, branch_id),
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );

            -- Custom user drawn manual relational lines
            CREATE TABLE IF NOT EXISTS canvas_manual_edges (
                id TEXT PRIMARY KEY NOT NULL,
                view_id TEXT NOT NULL,
                source_repo_id TEXT NOT NULL,
                target_repo_id TEXT NOT NULL,
                edge_style TEXT NOT NULL DEFAULT 'BEZIER',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(source_repo_id) REFERENCES tracked_paths(id) ON DELETE CASCADE,
                FOREIGN KEY(target_repo_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS auth_profiles (
                id TEXT PRIMARY KEY NOT NULL,
                profile_name TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                auth_level TEXT CHECK(auth_level IN ('basic', 'local_system', 'full_oauth')) NOT NULL,
                commit_name TEXT NOT NULL,
                commit_email TEXT NOT NULL,
                github_username TEXT,
                github_avatar_url TEXT,
                api_base_url TEXT NOT NULL DEFAULT 'https://api.github.com'
            );
            CREATE INDEX IF NOT EXISTS idx_auth_profiles_active ON auth_profiles(is_active);

            CREATE TABLE IF NOT EXISTS profile_repo_scopes (
                repo_path_id TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                PRIMARY KEY (repo_path_id, profile_id),
                FOREIGN KEY(repo_path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE,
                FOREIGN KEY(profile_id) REFERENCES auth_profiles(id) ON DELETE CASCADE
            );

            INSERT OR IGNORE INTO auth_profiles (
                id,
                profile_name,
                is_active,
                is_favorite,
                auth_level,
                commit_name,
                commit_email,
                github_username,
                github_avatar_url,
                api_base_url
            ) VALUES (
                'local-basic-profile',
                'Local workspace',
                1,
                0,
                'basic',
                'Local user',
                'local@example.com',
                NULL,
                NULL,
                'https://api.github.com'
            );
            PRAGMA user_version = 2;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_commit_branch_mapping_table",
            sql: "
            CREATE TABLE IF NOT EXISTS cached_git_commit_branches (
                commit_hash TEXT NOT NULL,
                branch_id TEXT NOT NULL,
                PRIMARY KEY (commit_hash, branch_id),
                FOREIGN KEY(commit_hash) REFERENCES cached_git_commits(commit_hash) ON DELETE CASCADE,
                FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_cached_git_commit_branches_branch_id ON cached_git_commit_branches(branch_id);
            CREATE INDEX IF NOT EXISTS idx_cached_git_commit_branches_commit_hash ON cached_git_commit_branches(commit_hash);
            PRAGMA user_version = 3;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "remove_default_canvas_view",
            sql: "
            DELETE FROM canvas_views WHERE id = 'default-workspace-view';
            PRAGMA user_version = 4;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_onboarding_state",
            sql: "
            ALTER TABLE settings ADD COLUMN onboarding_version INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE settings ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'not_started'
                CHECK (onboarding_status IN ('not_started', 'skipped', 'completed'));
            PRAGMA user_version = 5;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_unpushed_commit_count",
            sql: "
            ALTER TABLE cached_git_branches ADD COLUMN unpushed_commit_count INTEGER DEFAULT NULL;
            PRAGMA user_version = 6;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "replace_ambiguous_profile_scopes_with_repository_assignments",
            sql: "
            -- Alpha data may contain ambiguous many-to-many identities. Do not migrate it.
            DROP TABLE IF EXISTS profile_repo_scopes;
            CREATE TABLE IF NOT EXISTS repository_profile_assignments (
                repo_path_id TEXT PRIMARY KEY NOT NULL,
                profile_id TEXT NOT NULL,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(repo_path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE,
                FOREIGN KEY(profile_id) REFERENCES auth_profiles(id) ON DELETE RESTRICT
            );
            CREATE INDEX IF NOT EXISTS idx_repository_profile_assignments_profile
                ON repository_profile_assignments(profile_id);
            PRAGMA user_version = 7;
            ",
            kind: MigrationKind::Up,
        },
    ]
}

#[derive(Debug, Serialize, Clone, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub onboarding_version: i64,
    pub onboarding_status: String,
}

pub async fn fetch_onboarding_state(pool: &SqlitePool) -> Result<OnboardingState, sqlx::Error> {
    sqlx::query_as::<_, OnboardingState>(
        "SELECT onboarding_version, onboarding_status FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
}

pub async fn update_onboarding_state(
    pool: &SqlitePool,
    status: &str,
) -> Result<OnboardingState, String> {
    if !matches!(status, "skipped" | "completed") {
        return Err(format!("Unsupported onboarding status: {status}"));
    }

    sqlx::query("UPDATE settings SET onboarding_version = ?, onboarding_status = ? WHERE id = 1")
        .bind(ONBOARDING_VERSION)
        .bind(status)
        .execute(pool)
        .await
        .map_err(|error| format!("Failed to save onboarding state: {error}"))?;

    fetch_onboarding_state(pool)
        .await
        .map_err(|error| format!("Failed to read onboarding state: {error}"))
}

pub async fn migrate_database(pool: &SqlitePool) -> Result<(), String> {
    let migrations = get_migrations()
        .into_iter()
        .map(|migration| {
            SqlxMigration::new(
                migration.version,
                migration.description.into(),
                MigrationType::ReversibleUp,
                migration.sql.into(),
                false,
            )
        })
        .collect();
    let migrator = Migrator {
        migrations: Cow::Owned(migrations),
        ..Migrator::DEFAULT
    };

    migrator
        .run(pool)
        .await
        .map_err(|error| format!("Failed to migrate SQLite database: {error}"))
}

pub fn clamp_detail_status_refresh_interval(value: i64) -> i64 {
    value.clamp(
        MIN_DETAIL_STATUS_REFRESH_INTERVAL,
        MAX_DETAIL_STATUS_REFRESH_INTERVAL,
    )
}

pub async fn fetch_detail_status_refresh_interval(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let value: Option<i64> =
        sqlx::query_scalar("SELECT detail_status_refresh_interval FROM settings WHERE id = 1")
            .fetch_optional(pool)
            .await?;
    Ok(clamp_detail_status_refresh_interval(
        value.unwrap_or(DEFAULT_DETAIL_STATUS_REFRESH_INTERVAL),
    ))
}

pub async fn update_detail_status_refresh_interval(
    pool: &SqlitePool,
    value: i64,
) -> Result<i64, sqlx::Error> {
    let clamped_value = clamp_detail_status_refresh_interval(value);
    sqlx::query("UPDATE settings SET detail_status_refresh_interval = ? WHERE id = 1")
        .bind(clamped_value)
        .execute(pool)
        .await?;
    Ok(clamped_value)
}

pub async fn validate_schema(pool: &SqlitePool) -> Result<(), String> {
    let user_version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(pool)
        .await
        .map_err(|error| format!("Unable to read SQLite user_version: {error}"))?;
    if user_version != EXPECTED_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported SQLite user_version {user_version}; expected {EXPECTED_SCHEMA_VERSION}"
        ));
    }

    let applied_version: Option<i64> =
        sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1")
            .fetch_one(pool)
            .await
            .map_err(|error| format!("Unable to read applied migrations: {error}"))?;
    if applied_version != Some(EXPECTED_SCHEMA_VERSION) {
        return Err(format!(
            "Unsupported applied migration version {applied_version:?}; expected {EXPECTED_SCHEMA_VERSION}"
        ));
    }

    let required_columns = [
        (
            "settings",
            [
                "id",
                "detail_status_refresh_interval",
                "onboarding_version",
                "onboarding_status",
            ]
            .as_slice(),
        ),
        (
            "tracked_paths",
            [
                "id",
                "absolute_path",
                "is_active",
                "is_pinned",
                "health_state",
                "is_cache_stale",
                "last_verified_at",
                "last_successful_verification_at",
                "verification_failure_count",
                "last_verification_error",
            ]
            .as_slice(),
        ),
        (
            "cached_git_commit_branches",
            ["commit_hash", "branch_id"].as_slice(),
        ),
    ];

    for (table, columns) in required_columns {
        let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
            .fetch_all(pool)
            .await
            .map_err(|error| format!("Unable to inspect table {table}: {error}"))?;
        let actual_columns: HashSet<String> = rows
            .iter()
            .map(|row| row.get::<String, _>("name").to_ascii_lowercase())
            .collect();
        if columns
            .iter()
            .any(|column| !actual_columns.contains(*column))
        {
            let missing = columns
                .iter()
                .filter(|column| !actual_columns.contains(**column))
                .copied()
                .collect::<Vec<_>>()
                .join(", ");
            return Err(format!(
                "Table {table} is missing required columns: {missing}"
            ));
        }
    }

    for index in [
        "idx_tracked_paths_active",
        "idx_unique_path_branch",
        "idx_cached_git_commit_branches_branch_id",
        "idx_cached_git_commit_branches_commit_hash",
    ] {
        let exists: Option<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
                .bind(index)
                .fetch_optional(pool)
                .await
                .map_err(|error| format!("Unable to inspect required index {index}: {error}"))?;
        if exists.is_none() {
            return Err(format!("Required SQLite index is missing: {index}"));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        clamp_detail_status_refresh_interval, create_new_environment_view, export_application,
        export_workspace_metadata, fetch_all_canvas_views, fetch_canvas_view_scope,
        fetch_workspace_nodes, get_migrations, import_application, import_workspace_metadata,
        migrate_database, repair_hidden_tracked_paths, set_canvas_view_path_visibility,
        validate_schema,
    };
    use sqlx::migrate::{Migration as SqlxMigration, MigrationType, Migrator};
    use sqlx::sqlite::SqlitePool;
    use std::borrow::Cow;

    #[test]
    fn clamps_detail_status_refresh_interval_to_contract_bounds() {
        assert_eq!(clamp_detail_status_refresh_interval(0), 2);
        assert_eq!(clamp_detail_status_refresh_interval(3), 3);
        assert_eq!(clamp_detail_status_refresh_interval(9), 5);
    }

    #[tokio::test]
    async fn migrates_and_validates_fresh_reset_schema() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&pool).await.unwrap();
        validate_schema(&pool).await.unwrap();

        let canvas_view_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM canvas_views WHERE archived_at IS NULL")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(canvas_view_count, 0);

        let interval: i64 =
            sqlx::query_scalar("SELECT detail_status_refresh_interval FROM settings WHERE id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(interval, 5);

        sqlx::query(
            "INSERT INTO tracked_paths (id, display_name, absolute_path)
             VALUES ('stage-1-test', 'Stage 1 Test', 'C:/stage-1-test')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let health_defaults: (i64, String, i64, i64) = sqlx::query_as(
            "SELECT is_pinned, health_state, is_cache_stale, verification_failure_count
             FROM tracked_paths
             LIMIT 1",
        )
        .fetch_optional(&pool)
        .await
        .unwrap()
        .unwrap_or((0, "unverified".to_string(), 1, 0));
        assert_eq!(health_defaults, (0, "unverified".to_string(), 1, 0));
    }

    #[tokio::test]
    async fn new_views_start_empty_and_require_explicit_repository_visibility() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO tracked_paths (id, display_name, absolute_path)
             VALUES ('repo-1', 'Repository', 'C:/repos/repository')",
        )
        .execute(&pool)
        .await
        .unwrap();

        create_new_environment_view(&pool, "view-1", "Workspace", 1.0, 0.0, 0.0)
            .await
            .unwrap();

        let visible_path_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM canvas_view_visible_paths WHERE view_id = 'view-1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(visible_path_count, 0);

        let scope = fetch_canvas_view_scope(&pool, "view-1").await.unwrap();
        assert!(scope.visible_path_ids.is_empty());
        assert_eq!(scope.hidden_path_ids, vec!["repo-1"]);
        assert!(fetch_workspace_nodes(&pool, "view-1")
            .await
            .unwrap()
            .is_empty());

        set_canvas_view_path_visibility(&pool, "view-1", "repo-1", true)
            .await
            .unwrap();

        let scope = fetch_canvas_view_scope(&pool, "view-1").await.unwrap();
        assert_eq!(scope.visible_path_ids, vec!["repo-1"]);
        assert!(scope.hidden_path_ids.is_empty());
        assert_eq!(
            fetch_workspace_nodes(&pool, "view-1").await.unwrap().len(),
            1
        );
    }

    #[tokio::test]
    async fn migration_four_removes_legacy_default_view_without_recreating_it() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let migrations = get_migrations()
            .into_iter()
            .take(3)
            .map(|migration| {
                SqlxMigration::new(
                    migration.version,
                    migration.description.into(),
                    MigrationType::ReversibleUp,
                    migration.sql.into(),
                    false,
                )
            })
            .collect();
        Migrator {
            migrations: Cow::Owned(migrations),
            ..Migrator::DEFAULT
        }
        .run(&pool)
        .await
        .unwrap();

        let legacy_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM canvas_views WHERE id = 'default-workspace-view'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(legacy_count, 1);

        migrate_database(&pool).await.unwrap();

        let views = fetch_all_canvas_views(&pool).await.unwrap();
        assert!(views.is_empty());
    }

    #[tokio::test]
    async fn workspace_metadata_round_trips_groups_tags_and_assignments() {
        let source = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&source).await.unwrap();
        sqlx::query(
            "INSERT INTO custom_groups (id, group_name, color_hex, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind("group-1")
        .bind("Clients")
        .bind("#123456")
        .bind("2026-01-01T00:00:00Z")
        .execute(&source)
        .await
        .unwrap();
        sqlx::query("INSERT INTO tracked_paths (id, display_name, absolute_path, group_id) VALUES (?, ?, ?, ?)")
            .bind("repo-1")
            .bind("Repository")
            .bind("C:/repos/repository")
            .bind("group-1")
            .execute(&source)
            .await
            .unwrap();
        sqlx::query("INSERT INTO global_tags (id, tag_name, color_hex) VALUES (?, ?, ?)")
            .bind("tag-1")
            .bind("Important")
            .bind("#654321")
            .execute(&source)
            .await
            .unwrap();
        sqlx::query("INSERT INTO tracked_path_tags (repo_path_id, tag_id) VALUES (?, ?)")
            .bind("repo-1")
            .bind("tag-1")
            .execute(&source)
            .await
            .unwrap();

        let export = export_workspace_metadata(&source).await.unwrap();
        let destination = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&destination).await.unwrap();
        import_workspace_metadata(&destination, &export)
            .await
            .unwrap();

        let group_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM custom_groups WHERE group_name = 'Clients'")
                .fetch_one(&destination)
                .await
                .unwrap();
        let assignment_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tracked_path_tags
             JOIN tracked_paths ON tracked_paths.id = tracked_path_tags.repo_path_id
             JOIN global_tags ON global_tags.id = tracked_path_tags.tag_id
             WHERE tracked_paths.absolute_path = 'C:/repos/repository' AND global_tags.tag_name = 'Important'",
        )
        .fetch_one(&destination)
        .await
        .unwrap();
        assert_eq!(group_count, 1);
        assert_eq!(assignment_count, 1);
    }

    #[tokio::test]
    async fn application_export_excludes_archived_and_hidden_repositories() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active, archived_at)
             VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
        )
        .bind("active")
        .bind("Active")
        .bind("C:/active")
        .bind(1)
        .bind(None::<String>)
        .bind("archived")
        .bind("Archived")
        .bind("C:/archived")
        .bind(0)
        .bind(Some("2026-08-13T00:00:00Z"))
        .bind("hidden")
        .bind("Hidden")
        .bind("C:/hidden")
        .bind(0)
        .bind(None::<String>)
        .execute(&pool)
        .await
        .unwrap();

        let export = export_application(&pool).await.unwrap();
        assert_eq!(export.workspace.repositories.len(), 1);
        assert_eq!(export.workspace.repositories[0].id, "active");
    }

    #[tokio::test]
    async fn hidden_repository_repair_is_idempotent_and_archives_rows() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active)
             VALUES ('hidden', 'Hidden', 'C:/hidden', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(repair_hidden_tracked_paths(&pool).await.unwrap(), 1);
        assert_eq!(repair_hidden_tracked_paths(&pool).await.unwrap(), 0);
        let archived_at: Option<String> =
            sqlx::query_scalar("SELECT archived_at FROM tracked_paths WHERE id = 'hidden'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(archived_at.is_some());
    }

    #[tokio::test]
    async fn application_import_round_trips_visibility_and_manual_edges() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        migrate_database(&pool).await.unwrap();
        let repository_a = std::env::temp_dir().join("branch-schematic-roundtrip-a");
        let repository_b = std::env::temp_dir().join("branch-schematic-roundtrip-b");
        std::fs::create_dir_all(&repository_a).unwrap();
        std::fs::create_dir_all(&repository_b).unwrap();
        let path_a = repository_a.to_string_lossy().to_string();
        let path_b = repository_b.to_string_lossy().to_string();

        for (id, name, path) in [
            ("repo-a", "Repository A", &path_a),
            ("repo-b", "Repository B", &path_b),
        ] {
            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active)
                 VALUES (?, ?, ?, 1)",
            )
            .bind(id)
            .bind(name)
            .bind(path)
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query(
            "INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order)
             VALUES ('roundtrip-view', 'Roundtrip', 1.0, 0.0, 0.0, 1, 0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO canvas_view_cards (view_id, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches)
             VALUES ('roundtrip-view', 'repo-a', 10.0, 20.0, 'default', 3, '#123456', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
             VALUES ('roundtrip-view', 'repo-a', 1), ('roundtrip-view', 'repo-b', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO canvas_manual_edges (id, view_id, source_repo_id, target_repo_id, edge_style)
             VALUES ('edge-roundtrip', 'roundtrip-view', 'repo-a', 'repo-b', 'STRAIGHT')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let export = export_application(&pool).await.unwrap();
        sqlx::query("DELETE FROM canvas_view_visible_paths WHERE view_id = 'roundtrip-view'")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM canvas_manual_edges WHERE view_id = 'roundtrip-view'")
            .execute(&pool)
            .await
            .unwrap();

        let summary = import_application(&pool, &export).await.unwrap();
        assert_eq!(summary.imported_repositories, 2);
        assert_eq!(summary.imported_views, 1);
        assert_eq!(summary.skipped_layout_records, 0);

        let visibility: Vec<(String, i64)> = sqlx::query_as(
            "SELECT repo_path_id, is_visible FROM canvas_view_visible_paths
             WHERE view_id = 'roundtrip-view' ORDER BY repo_path_id",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(
            visibility,
            vec![("repo-a".to_string(), 1), ("repo-b".to_string(), 0)]
        );

        let edge: (String, String, String) = sqlx::query_as(
            "SELECT source_repo_id, target_repo_id, edge_style FROM canvas_manual_edges
             WHERE id = 'edge-roundtrip'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            edge,
            (
                "repo-a".to_string(),
                "repo-b".to_string(),
                "STRAIGHT".to_string()
            )
        );
    }
}

pub fn read_bool_setting(app: &tauri::AppHandle, column: &str) -> bool {
    let column_owned = column.to_string();
    let db_url = get_app_data_db_url(app);

    tauri::async_runtime::block_on(async move {
        let pool = SqlitePool::connect(&db_url).await.ok()?;
        let query_str = format!("SELECT {} FROM settings WHERE id = 1", column_owned);
        let value: i64 = sqlx::query_scalar(&query_str).fetch_one(&pool).await.ok()?;
        pool.close().await;
        Some(value != 0)
    })
    .unwrap_or(false)
}

pub fn should_restore_window(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "restore_window")
}

pub fn should_hide_to_tray(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "hide_to_tray")
}

pub fn should_start_minimized(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "start_minimized")
}

pub fn should_launch_at_login(app: &tauri::AppHandle) -> bool {
    read_bool_setting(app, "launch_at_login")
}

pub async fn fetch_active_tracked_paths(
    pool: &SqlitePool,
) -> Result<Vec<TrackedPathRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TrackedPathRow>(
        "SELECT id, display_name, absolute_path, remote_url, is_active, archived_at, theme_color_hex, icon_name, is_pinned, health_state, is_cache_stale, last_verified_at, last_successful_verification_at, verification_failure_count, last_verification_error FROM tracked_paths WHERE is_active = 1 AND archived_at IS NULL ORDER BY display_name ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn fetch_archived_tracked_paths(
    pool: &SqlitePool,
) -> Result<Vec<TrackedPathRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TrackedPathRow>(
        "SELECT id, display_name, absolute_path, remote_url, is_active, archived_at, theme_color_hex, icon_name, is_pinned, health_state, is_cache_stale, last_verified_at, last_successful_verification_at, verification_failure_count, last_verification_error FROM tracked_paths WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, display_name ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn ensure_canvas_view_exists(
    pool: &SqlitePool,
    view_id: &str,
    view_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order)
         VALUES (?, ?, 1.0, 0.0, 0.0, 0, COALESCE((SELECT MAX(display_order) + 1 FROM canvas_views), 0));",
    )
    .bind(view_id)
    .bind(view_name)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn fetch_all_canvas_views(pool: &SqlitePool) -> Result<Vec<CanvasViewRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CanvasViewRow>(
        "SELECT id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order, card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y, created_at, archived_at FROM canvas_views WHERE archived_at IS NULL ORDER BY is_favorite DESC, display_order ASC, created_at ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn fetch_archived_canvas_views(
    pool: &SqlitePool,
) -> Result<Vec<CanvasViewRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CanvasViewRow>(
        "SELECT id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order, card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y, created_at, archived_at FROM canvas_views WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn restore_canvas_view(pool: &SqlitePool, view_id: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query(
        "UPDATE canvas_views
         SET archived_at = NULL,
             display_order = COALESCE((SELECT MAX(display_order) + 1 FROM canvas_views WHERE archived_at IS NULL), 0)
         WHERE id = ? AND archived_at IS NOT NULL;",
    )
    .bind(view_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn purge_canvas_view(pool: &SqlitePool, view_id: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query("DELETE FROM canvas_views WHERE id = ? AND archived_at IS NOT NULL;")
        .bind(view_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn update_canvas_viewport_state(
    pool: &SqlitePool,
    view_id: &str,
    zoom_level: f64,
    pan_x: f64,
    pan_y: f64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE canvas_views SET zoom_level = ?, pan_x = ?, pan_y = ? WHERE id = ?;")
        .bind(zoom_level)
        .bind(pan_x)
        .bind(pan_y)
        .bind(view_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn snapshot_canvas_view_baseline_viewport(
    pool: &SqlitePool,
    view_id: &str,
    baseline_zoom: f64,
    baseline_pan_x: f64,
    baseline_pan_y: f64,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    sqlx::query(
        "UPDATE canvas_views
         SET baseline_zoom = ?, baseline_pan_x = ?, baseline_pan_y = ?
         WHERE id = ?;",
    )
    .bind(baseline_zoom)
    .bind(baseline_pan_x)
    .bind(baseline_pan_y)
    .bind(view_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_canvas_view_card_state(
    pool: &SqlitePool,
    view_id: &str,
    card_state_json: &str,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    sqlx::query(
        "UPDATE canvas_views
         SET card_state_json = ?
         WHERE id = ?;",
    )
    .bind(card_state_json)
    .bind(view_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_canvas_view_path_visibility(
    pool: &SqlitePool,
    view_id: &str,
    repo_path_id: &str,
    visible: bool,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    sqlx::query(
        "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
         VALUES (?, ?, ?)
         ON CONFLICT(view_id, repo_path_id) DO UPDATE SET
            is_visible = excluded.is_visible;",
    )
    .bind(view_id)
    .bind(repo_path_id)
    .bind(if visible { 1_i64 } else { 0_i64 })
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn set_canvas_view_branch_visibility(
    pool: &SqlitePool,
    view_id: &str,
    branch_key: &str,
    visible: bool,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    let branch_id = resolve_branch_visibility_key(pool, branch_key)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    sqlx::query(
        "INSERT INTO canvas_view_visible_branches (view_id, branch_id, is_visible)
         VALUES (?, ?, ?)
         ON CONFLICT(view_id, branch_id) DO UPDATE SET
            is_visible = excluded.is_visible;",
    )
    .bind(view_id)
    .bind(branch_id)
    .bind(if visible { 1_i64 } else { 0_i64 })
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn set_canvas_view_scope(
    pool: &SqlitePool,
    view_id: &str,
    path_visibility: &HashMap<String, bool>,
    branch_visibility: &HashMap<String, bool>,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    let mut tx = pool.begin().await?;

    for (repo_path_id, visible) in path_visibility {
        sqlx::query(
            "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
             VALUES (?, ?, ?)
             ON CONFLICT(view_id, repo_path_id) DO UPDATE SET is_visible = excluded.is_visible;",
        )
        .bind(view_id)
        .bind(repo_path_id)
        .bind(if *visible { 1_i64 } else { 0_i64 })
        .execute(&mut *tx)
        .await?;
    }

    for (branch_key, visible) in branch_visibility {
        let (repo_path_id, branch_name) = branch_key
            .split_once("::")
            .ok_or(sqlx::Error::RowNotFound)?;
        let branch_id = sqlx::query_scalar::<_, String>(
            "SELECT id
             FROM cached_git_branches
             WHERE path_id = ? AND branch_name = ?
             LIMIT 1;",
        )
        .bind(repo_path_id)
        .bind(branch_name)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(branch_id) = branch_id else {
            continue;
        };

        sqlx::query(
            "INSERT INTO canvas_view_visible_branches (view_id, branch_id, is_visible)
             VALUES (?, ?, ?)
             ON CONFLICT(view_id, branch_id) DO UPDATE SET is_visible = excluded.is_visible;",
        )
        .bind(view_id)
        .bind(branch_id)
        .bind(if *visible { 1_i64 } else { 0_i64 })
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn fetch_canvas_view_scope(
    pool: &SqlitePool,
    view_id: &str,
) -> Result<CanvasViewScopeState, sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    let path_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT 
            tracked_paths.id AS repo_path_id, 
            COALESCE(visible_paths.is_visible, 0) AS is_visible
         FROM tracked_paths 
         LEFT JOIN canvas_view_visible_paths AS visible_paths 
           ON visible_paths.view_id = ? AND visible_paths.repo_path_id = tracked_paths.id 
         WHERE tracked_paths.is_active = 1 AND tracked_paths.archived_at IS NULL 
         ORDER BY tracked_paths.display_name ASC;",
    )
    .bind(view_id)
    .fetch_all(pool)
    .await?;

    let mut visible_path_ids = Vec::new();
    let mut hidden_path_ids = Vec::new();
    for (repo_path_id, is_visible) in path_rows {
        if is_visible != 0 {
            visible_path_ids.push(repo_path_id);
        } else {
            hidden_path_ids.push(repo_path_id);
        }
    }

    let branch_rows = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT
            cached_git_branches.path_id AS repo_path_id,
            cached_git_branches.branch_name AS branch_name,
            COALESCE(visible_branches.is_visible, 1) AS is_visible
         FROM cached_git_branches
         JOIN tracked_paths
            ON tracked_paths.id = cached_git_branches.path_id
         LEFT JOIN canvas_view_visible_branches AS visible_branches
            ON visible_branches.view_id = ?
           AND visible_branches.branch_id = cached_git_branches.id
         WHERE tracked_paths.is_active = 1
           AND tracked_paths.archived_at IS NULL
         ORDER BY cached_git_branches.path_id ASC, cached_git_branches.branch_name ASC;",
    )
    .bind(view_id)
    .fetch_all(pool)
    .await?;

    let mut branch_visibility = HashMap::new();
    for (repo_path_id, branch_name, is_visible) in branch_rows {
        branch_visibility.insert(
            format!("{}::{}", repo_path_id, branch_name),
            is_visible != 0,
        );
    }

    Ok(CanvasViewScopeState {
        visible_path_ids,
        hidden_path_ids,
        branch_visibility,
    })
}

pub async fn fetch_workspace_nodes(
    pool: &SqlitePool,
    view_id: &str,
) -> Result<Vec<WorkspaceNodeRow>, sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    let rows = sqlx::query_as::<_, WorkspaceNodeRow>(
        "WITH card_layout AS (
            SELECT
                repo_path_id,
                pos_x,
                pos_y,
                view_mode,
                commit_density,
                theme_color_hex,
                COALESCE(explode_branches, 0) AS explode_branches
            FROM canvas_view_cards
            WHERE view_id = ?
        ),
        branch_layout AS (
            SELECT
                branch_id,
                pos_x,
                pos_y
            FROM canvas_view_branch_cards
            WHERE view_id = ?
        ),
        repo_tags AS (
            SELECT
                tracked_path_tags.repo_path_id,
                json_group_array(
                    json_object(
                        'id', global_tags.id,
                        'tag_name', global_tags.tag_name,
                        'color_hex', global_tags.color_hex
                    )
                ) AS tags_json
            FROM tracked_path_tags
            JOIN global_tags
                ON global_tags.id = tracked_path_tags.tag_id
            GROUP BY tracked_path_tags.repo_path_id
        ),
        selected_branches AS (
            SELECT
                tracked_paths.id AS path_id,
                cached_git_branches.id AS branch_id,
                cached_git_branches.branch_name,
                cached_git_branches.is_head,
                cached_git_branches.ahead_count,
                cached_git_branches.behind_count,
                cached_git_branches.last_commit_hash,
                CASE
                    WHEN visible_branches.branch_id IS NOT NULL
                     AND cached_git_branches.id != head_branch.id
                    THEN 1
                    ELSE 0
                END AS is_explicit_branch
            FROM tracked_paths
            LEFT JOIN cached_git_branches
                ON cached_git_branches.path_id = tracked_paths.id
            LEFT JOIN cached_git_branches AS head_branch
                ON head_branch.path_id = tracked_paths.id
               AND head_branch.is_head = 1
            LEFT JOIN card_layout
                ON card_layout.repo_path_id = tracked_paths.id
            LEFT JOIN canvas_view_visible_paths AS visible_paths
                ON visible_paths.view_id = ?
               AND visible_paths.repo_path_id = tracked_paths.id
            LEFT JOIN canvas_view_visible_branches AS visible_branches
                ON visible_branches.view_id = ?
               AND visible_branches.branch_id = cached_git_branches.id
            WHERE
                tracked_paths.is_active = 1
                AND tracked_paths.archived_at IS NULL
                AND (
                    COALESCE(visible_paths.is_visible, 0) = 1
                )
                AND (
                    (
                        COALESCE(card_layout.explode_branches, 0) = 1
                        AND cached_git_branches.id IS NOT NULL
                        AND COALESCE(visible_branches.is_visible, 1) = 1
                    )
                    OR (
                        COALESCE(card_layout.explode_branches, 0) = 0
                        AND (
                            cached_git_branches.id IS NULL
                            OR cached_git_branches.id = head_branch.id
                        )
                    )
                )
        )
        SELECT
            selected_branches.path_id AS repo_path_id,
            COALESCE(tracked_paths.display_name, selected_branches.path_id) AS display_name,
            COALESCE(card_layout.explode_branches, 0) AS explode_branches,
            0 AS is_explicit_branch,
            COALESCE(selected_branches.branch_id, '') AS branch_id,
            COALESCE(selected_branches.branch_name, '') AS branch_name,
            COALESCE(selected_branches.is_head, 0) AS is_head,
            COALESCE(selected_branches.ahead_count, 0) AS ahead_count,
            COALESCE(selected_branches.behind_count, 0) AS behind_count,
            COALESCE(selected_branches.last_commit_hash, '') AS last_commit_hash,
            commits.commit_message,
            CASE
                                WHEN COALESCE(card_layout.explode_branches, 0) = 1
                                        THEN COALESCE(branch_layout.pos_x, card_layout.pos_x, 100.0)
                ELSE COALESCE(card_layout.pos_x, 100.0)
            END AS pos_x,
            CASE
                                WHEN COALESCE(card_layout.explode_branches, 0) = 1
                                        THEN COALESCE(branch_layout.pos_y, card_layout.pos_y, 100.0)
                ELSE COALESCE(card_layout.pos_y, 100.0)
            END AS pos_y,
            COALESCE(card_layout.view_mode, 'EXPANDED') AS view_mode,
            COALESCE(card_layout.commit_density, 5) AS commit_density,
            COALESCE(card_layout.theme_color_hex, tracked_paths.theme_color_hex, custom_groups.color_hex, '#4F46E5') AS theme_color_hex,
            custom_groups.color_hex AS group_theme_color_hex,
            COALESCE(repo_tags.tags_json, '[]') AS tags_json
        FROM selected_branches
        LEFT JOIN tracked_paths
            ON tracked_paths.id = selected_branches.path_id
        LEFT JOIN card_layout
            ON card_layout.repo_path_id = selected_branches.path_id
        LEFT JOIN custom_groups
            ON custom_groups.id = tracked_paths.group_id
        LEFT JOIN branch_layout
            ON branch_layout.branch_id = selected_branches.branch_id
        LEFT JOIN cached_git_commits AS commits
            ON commits.commit_hash = selected_branches.last_commit_hash
        LEFT JOIN repo_tags
            ON repo_tags.repo_path_id = selected_branches.path_id
        ORDER BY selected_branches.path_id ASC, selected_branches.branch_name ASC",
    )
    .bind(view_id)
    .bind(view_id)
    .bind(view_id)
    .bind(view_id)
    .bind(view_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn fetch_notifications(pool: &SqlitePool) -> Result<Vec<NotificationRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, NotificationRow>(
        "SELECT id, title, message, variant, is_read, is_pinned, is_archived, created_at, route, route_params_json FROM notifications WHERE is_archived = 0 ORDER BY is_pinned DESC, created_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn insert_notification(
    pool: &SqlitePool,
    notification: &NotificationRow,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO notifications (id, title, message, variant, is_read, is_pinned, is_archived, created_at, route, route_params_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
    )
    .bind(&notification.id)
    .bind(&notification.title)
    .bind(&notification.message)
    .bind(&notification.variant)
    .bind(notification.is_read)
    .bind(notification.is_pinned)
    .bind(notification.is_archived)
    .bind(&notification.created_at)
    .bind(&notification.route)
    .bind(&notification.route_params_json)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_notification_read(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE notifications SET is_read = 1 WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_notification_pin(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE notifications SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = $1"
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn archive_notification(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE notifications SET is_archived = 1 WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_all_notifications_read(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE notifications SET is_read = 1")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn archive_all_notifications(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE notifications SET is_archived = 1")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn fetch_branch_commits(
    pool: &SqlitePool,
    branch_id: &str,
    limit: i64,
) -> Result<Vec<CachedCommitRow>, sqlx::Error> {
    let query_str = if limit <= 0 {
        "SELECT c.commit_hash, c.author_name, c.commit_message, strftime('%Y-%m-%dT%H:%M:%SZ', c.committed_at) as committed_at, c.signature_status, NULL as push_state
         FROM cached_git_commits c
         JOIN cached_git_commit_branches m ON m.commit_hash = c.commit_hash
         WHERE m.branch_id = ?
         ORDER BY c.committed_at DESC"
    } else {
        "SELECT c.commit_hash, c.author_name, c.commit_message, strftime('%Y-%m-%dT%H:%M:%SZ', c.committed_at) as committed_at, c.signature_status, NULL as push_state
         FROM cached_git_commits c
         JOIN cached_git_commit_branches m ON m.commit_hash = c.commit_hash
         WHERE m.branch_id = ?
         ORDER BY c.committed_at DESC LIMIT ?"
    };

    let mut query = sqlx::query_as::<_, CachedCommitRow>(query_str).bind(branch_id);
    if limit > 0 {
        query = query.bind(limit);
    }

    let rows = query.fetch_all(pool).await?;
    Ok(rows)
}

pub async fn fetch_branch_context(
    pool: &SqlitePool,
    branch_id: &str,
) -> Result<Option<CachedBranchContext>, sqlx::Error> {
    sqlx::query_as::<_, CachedBranchContext>(
        "SELECT b.branch_name, p.absolute_path
         FROM cached_git_branches b
         JOIN tracked_paths p ON p.id = b.path_id
         WHERE b.id = ?",
    )
    .bind(branch_id)
    .fetch_optional(pool)
    .await
}

pub async fn update_canvas_card_position(
    pool: &SqlitePool,
    view_id: &str,
    node_key: &str,
    pos_x: f64,
    pos_y: f64,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    let resolved = resolve_layout_node_key(pool, node_key).await?;

    if let Some(branch_id) = resolved.branch_id {
        sqlx::query(
            "INSERT INTO canvas_view_branch_cards (view_id, branch_id, pos_x, pos_y)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(view_id, branch_id) DO UPDATE SET
                pos_x = excluded.pos_x,
                pos_y = excluded.pos_y;",
        )
        .bind(view_id)
        .bind(branch_id)
        .bind(pos_x)
        .bind(pos_y)
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO canvas_view_cards (view_id, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches)
             VALUES (?, ?, ?, ?, 'EXPANDED', 5, '#4F46E5', 0)
             ON CONFLICT(view_id, repo_path_id) DO UPDATE SET
                pos_x = excluded.pos_x,
                pos_y = excluded.pos_y;",
        )
        .bind(view_id)
        .bind(resolved.repo_path_id)
        .bind(pos_x)
        .bind(pos_y)
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub async fn restore_saved_card_locations(
    pool: &SqlitePool,
    view_id: &str,
    locations: &[SavedCardLocation],
) -> Result<RestoreCardLocationsResult, sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    let mut transaction = pool.begin().await?;
    let mut restored = 0;
    let mut skipped = 0;

    for location in locations {
        if !location.x.is_finite() || !location.y.is_finite() {
            skipped += 1;
            continue;
        }

        let result = match location.kind.as_str() {
            "repository" => {
                sqlx::query(
                    "UPDATE canvas_view_cards
                     SET pos_x = ?, pos_y = ?
                     WHERE view_id = ? AND repo_path_id = ?;",
                )
                .bind(location.x)
                .bind(location.y)
                .bind(view_id)
                .bind(&location.repo_path_id)
                .execute(&mut *transaction)
                .await?
            }
            "branch" => {
                let Some(branch_id) = location.branch_id.as_deref() else {
                    skipped += 1;
                    continue;
                };

                sqlx::query(
                    "UPDATE canvas_view_branch_cards
                     SET pos_x = ?, pos_y = ?
                     WHERE view_id = ? AND branch_id = ?
                       AND EXISTS (
                         SELECT 1 FROM cached_git_branches
                         WHERE cached_git_branches.id = ?
                           AND cached_git_branches.path_id = ?
                       );",
                )
                .bind(location.x)
                .bind(location.y)
                .bind(view_id)
                .bind(branch_id)
                .bind(branch_id)
                .bind(&location.repo_path_id)
                .execute(&mut *transaction)
                .await?
            }
            _ => {
                skipped += 1;
                continue;
            }
        };

        if result.rows_affected() == 0 {
            skipped += 1;
        } else {
            restored += 1;
        }
    }

    transaction.commit().await?;
    Ok(RestoreCardLocationsResult { restored, skipped })
}

pub async fn update_canvas_card_config(
    pool: &SqlitePool,
    view_id: &str,
    repo_path_id: &str,
    view_mode: &str,
    commit_density: i64,
    theme_color_hex: &str,
    explode_branches: i64,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    // Accept either tracked_paths.id or cached_git_branches.id and normalize to repo path key.
    let resolved_repo_path_id = resolve_repo_path_id(pool, repo_path_id).await?;

    sqlx::query(
        "INSERT INTO canvas_view_cards (view_id, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches)
         VALUES (?, ?, 100.0, 100.0, ?, ?, ?, ?)
         ON CONFLICT(view_id, repo_path_id) DO UPDATE SET
            view_mode = excluded.view_mode,
            commit_density = excluded.commit_density,
            theme_color_hex = excluded.theme_color_hex,
            explode_branches = excluded.explode_branches;",
    )
    .bind(view_id)
    .bind(resolved_repo_path_id)
    .bind(view_mode)
    .bind(commit_density)
    .bind(theme_color_hex)
    .bind(explode_branches)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_tracked_path_id_by_absolute_path(
    pool: &SqlitePool,
    absolute_path: &str,
) -> Result<Option<String>, sqlx::Error> {
    let row = sqlx::query_scalar::<_, String>(
        "SELECT id FROM tracked_paths WHERE absolute_path = ? LIMIT 1",
    )
    .bind(absolute_path)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn fetch_tracked_path_state_by_absolute_path(
    pool: &SqlitePool,
    absolute_path: &str,
) -> Result<Option<(String, i64)>, sqlx::Error> {
    let row =
        sqlx::query("SELECT id, is_active FROM tracked_paths WHERE absolute_path = ? LIMIT 1")
            .bind(absolute_path)
            .fetch_optional(pool)
            .await?;

    match row {
        Some(row) => {
            let id = row.get::<String, _>("id");
            let is_active = row.get::<i64, _>("is_active");
            Ok(Some((id, is_active)))
        }
        None => Ok(None),
    }
}

pub async fn insert_tracked_path(
    pool: &SqlitePool,
    id: &str,
    display_name: &str,
    absolute_path: &str,
    remote_url: Option<&str>,
    repo_origin_type: &str,
    github_owner_login: Option<&str>,
) -> Result<(), sqlx::Error> {
    let columns = sqlx::query("PRAGMA table_info(tracked_paths);")
        .fetch_all(pool)
        .await?;
    let has_github_owner_login = columns.iter().any(|row| {
        row.get::<String, _>("name")
            .eq_ignore_ascii_case("github_owner_login")
    });

    let insert_sql = if has_github_owner_login {
        "INSERT INTO tracked_paths (
            id, display_name, absolute_path, remote_url, repo_origin_type, github_owner_login, uncommitted_changes_count, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, 0, 1)
         ON CONFLICT(absolute_path) DO UPDATE SET
            is_active = 1,
                archived_at = NULL,
            display_name = excluded.display_name,
            remote_url = excluded.remote_url,
            repo_origin_type = excluded.repo_origin_type,
            github_owner_login = excluded.github_owner_login;"
    } else {
        "INSERT INTO tracked_paths (
            id, display_name, absolute_path, remote_url, repo_origin_type, uncommitted_changes_count, is_active
         ) VALUES (?, ?, ?, ?, ?, 0, 1)
         ON CONFLICT(absolute_path) DO UPDATE SET
            is_active = 1,
                archived_at = NULL,
            display_name = excluded.display_name,
            remote_url = excluded.remote_url,
            repo_origin_type = excluded.repo_origin_type;"
    };

    let mut query = sqlx::query(insert_sql)
        .bind(id)
        .bind(display_name)
        .bind(absolute_path)
        .bind(remote_url)
        .bind(repo_origin_type);

    if has_github_owner_login {
        query = query.bind(github_owner_login);
    }

    query.execute(pool).await?;
    Ok(())
}

pub async fn update_tracked_path_origin_metadata(
    pool: &SqlitePool,
    path_id: &str,
    repo_origin_type: &str,
    github_owner_login: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tracked_paths
         SET repo_origin_type = ?, github_owner_login = ?
         WHERE id = ?;",
    )
    .bind(repo_origin_type)
    .bind(github_owner_login)
    .bind(path_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn relink_tracked_path(
    pool: &SqlitePool,
    path_id: &str,
    display_name: &str,
    absolute_path: &str,
    remote_url: Option<&str>,
    repo_origin_type: &str,
    github_owner_login: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tracked_paths
         SET display_name = ?,
             absolute_path = ?,
             remote_url = ?,
             repo_origin_type = ?,
             github_owner_login = ?,
             is_active = 1,
             archived_at = NULL
         WHERE id = ?;",
    )
    .bind(display_name)
    .bind(absolute_path)
    .bind(remote_url)
    .bind(repo_origin_type)
    .bind(github_owner_login)
    .bind(path_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn deactivate_duplicate_tracked_path(
    pool: &SqlitePool,
    absolute_path: &str,
    exclude_path_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tracked_paths
         SET is_active = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)
         WHERE absolute_path = ? AND id != ?;",
    )
    .bind(absolute_path)
    .bind(exclude_path_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn repair_hidden_tracked_paths(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let result = sqlx::query(
        "UPDATE tracked_paths
         SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)
         WHERE is_active = 0 AND archived_at IS NULL;",
    )
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(result.rows_affected())
}

pub async fn untrack_repository_path(pool: &SqlitePool, path_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tracked_paths
         SET is_active = 0, archived_at = CURRENT_TIMESTAMP
         WHERE id = ?;",
    )
    .bind(path_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn restore_tracked_path(pool: &SqlitePool, path_id: &str) -> Result<String, sqlx::Error> {
    let absolute_path = sqlx::query_scalar::<_, String>(
        "SELECT absolute_path FROM tracked_paths WHERE id = ? AND archived_at IS NOT NULL;",
    )
    .bind(path_id)
    .fetch_optional(pool)
    .await?
    .ok_or(sqlx::Error::RowNotFound)?;

    sqlx::query(
        "UPDATE tracked_paths
         SET is_active = 1, archived_at = NULL
         WHERE id = ? AND archived_at IS NOT NULL;",
    )
    .bind(path_id)
    .execute(pool)
    .await?;

    Ok(absolute_path)
}

pub async fn purge_tracked_path(pool: &SqlitePool, path_id: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query("DELETE FROM tracked_paths WHERE id = ? AND archived_at IS NOT NULL;")
        .bind(path_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn update_repository_alias(
    pool: &sqlx::SqlitePool,
    path_id: &str,
    alias: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET alias_name = ? WHERE id = ?;")
        .bind(alias)
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_repository_origin_type(
    pool: &sqlx::SqlitePool,
    path_id: &str,
    origin_type: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET repo_origin_type = ? WHERE id = ?;")
        .bind(origin_type)
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_default_branch_name(
    pool: &SqlitePool,
    path_id: &str,
    default_branch_name: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET default_branch_name = ? WHERE id = ?;")
        .bind(default_branch_name)
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_absolute_path_for_id(
    pool: &SqlitePool,
    path_id: &str,
) -> Result<String, sqlx::Error> {
    let row = sqlx::query("SELECT absolute_path FROM tracked_paths WHERE id = ?;")
        .bind(path_id)
        .fetch_one(pool)
        .await?;
    Ok(row.get("absolute_path"))
}

/// Upserts the cached sync-status snapshot for a repository's currently checked-out
/// (HEAD) branch. Called by the background indexer daemon and by the manual
/// refresh/fetch/pull/push commands so the dashboard always reads fresh cached values.
pub async fn upsert_head_branch_git_status(
    pool: &SqlitePool,
    path_id: &str,
    branch_name: &str,
    last_commit_hash: &str,
    ahead_count: i64,
    behind_count: i64,
    has_upstream: bool,
    unpushed_commit_count: Option<i64>,
    ahead_of_default_count: i64,
    behind_default_count: i64,
) -> Result<(), sqlx::Error> {
    let branch_id = format!("{}-{}", path_id, branch_name);
    sqlx::query(
        "INSERT INTO cached_git_branches (
            id, path_id, branch_name, is_head, ahead_count, behind_count,
                has_upstream, unpushed_commit_count, ahead_of_default_count, behind_default_count,
                last_commit_hash, updated_at
         )
            VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
         ON CONFLICT(path_id, branch_name) DO UPDATE SET
            is_head = 1,
            ahead_count = excluded.ahead_count,
            behind_count = excluded.behind_count,
            has_upstream = excluded.has_upstream,
            unpushed_commit_count = excluded.unpushed_commit_count,
            ahead_of_default_count = excluded.ahead_of_default_count,
            behind_default_count = excluded.behind_default_count,
            last_commit_hash = excluded.last_commit_hash,
            updated_at = CURRENT_TIMESTAMP;",
    )
    .bind(&branch_id)
    .bind(path_id)
    .bind(branch_name)
    .bind(ahead_count)
    .bind(behind_count)
    .bind(if has_upstream { 1_i64 } else { 0_i64 })
    .bind(unpushed_commit_count)
    .bind(ahead_of_default_count)
    .bind(behind_default_count)
    .bind(last_commit_hash)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_repository_favorite(
    pool: &SqlitePool,
    path_id: &str,
    is_favorite: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET is_favorite = ? WHERE id = ?;")
        .bind(if is_favorite { 1_i64 } else { 0_i64 })
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_repository_pinned(
    pool: &SqlitePool,
    path_id: &str,
    is_pinned: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET is_pinned = ? WHERE id = ?;")
        .bind(if is_pinned { 1_i64 } else { 0_i64 })
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_repository_group(
    pool: &SqlitePool,
    path_id: &str,
    group_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET group_id = ? WHERE id = ?;")
        .bind(group_id)
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_repository_theme(
    pool: &SqlitePool,
    path_id: &str,
    color_hex: Option<&str>,
    icon_name: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET theme_color_hex = ?, icon_name = ? WHERE id = ?;")
        .bind(color_hex)
        .bind(icon_name)
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn tag_name_exists(
    pool: &SqlitePool,
    tag_name: &str,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let normalized = tag_name.trim();
    if normalized.is_empty() {
        return Ok(false);
    }

    if let Some(exclude_id) = exclude_id {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM global_tags WHERE tag_name = ? COLLATE NOCASE AND id != ? LIMIT 1;",
        )
        .bind(normalized)
        .bind(exclude_id)
        .fetch_optional(pool)
        .await?;
        Ok(exists.is_some())
    } else {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM global_tags WHERE tag_name = ? COLLATE NOCASE LIMIT 1;",
        )
        .bind(normalized)
        .fetch_optional(pool)
        .await?;
        Ok(exists.is_some())
    }
}

pub async fn group_name_exists(
    pool: &SqlitePool,
    group_name: &str,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let normalized = group_name.trim();
    if normalized.is_empty() {
        return Ok(false);
    }

    if let Some(exclude_id) = exclude_id {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM custom_groups WHERE group_name = ? COLLATE NOCASE AND id != ? LIMIT 1;",
        )
        .bind(normalized)
        .bind(exclude_id)
        .fetch_optional(pool)
        .await?;
        Ok(exists.is_some())
    } else {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM custom_groups WHERE group_name = ? COLLATE NOCASE LIMIT 1;",
        )
        .bind(normalized)
        .fetch_optional(pool)
        .await?;
        Ok(exists.is_some())
    }
}

pub async fn create_global_tag(
    pool: &SqlitePool,
    tag_name: &str,
    color_hex: Option<&str>,
) -> Result<RepoTagRow, sqlx::Error> {
    let normalized = tag_name.trim();
    if normalized.is_empty() {
        return Err(sqlx::Error::RowNotFound);
    }

    let tag_id = Uuid::new_v4().to_string();
    let color = color_hex.unwrap_or("#3B82F6");

    sqlx::query(
        "INSERT INTO global_tags (id, tag_name, color_hex)
         VALUES (?, ?, ?)
         ON CONFLICT(tag_name) DO NOTHING;",
    )
    .bind(&tag_id)
    .bind(normalized)
    .bind(color)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, RepoTagRow>(
        "SELECT id, tag_name, color_hex
         FROM global_tags
         WHERE tag_name = ? COLLATE NOCASE
         LIMIT 1;",
    )
    .bind(normalized)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| sqlx::Error::Protocol(format!("Unable to create tag '{normalized}'")))
}

pub async fn create_custom_group(
    pool: &SqlitePool,
    group_name: &str,
    color_hex: Option<&str>,
) -> Result<CustomGroupRow, sqlx::Error> {
    let name = group_name.trim();
    if name.is_empty() {
        return Err(sqlx::Error::RowNotFound);
    }

    let group_id = Uuid::new_v4().to_string();
    let color = color_hex.unwrap_or("#64748B");

    sqlx::query(
        "INSERT INTO custom_groups (id, group_name, color_hex, created_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(group_name) DO NOTHING;",
    )
    .bind(&group_id)
    .bind(name)
    .bind(color)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, CustomGroupRow>(
        "SELECT id, group_name, color_hex
         FROM custom_groups
         WHERE group_name = ?
         LIMIT 1;",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| sqlx::Error::Protocol(format!("Unable to create group '{name}'")))
}

pub async fn update_custom_group(
    pool: &SqlitePool,
    id: &str,
    group_name: &str,
    color_hex: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE custom_groups SET group_name = ?, color_hex = ? WHERE id = ?;")
        .bind(group_name.trim())
        .bind(color_hex)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_custom_group(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM custom_groups WHERE id = ?;")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn fetch_custom_groups_with_usage(
    pool: &SqlitePool,
) -> Result<Vec<GroupSummaryRow>, sqlx::Error> {
    sqlx::query_as::<_, GroupSummaryRow>(
        "SELECT
            custom_groups.id,
            custom_groups.group_name,
            custom_groups.color_hex,
            COUNT(DISTINCT tracked_paths.id) AS repo_count
         FROM custom_groups
         LEFT JOIN tracked_paths
            ON tracked_paths.group_id = custom_groups.id
           AND tracked_paths.is_active = 1
           AND tracked_paths.archived_at IS NULL
         GROUP BY custom_groups.id, custom_groups.group_name, custom_groups.color_hex
         ORDER BY custom_groups.group_name COLLATE NOCASE ASC;",
    )
    .fetch_all(pool)
    .await
}

pub async fn fetch_global_tags_with_usage(
    pool: &SqlitePool,
) -> Result<Vec<TagFilterSummaryRow>, sqlx::Error> {
    sqlx::query_as::<_, TagFilterSummaryRow>(
        "SELECT
            global_tags.id,
            global_tags.tag_name,
            global_tags.color_hex,
            COUNT(DISTINCT tracked_paths.id) AS repo_count
         FROM global_tags
         LEFT JOIN tracked_path_tags
            ON tracked_path_tags.tag_id = global_tags.id
         LEFT JOIN tracked_paths
            ON tracked_paths.id = tracked_path_tags.repo_path_id
           AND tracked_paths.is_active = 1
           AND tracked_paths.archived_at IS NULL
         GROUP BY global_tags.id, global_tags.tag_name, global_tags.color_hex
         ORDER BY global_tags.tag_name COLLATE NOCASE ASC;",
    )
    .fetch_all(pool)
    .await
}

pub async fn update_global_tag(
    pool: &SqlitePool,
    id: &str,
    tag_name: &str,
    color_hex: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE global_tags SET tag_name = ?, color_hex = ? WHERE id = ?;")
        .bind(tag_name.trim())
        .bind(color_hex)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_global_tag(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM global_tags WHERE id = ?;")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn cleanup_dangling_global_tags(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM global_tags
         WHERE id NOT IN (SELECT DISTINCT tag_id FROM tracked_path_tags);",
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as i64)
}

pub async fn touch_repository_last_accessed(
    pool: &SqlitePool,
    path_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET last_accessed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?;")
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn attach_repository_tag(
    pool: &SqlitePool,
    path_id: &str,
    tag_name: &str,
    color_hex: Option<&str>,
) -> Result<(), sqlx::Error> {
    let normalized = tag_name.trim();
    if normalized.is_empty() {
        return Ok(());
    }

    let incoming_color = color_hex.unwrap_or("#3B82F6");
    let insert_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO global_tags (id, tag_name, color_hex)
         VALUES (?, ?, ?)
         ON CONFLICT(tag_name) DO NOTHING;",
    )
    .bind(insert_id)
    .bind(normalized)
    .bind(incoming_color)
    .execute(pool)
    .await?;

    let tag_id: String =
        sqlx::query_scalar("SELECT id FROM global_tags WHERE tag_name = ? COLLATE NOCASE LIMIT 1;")
            .bind(normalized)
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO tracked_path_tags (repo_path_id, tag_id)
         VALUES (?, ?);",
    )
    .bind(path_id)
    .bind(tag_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn detach_repository_tag(
    pool: &SqlitePool,
    path_id: &str,
    tag_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM tracked_path_tags
         WHERE repo_path_id = ?
           AND tag_id IN (
                SELECT id FROM global_tags WHERE tag_name = ? COLLATE NOCASE
           );",
    )
    .bind(path_id)
    .bind(tag_name.trim())
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_repository_tags(
    pool: &SqlitePool,
    path_id: &str,
) -> Result<Vec<RepoTagRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, RepoTagRow>(
        "SELECT global_tags.id, global_tags.tag_name, global_tags.color_hex
         FROM tracked_path_tags
         JOIN global_tags
            ON global_tags.id = tracked_path_tags.tag_id
         WHERE tracked_path_tags.repo_path_id = ?
         ORDER BY global_tags.tag_name COLLATE NOCASE ASC;",
    )
    .bind(path_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn fetch_quick_filter_metadata(
    pool: &SqlitePool,
) -> Result<QuickFilterMetadata, sqlx::Error> {
    let groups = sqlx::query_scalar::<_, String>(
        "SELECT custom_groups.group_name
                 FROM custom_groups
                 JOIN tracked_paths
                        ON tracked_paths.group_id = custom_groups.id
                     AND tracked_paths.is_active = 1
                     AND tracked_paths.archived_at IS NULL
                 GROUP BY custom_groups.group_name
                 ORDER BY custom_groups.group_name COLLATE NOCASE ASC;",
    )
    .fetch_all(pool)
    .await?;

    let favorites_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM tracked_paths
         WHERE is_active = 1
           AND archived_at IS NULL
           AND is_favorite = 1;",
    )
    .fetch_one(pool)
    .await?;

    let tags = sqlx::query_as::<_, TagFilterSummaryRow>(
        "SELECT
            global_tags.id,
            global_tags.tag_name,
            global_tags.color_hex,
            COUNT(DISTINCT tracked_path_tags.repo_path_id) AS repo_count
         FROM global_tags
         JOIN tracked_path_tags
            ON tracked_path_tags.tag_id = global_tags.id
         JOIN tracked_paths
            ON tracked_paths.id = tracked_path_tags.repo_path_id
         WHERE tracked_paths.is_active = 1
           AND tracked_paths.archived_at IS NULL
         GROUP BY global_tags.id, global_tags.tag_name, global_tags.color_hex
         ORDER BY global_tags.tag_name COLLATE NOCASE ASC;",
    )
    .fetch_all(pool)
    .await?;

    let dangling_tags = sqlx::query_as::<_, TagFilterSummaryRow>(
        "SELECT
            global_tags.id,
            global_tags.tag_name,
            global_tags.color_hex,
            COALESCE(COUNT(DISTINCT CASE WHEN tracked_paths.is_active = 1 AND tracked_paths.archived_at IS NULL THEN tracked_path_tags.repo_path_id END), 0) AS repo_count
         FROM global_tags
         LEFT JOIN tracked_path_tags
            ON tracked_path_tags.tag_id = global_tags.id
         LEFT JOIN tracked_paths
            ON tracked_paths.id = tracked_path_tags.repo_path_id
         GROUP BY global_tags.id, global_tags.tag_name, global_tags.color_hex
         HAVING repo_count = 0
         ORDER BY global_tags.tag_name COLLATE NOCASE ASC;",
    )
    .fetch_all(pool)
    .await?;

    Ok(QuickFilterMetadata {
        groups,
        favorites_count,
        tags,
        dangling_tags,
    })
}

pub async fn export_workspace_metadata(
    pool: &SqlitePool,
) -> Result<WorkspaceMetadataExport, sqlx::Error> {
    let repositories = sqlx::query_as::<_, WorkspaceMetadataRepository>(
        "SELECT id, display_name, alias_name, absolute_path, remote_url, repo_origin_type,
                group_id, is_favorite, theme_color_hex, icon_name, is_pinned, is_active, archived_at
         FROM tracked_paths
         ORDER BY absolute_path COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let groups = sqlx::query_as::<_, WorkspaceMetadataGroup>(
        "SELECT id, group_name, color_hex, created_at
         FROM custom_groups ORDER BY group_name COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let tags = sqlx::query_as::<_, WorkspaceMetadataTag>(
        "SELECT id, tag_name, color_hex
         FROM global_tags ORDER BY tag_name COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let assignments = sqlx::query_as::<_, WorkspaceMetadataAssignment>(
        "SELECT repo_path_id AS repository_id, tag_id
         FROM tracked_path_tags ORDER BY repo_path_id, tag_id",
    )
    .fetch_all(pool)
    .await?;

    Ok(WorkspaceMetadataExport {
        format: "branch-schematic-workspace-metadata".to_string(),
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        repositories,
        groups,
        tags,
        assignments,
    })
}

pub async fn export_application(pool: &SqlitePool) -> Result<ApplicationExport, sqlx::Error> {
    let workspace = export_active_workspace_metadata(pool).await?;
    let (theme, detail_status_refresh_interval) = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(theme, 'system'), detail_status_refresh_interval FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await?;

    let view_rows = sqlx::query_as::<_, CanvasViewRow>(
        "SELECT id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order,
                card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y, created_at, archived_at
         FROM canvas_views WHERE archived_at IS NULL ORDER BY display_order ASC, created_at ASC",
    )
    .fetch_all(pool)
    .await?;
    let mut views = Vec::with_capacity(view_rows.len());

    for view in view_rows {
        let cards = sqlx::query_as::<_, (String, f64, f64, String, i64, String, i64)>(
            "SELECT tracked_paths.absolute_path, canvas_view_cards.pos_x, canvas_view_cards.pos_y,
                    canvas_view_cards.view_mode, canvas_view_cards.commit_density,
                    canvas_view_cards.theme_color_hex, canvas_view_cards.explode_branches
             FROM canvas_view_cards
             JOIN tracked_paths ON tracked_paths.id = canvas_view_cards.repo_path_id
                         WHERE canvas_view_cards.view_id = ?
                             AND tracked_paths.is_active = 1
                             AND tracked_paths.archived_at IS NULL
             ORDER BY tracked_paths.absolute_path COLLATE NOCASE ASC",
        )
        .bind(&view.id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(
            |(
                repository_path,
                pos_x,
                pos_y,
                view_mode,
                commit_density,
                theme_color_hex,
                explode_branches,
            )| {
                ApplicationExportRepositoryCard {
                    repository_path,
                    pos_x,
                    pos_y,
                    view_mode,
                    commit_density,
                    theme_color_hex,
                    explode_branches,
                }
            },
        )
        .collect();

        let visible_paths = sqlx::query_as::<_, (String, i64)>(
            "SELECT tracked_paths.absolute_path, canvas_view_visible_paths.is_visible
             FROM canvas_view_visible_paths
             JOIN tracked_paths ON tracked_paths.id = canvas_view_visible_paths.repo_path_id
                         WHERE canvas_view_visible_paths.view_id = ?
                             AND tracked_paths.is_active = 1
                             AND tracked_paths.archived_at IS NULL
             ORDER BY tracked_paths.absolute_path COLLATE NOCASE ASC",
        )
        .bind(&view.id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(
            |(repository_path, is_visible)| ApplicationExportPathVisibility {
                repository_path,
                is_visible,
            },
        )
        .collect();

        let manual_edges = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT canvas_manual_edges.id, source.absolute_path, target.absolute_path, canvas_manual_edges.edge_style
             FROM canvas_manual_edges
             JOIN tracked_paths AS source ON source.id = canvas_manual_edges.source_repo_id
             JOIN tracked_paths AS target ON target.id = canvas_manual_edges.target_repo_id
                         WHERE canvas_manual_edges.view_id = ?
                             AND source.is_active = 1 AND source.archived_at IS NULL
                             AND target.is_active = 1 AND target.archived_at IS NULL
             ORDER BY canvas_manual_edges.id ASC",
        )
        .bind(&view.id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|(id, source_repository_path, target_repository_path, edge_style)| ApplicationExportEdge {
            id,
            source_repository_path,
            target_repository_path,
            edge_style,
        })
        .collect();

        views.push(ApplicationExportView {
            id: view.id,
            view_name: view.view_name,
            zoom_level: view.zoom_level,
            pan_x: view.pan_x,
            pan_y: view.pan_y,
            is_favorite: view.is_favorite,
            display_order: view.display_order,
            card_state_json: view.card_state_json,
            baseline_zoom: view.baseline_zoom,
            baseline_pan_x: view.baseline_pan_x,
            baseline_pan_y: view.baseline_pan_y,
            created_at: view.created_at,
            archived_at: view.archived_at,
            repository_cards: cards,
            visible_paths,
            manual_edges,
        });
    }

    Ok(ApplicationExport {
        format: "branch-schematic-application".to_string(),
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        workspace,
        preferences: PortablePreferences {
            theme,
            detail_status_refresh_interval,
        },
        views,
    })
}

async fn export_active_workspace_metadata(
    pool: &SqlitePool,
) -> Result<WorkspaceMetadataExport, sqlx::Error> {
    let repositories = sqlx::query_as::<_, WorkspaceMetadataRepository>(
        "SELECT id, display_name, alias_name, absolute_path, remote_url, repo_origin_type,
                group_id, is_favorite, theme_color_hex, icon_name, is_pinned, is_active, archived_at
         FROM tracked_paths
         WHERE is_active = 1 AND archived_at IS NULL
         ORDER BY absolute_path COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let groups = sqlx::query_as::<_, WorkspaceMetadataGroup>(
        "SELECT id, group_name, color_hex, created_at
         FROM custom_groups ORDER BY group_name COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let tags = sqlx::query_as::<_, WorkspaceMetadataTag>(
        "SELECT id, tag_name, color_hex
         FROM global_tags ORDER BY tag_name COLLATE NOCASE ASC",
    )
    .fetch_all(pool)
    .await?;
    let assignments = sqlx::query_as::<_, WorkspaceMetadataAssignment>(
        "SELECT tracked_path_tags.repo_path_id AS repository_id, tracked_path_tags.tag_id
         FROM tracked_path_tags
         JOIN tracked_paths ON tracked_paths.id = tracked_path_tags.repo_path_id
         WHERE tracked_paths.is_active = 1 AND tracked_paths.archived_at IS NULL
         ORDER BY tracked_path_tags.repo_path_id, tracked_path_tags.tag_id",
    )
    .fetch_all(pool)
    .await?;

    Ok(WorkspaceMetadataExport {
        format: "branch-schematic-workspace-metadata".to_string(),
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        repositories,
        groups,
        tags,
        assignments,
    })
}

pub async fn import_application(
    pool: &SqlitePool,
    export: &ApplicationExport,
) -> Result<ImportSummary, sqlx::Error> {
    if export.format != "branch-schematic-application" || export.version != 1 {
        return Err(sqlx::Error::Protocol(
            "Unsupported application export format".to_string(),
        ));
    }

    let mut transaction = pool.begin().await?;
    let mut conflicts = Vec::new();
    let (repository_ids, repository_counts) =
        import_workspace_metadata_in_transaction(&mut *transaction, &export.workspace).await?;
    for repository in &export.workspace.repositories {
        if let Some(actual_id) = repository_ids.get(&repository.id) {
            if actual_id != &repository.id {
                conflicts.push(format!(
                    "Repository '{}' was imported with a different local identity because its path already existed.",
                    repository.display_name
                ));
            }
        }
    }
    let mut unavailable_repositories = Vec::new();
    let mut unavailable_repository_details = Vec::new();

    for repository in &export.workspace.repositories {
        let id = repository_ids.get(&repository.id).cloned();

        if !std::path::Path::new(&repository.absolute_path).is_dir() {
            unavailable_repositories.push(repository.absolute_path.clone());
            if let Some(id) = id {
                unavailable_repository_details.push(UnavailableRepositoryDetails {
                    id: id.clone(),
                    display_name: repository.display_name.clone(),
                    absolute_path: repository.absolute_path.clone(),
                });
            }
            sqlx::query(
                "UPDATE tracked_paths SET is_active = 0, health_state = 'unavailable', is_cache_stale = 1
                 , archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)
                 WHERE absolute_path = ? COLLATE NOCASE",
            )
            .bind(&repository.absolute_path)
            .execute(&mut *transaction)
            .await?;
        }
    }

    let mut imported_views = 0;
    let mut new_views = 0;
    let mut existing_views = 0;
    let mut skipped_views = 0;
    let mut skipped_layout_records = 0;
    for view in &export.views {
        if view.archived_at.is_some() {
            conflicts.push(format!(
                "Skipped archived view '{}' during application import.",
                view.view_name
            ));
            skipped_views += 1;
            continue;
        }

        let existing_view_id =
            sqlx::query_scalar::<_, String>("SELECT id FROM canvas_views WHERE id = ? LIMIT 1")
                .bind(&view.id)
                .fetch_optional(&mut *transaction)
                .await?;
        let destination_id = existing_view_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        if existing_view_id.is_some() {
            existing_views += 1;
        } else {
            new_views += 1;
        }

        sqlx::query(
            "INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order,
             card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y, created_at, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET view_name = excluded.view_name, zoom_level = excluded.zoom_level,
             pan_x = excluded.pan_x, pan_y = excluded.pan_y, is_favorite = excluded.is_favorite,
             display_order = excluded.display_order, card_state_json = excluded.card_state_json,
             baseline_zoom = excluded.baseline_zoom, baseline_pan_x = excluded.baseline_pan_x,
             baseline_pan_y = excluded.baseline_pan_y, archived_at = excluded.archived_at",
        )
        .bind(&destination_id)
        .bind(&view.view_name)
        .bind(view.zoom_level)
        .bind(view.pan_x)
        .bind(view.pan_y)
        .bind(view.is_favorite)
        .bind(view.display_order)
        .bind(&view.card_state_json)
        .bind(view.baseline_zoom)
        .bind(view.baseline_pan_x)
        .bind(view.baseline_pan_y)
        .bind(&view.created_at)
        .bind(&view.archived_at)
        .execute(&mut *transaction)
        .await?;

        sqlx::query("DELETE FROM canvas_view_cards WHERE view_id = ?")
            .bind(&destination_id)
            .execute(&mut *transaction)
            .await?;
        for card in &view.repository_cards {
            let Some(repository_id) = export
                .workspace
                .repositories
                .iter()
                .find(|repository| {
                    repository
                        .absolute_path
                        .eq_ignore_ascii_case(&card.repository_path)
                })
                .and_then(|repository| repository_ids.get(&repository.id))
            else {
                skipped_layout_records += 1;
                conflicts.push(format!(
                    "View '{}' skipped a repository card because '{}' was not available after import.",
                    view.view_name, card.repository_path
                ));
                continue;
            };
            sqlx::query(
                "INSERT INTO canvas_view_cards (view_id, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&destination_id)
            .bind(repository_id)
            .bind(card.pos_x)
            .bind(card.pos_y)
            .bind(&card.view_mode)
            .bind(card.commit_density)
            .bind(&card.theme_color_hex)
            .bind(card.explode_branches)
            .execute(&mut *transaction)
            .await?;
        }

        sqlx::query("DELETE FROM canvas_view_visible_paths WHERE view_id = ?")
            .bind(&destination_id)
            .execute(&mut *transaction)
            .await?;
        for visibility in &view.visible_paths {
            let Some(repository_id) = export
                .workspace
                .repositories
                .iter()
                .find(|repository| {
                    repository
                        .absolute_path
                        .eq_ignore_ascii_case(&visibility.repository_path)
                })
                .and_then(|repository| repository_ids.get(&repository.id))
            else {
                skipped_layout_records += 1;
                conflicts.push(format!(
                    "View '{}' skipped visibility for '{}' because the repository was not available after import.",
                    view.view_name, visibility.repository_path
                ));
                continue;
            };
            sqlx::query(
                "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
                 VALUES (?, ?, ?)
                 ON CONFLICT(view_id, repo_path_id) DO UPDATE SET is_visible = excluded.is_visible",
            )
            .bind(&destination_id)
            .bind(repository_id)
            .bind(visibility.is_visible)
            .execute(&mut *transaction)
            .await?;
        }

        sqlx::query("DELETE FROM canvas_manual_edges WHERE view_id = ?")
            .bind(&destination_id)
            .execute(&mut *transaction)
            .await?;
        for edge in &view.manual_edges {
            let Some(source_id) = export
                .workspace
                .repositories
                .iter()
                .find(|repository| {
                    repository
                        .absolute_path
                        .eq_ignore_ascii_case(&edge.source_repository_path)
                })
                .and_then(|repository| repository_ids.get(&repository.id))
            else {
                skipped_layout_records += 1;
                conflicts.push(format!(
                    "View '{}' skipped a manual edge with an unavailable source repository.",
                    view.view_name
                ));
                continue;
            };
            let Some(target_id) = export
                .workspace
                .repositories
                .iter()
                .find(|repository| {
                    repository
                        .absolute_path
                        .eq_ignore_ascii_case(&edge.target_repository_path)
                })
                .and_then(|repository| repository_ids.get(&repository.id))
            else {
                skipped_layout_records += 1;
                conflicts.push(format!(
                    "View '{}' skipped a manual edge with an unavailable target repository.",
                    view.view_name
                ));
                continue;
            };
            let edge_id = sqlx::query_scalar::<_, String>(
                "SELECT id FROM canvas_manual_edges WHERE id = ? LIMIT 1",
            )
            .bind(&edge.id)
            .fetch_optional(&mut *transaction)
            .await?
            .filter(|existing_view_id| existing_view_id == &destination_id)
            .map(|_| edge.id.clone())
            .unwrap_or_else(|| {
                if edge.id.is_empty() {
                    Uuid::new_v4().to_string()
                } else {
                    edge.id.clone()
                }
            });
            let edge_id = if sqlx::query_scalar::<_, String>(
                "SELECT id FROM canvas_manual_edges WHERE id = ? LIMIT 1",
            )
            .bind(&edge_id)
            .fetch_optional(&mut *transaction)
            .await?
            .is_some()
            {
                let remapped_id = Uuid::new_v4().to_string();
                conflicts.push(format!(
                    "Manual edge '{}' was assigned a new local identity during import.",
                    edge.id
                ));
                remapped_id
            } else {
                edge_id
            };
            sqlx::query(
                "INSERT INTO canvas_manual_edges (id, view_id, source_repo_id, target_repo_id, edge_style)
                 VALUES (?, ?, ?, ?, ?)",
            )
            .bind(edge_id)
            .bind(&destination_id)
            .bind(source_id)
            .bind(target_id)
            .bind(&edge.edge_style)
            .execute(&mut *transaction)
            .await?;
        }
        imported_views += 1;
    }

    sqlx::query("UPDATE settings SET theme = ?, detail_status_refresh_interval = ? WHERE id = 1")
        .bind(&export.preferences.theme)
        .bind(clamp_detail_status_refresh_interval(
            export.preferences.detail_status_refresh_interval,
        ))
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;

    Ok(ImportSummary {
        imported_repositories: export.workspace.repositories.len(),
        new_repositories: repository_counts.new_repositories,
        existing_repositories: repository_counts.existing_repositories,
        restored_archived_repositories: repository_counts.restored_archived_repositories,
        imported_views,
        new_views,
        existing_views,
        skipped_views,
        unavailable_repositories,
        unavailable_repository_details,
        skipped_layout_records,
        conflicts,
    })
}

pub async fn import_workspace_metadata(
    pool: &SqlitePool,
    export: &WorkspaceMetadataExport,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    import_workspace_metadata_in_transaction(&mut *tx, export).await?;
    tx.commit().await
}

async fn import_workspace_metadata_in_transaction(
    tx: &mut SqliteConnection,
    export: &WorkspaceMetadataExport,
) -> Result<(HashMap<String, String>, ImportRepositoryCounts), sqlx::Error> {
    if export.format != "branch-schematic-workspace-metadata" || export.version != 1 {
        return Err(sqlx::Error::Protocol(
            "Unsupported workspace metadata export format".to_string(),
        ));
    }

    let mut group_ids = HashMap::new();
    for group in &export.groups {
        let existing = sqlx::query_scalar::<_, String>(
            "SELECT id FROM custom_groups WHERE group_name = ? COLLATE NOCASE LIMIT 1",
        )
        .bind(group.group_name.trim())
        .fetch_optional(&mut *tx)
        .await?;
        let id = if existing.is_some() {
            existing.unwrap()
        } else {
            let id_in_use = sqlx::query_scalar::<_, String>(
                "SELECT id FROM custom_groups WHERE id = ? LIMIT 1",
            )
            .bind(&group.id)
            .fetch_optional(&mut *tx)
            .await?
            .is_some();
            if id_in_use {
                Uuid::new_v4().to_string()
            } else {
                group.id.clone()
            }
        };
        sqlx::query(
            "INSERT INTO custom_groups (id, group_name, color_hex, created_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET group_name = excluded.group_name, color_hex = excluded.color_hex",
        )
        .bind(&id)
        .bind(group.group_name.trim())
        .bind(&group.color_hex)
        .bind(&group.created_at)
        .execute(&mut *tx)
        .await?;
        group_ids.insert(group.id.clone(), id);
    }

    let mut repository_ids = HashMap::new();
    let mut repository_counts = ImportRepositoryCounts::default();
    for repository in &export.repositories {
        let existing = sqlx::query_as::<_, (String, Option<String>, Option<String>, i64)>(
            "SELECT id, group_id, archived_at, is_active FROM tracked_paths WHERE absolute_path = ? COLLATE NOCASE LIMIT 1",
        )
        .bind(&repository.absolute_path)
        .fetch_optional(&mut *tx)
        .await?;
        let (id, existing_group_id) =
            if let Some((existing_id, existing_group_id, archived_at, _)) = existing {
                if archived_at.is_some()
                    && repository.is_active == 1
                    && repository.archived_at.is_none()
                {
                    repository_counts.restored_archived_repositories += 1;
                } else {
                    repository_counts.existing_repositories += 1;
                }
                (existing_id, existing_group_id)
            } else {
                repository_counts.new_repositories += 1;
                let id_in_use = sqlx::query_scalar::<_, String>(
                    "SELECT id FROM tracked_paths WHERE id = ? LIMIT 1",
                )
                .bind(&repository.id)
                .fetch_optional(&mut *tx)
                .await?
                .is_some();
                (
                    if id_in_use {
                        Uuid::new_v4().to_string()
                    } else {
                        repository.id.clone()
                    },
                    None,
                )
            };
        let group_id = match repository.group_id.as_ref() {
            Some(imported_group_id) => group_ids
                .get(imported_group_id)
                .cloned()
                .or(existing_group_id),
            None => None,
        };
        sqlx::query(
            "INSERT INTO tracked_paths
                (id, display_name, alias_name, absolute_path, remote_url, repo_origin_type,
                 group_id, is_favorite, theme_color_hex, icon_name, is_pinned, is_active, archived_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name, alias_name = excluded.alias_name,
                remote_url = excluded.remote_url, repo_origin_type = excluded.repo_origin_type,
                group_id = excluded.group_id, is_favorite = excluded.is_favorite,
                theme_color_hex = excluded.theme_color_hex, icon_name = excluded.icon_name,
                is_pinned = excluded.is_pinned, is_active = excluded.is_active,
                archived_at = excluded.archived_at",
        )
        .bind(&id)
        .bind(&repository.display_name)
        .bind(&repository.alias_name)
        .bind(&repository.absolute_path)
        .bind(&repository.remote_url)
        .bind(&repository.repo_origin_type)
        .bind(group_id)
        .bind(repository.is_favorite)
        .bind(&repository.theme_color_hex)
        .bind(&repository.icon_name)
        .bind(repository.is_pinned)
        .bind(repository.is_active)
        .bind(&repository.archived_at)
        .execute(&mut *tx)
        .await?;
        repository_ids.insert(repository.id.clone(), id);
    }

    let mut tag_ids = HashMap::new();
    for tag in &export.tags {
        let existing = sqlx::query_scalar::<_, String>(
            "SELECT id FROM global_tags WHERE tag_name = ? COLLATE NOCASE LIMIT 1",
        )
        .bind(tag.tag_name.trim())
        .fetch_optional(&mut *tx)
        .await?;
        let id = if existing.is_some() {
            existing.unwrap()
        } else {
            let id_in_use =
                sqlx::query_scalar::<_, String>("SELECT id FROM global_tags WHERE id = ? LIMIT 1")
                    .bind(&tag.id)
                    .fetch_optional(&mut *tx)
                    .await?
                    .is_some();
            if id_in_use {
                Uuid::new_v4().to_string()
            } else {
                tag.id.clone()
            }
        };
        sqlx::query(
            "INSERT INTO global_tags (id, tag_name, color_hex)
             VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET tag_name = excluded.tag_name, color_hex = excluded.color_hex",
        )
        .bind(&id)
        .bind(tag.tag_name.trim())
        .bind(&tag.color_hex)
        .execute(&mut *tx)
        .await?;
        tag_ids.insert(tag.id.clone(), id);
    }

    for repository_id in repository_ids.values() {
        sqlx::query("DELETE FROM tracked_path_tags WHERE repo_path_id = ?")
            .bind(repository_id)
            .execute(&mut *tx)
            .await?;
    }
    for assignment in &export.assignments {
        if let (Some(repository_id), Some(tag_id)) = (
            repository_ids.get(&assignment.repository_id),
            tag_ids.get(&assignment.tag_id),
        ) {
            sqlx::query(
                "INSERT OR IGNORE INTO tracked_path_tags (repo_path_id, tag_id) VALUES (?, ?)",
            )
            .bind(repository_id)
            .bind(tag_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    Ok((repository_ids, repository_counts))
}

pub async fn fetch_canvas_manual_edges(
    pool: &SqlitePool,
    view_id: &str,
) -> Result<Vec<CanvasEdgeRow>, sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    let rows = sqlx::query_as::<_, CanvasEdgeRow>(
        "SELECT id, source_repo_id, target_repo_id, edge_style FROM canvas_manual_edges WHERE view_id = ?"
    )
    .bind(view_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn insert_canvas_manual_edge(
    pool: &SqlitePool,
    view_id: &str,
    id: &str,
    source_id: &str,
    target_id: &str,
    edge_style: &str,
) -> Result<(), sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;
    sqlx::query(
        "INSERT INTO canvas_manual_edges (id, view_id, source_repo_id, target_repo_id, edge_style)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING;",
    )
    .bind(id)
    .bind(view_id)
    .bind(source_id)
    .bind(target_id)
    .bind(edge_style)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_canvas_manual_edge(
    pool: &SqlitePool,
    view_id: &str,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM canvas_manual_edges WHERE view_id = ? AND id = ?;")
        .bind(view_id)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn archive_tracked_path(pool: &SqlitePool, path_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tracked_paths SET is_active = 0, archived_at = CURRENT_TIMESTAMP WHERE id = ?;",
    )
    .bind(path_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn archive_canvas_view(pool: &SqlitePool, view_id: &str) -> Result<(), sqlx::Error> {
    let active_view_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM canvas_views WHERE archived_at IS NULL;")
            .fetch_one(pool)
            .await?;
    if active_view_count <= 1 {
        return Err(sqlx::Error::Protocol(
            "At least one active canvas view must remain".to_string(),
        ));
    }

    let result = sqlx::query(
        "UPDATE canvas_views
         SET archived_at = CURRENT_TIMESTAMP
         WHERE id = ? AND archived_at IS NULL;",
    )
    .bind(view_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    Ok(())
}

pub async fn clone_canvas_view(
    pool: &SqlitePool,
    source_id: &str,
    new_id: &str,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let source_exists: Option<String> = sqlx::query_scalar(
        "SELECT id FROM canvas_views WHERE id = ? AND archived_at IS NULL LIMIT 1;",
    )
    .bind(source_id)
    .fetch_optional(&mut *tx)
    .await?;
    if source_exists.is_none() {
        return Err(sqlx::Error::RowNotFound);
    }

    let next_display_order: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(display_order), -1) + 1 FROM canvas_views;")
            .fetch_one(&mut *tx)
            .await?;

    sqlx::query(
           "INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order, card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y)
            SELECT ?, ?, zoom_level, pan_x, pan_y, 0, ?, card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y FROM canvas_views WHERE id = ?"
    )
    .bind(new_id)
    .bind(new_name)
    .bind(next_display_order)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
            SELECT ?, repo_path_id, is_visible
            FROM canvas_view_visible_paths
            WHERE view_id = ?",
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_view_visible_branches (view_id, branch_id, is_visible)
            SELECT ?, branch_id, is_visible
            FROM canvas_view_visible_branches
            WHERE view_id = ?",
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_view_cards (view_id, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches)
         SELECT ?, repo_path_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex, explode_branches
         FROM canvas_view_cards WHERE view_id = ?"
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_manual_edges (id, view_id, source_repo_id, target_repo_id, edge_style)
         SELECT lower(hex(randomblob(16))), ?, source_repo_id, target_repo_id, edge_style
         FROM canvas_manual_edges WHERE view_id = ?",
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_view_branch_cards (view_id, branch_id, pos_x, pos_y)
         SELECT ?, branch_id, pos_x, pos_y
         FROM canvas_view_branch_cards WHERE view_id = ?",
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

struct ResolvedLayoutNodeKey {
    repo_path_id: String,
    branch_id: Option<String>,
}

async fn resolve_layout_node_key(
    pool: &SqlitePool,
    key: &str,
) -> Result<ResolvedLayoutNodeKey, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT id AS repo_path_id, NULL AS branch_id
         FROM tracked_paths
         WHERE id = ?
         UNION ALL
         SELECT path_id AS repo_path_id, id AS branch_id
         FROM cached_git_branches
         WHERE id = ?
         LIMIT 1;",
    )
    .bind(key)
    .bind(key)
    .fetch_optional(pool)
    .await?;

    if let Some((repo_path_id, branch_id)) = row {
        Ok(ResolvedLayoutNodeKey {
            repo_path_id,
            branch_id,
        })
    } else {
        Err(sqlx::Error::RowNotFound)
    }
}

async fn resolve_repo_path_id(pool: &SqlitePool, key: &str) -> Result<String, sqlx::Error> {
    let resolved = sqlx::query_scalar::<_, String>(
        "SELECT id FROM tracked_paths WHERE id = ?
         UNION
         SELECT path_id AS id FROM cached_git_branches WHERE id = ?
         LIMIT 1;",
    )
    .bind(key)
    .bind(key)
    .fetch_optional(pool)
    .await?;

    resolved.ok_or(sqlx::Error::RowNotFound)
}

async fn resolve_branch_visibility_key(
    pool: &SqlitePool,
    key: &str,
) -> Result<Option<String>, sqlx::Error> {
    let direct =
        sqlx::query_scalar::<_, String>("SELECT id FROM cached_git_branches WHERE id = ? LIMIT 1;")
            .bind(key)
            .fetch_optional(pool)
            .await?;

    if direct.is_some() {
        return Ok(direct);
    }

    if let Some((path_id, branch_name)) = key.split_once("::") {
        let from_composite = sqlx::query_scalar::<_, String>(
            "SELECT id FROM cached_git_branches WHERE path_id = ? AND branch_name = ? LIMIT 1;",
        )
        .bind(path_id)
        .bind(branch_name)
        .fetch_optional(pool)
        .await?;

        return Ok(from_composite);
    }

    Ok(None)
}

pub async fn delete_canvas_view(pool: &SqlitePool, view_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM canvas_views WHERE id = ?;")
        .bind(view_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn rename_canvas_view(
    pool: &SqlitePool,
    view_id: &str,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE canvas_views SET view_name = ? WHERE id = ?;")
        .bind(new_name)
        .bind(view_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_canvas_view_favorite(
    pool: &SqlitePool,
    view_id: &str,
    is_favorite: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE canvas_views SET is_favorite = ? WHERE id = ?;")
        .bind(if is_favorite { 1_i64 } else { 0_i64 })
        .bind(view_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn move_canvas_view_display_order(
    pool: &SqlitePool,
    view_id: &str,
    direction: i64,
) -> Result<(), sqlx::Error> {
    if direction == 0 {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    let current = sqlx::query_as::<_, (i64,)>(
        "SELECT display_order
         FROM canvas_views
         WHERE id = ?
           AND archived_at IS NULL
         LIMIT 1;",
    )
    .bind(view_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((current_order,)) = current else {
        tx.commit().await?;
        return Ok(());
    };

    let neighbor = if direction < 0 {
        sqlx::query_as::<_, (String, i64)>(
            "SELECT id, display_order
             FROM canvas_views
             WHERE id <> ?
               AND archived_at IS NULL
               AND display_order < ?
             ORDER BY display_order DESC
             LIMIT 1;",
        )
        .bind(view_id)
        .bind(current_order)
        .fetch_optional(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, (String, i64)>(
            "SELECT id, display_order
             FROM canvas_views
             WHERE id <> ?
               AND archived_at IS NULL
               AND display_order > ?
             ORDER BY display_order ASC
             LIMIT 1;",
        )
        .bind(view_id)
        .bind(current_order)
        .fetch_optional(&mut *tx)
        .await?
    };

    if let Some((neighbor_id, neighbor_order)) = neighbor {
        sqlx::query("UPDATE canvas_views SET display_order = ? WHERE id = ?;")
            .bind(neighbor_order)
            .bind(view_id)
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE canvas_views SET display_order = ? WHERE id = ?;")
            .bind(current_order)
            .bind(neighbor_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn create_new_environment_view(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    zoom_level: f64,
    pan_x: f64,
    pan_y: f64,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let next_display_order: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(display_order), -1) + 1 FROM canvas_views;")
            .fetch_one(&mut *tx)
            .await?;

    sqlx::query("INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order, card_state_json) VALUES (?, ?, ?, ?, ?, 0, ?, NULL);")
        .bind(id)
        .bind(name)
        .bind(zoom_level)
        .bind(pan_x)
        .bind(pan_y)
        .bind(next_display_order)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(())
}
