use serde::Serialize;
use sqlx::{FromRow, Row, SqlitePool};
use std::collections::HashMap;
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

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct WorkspaceNodeRow {
    pub repo_path_id: String,
    pub explode_branches: i64,
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
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct CanvasEdgeRow {
    pub id: String,
    pub source_repo_id: String,
    pub target_repo_id: String,
    pub edge_style: String,
}

pub const DB_NAME: &str = "branch-schematic.db";
pub const DB_URL: &str = "sqlite:branch-schematic.db";
pub const DEFAULT_CANVAS_VIEW_ID: &str = "default-workspace-view";

pub fn get_app_data_db_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let app_dir = app.path().app_data_dir().expect("Failed to resolve App Data directory");
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
                theme TEXT DEFAULT 'system'
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
                
                repo_origin_type TEXT NOT NULL DEFAULT 'LOCAL_ONLY', -- 'OWNED', 'FORK', 'LOCAL_ONLY'
                uncommitted_changes_count INTEGER NOT NULL DEFAULT 0,
                last_viewed_at DATETIME DEFAULT NULL,
                group_id TEXT DEFAULT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                last_accessed_at TEXT DEFAULT NULL,
                default_branch_name TEXT DEFAULT NULL,
                
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
            ",
            kind: MigrationKind::Up,
        }
    ]
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

pub async fn fetch_active_tracked_paths(
    pool: &SqlitePool,
) -> Result<Vec<TrackedPathRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TrackedPathRow>(
        "SELECT id, display_name, absolute_path, remote_url, is_active FROM tracked_paths WHERE is_active = 1 ORDER BY display_name ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn ensure_canvas_view_exists(pool: &SqlitePool, view_id: &str, view_name: &str) -> Result<(), sqlx::Error> {
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
    ensure_canvas_view_exists(pool, DEFAULT_CANVAS_VIEW_ID, "Default Workspace").await?;
    let rows = sqlx::query_as::<_, CanvasViewRow>(
        "SELECT id, view_name, zoom_level, pan_x, pan_y, is_favorite, display_order, card_state_json, baseline_zoom, baseline_pan_x, baseline_pan_y, created_at, archived_at FROM canvas_views WHERE archived_at IS NULL ORDER BY is_favorite DESC, display_order ASC, created_at ASC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn update_canvas_viewport_state(
    pool: &SqlitePool,
    view_id: &str,
    zoom_level: f64,
    pan_x: f64,
    pan_y: f64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE canvas_views SET zoom_level = ?, pan_x = ?, pan_y = ? WHERE id = ?;"
    )
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

pub async fn fetch_canvas_view_scope(
    pool: &SqlitePool,
    view_id: &str,
) -> Result<CanvasViewScopeState, sqlx::Error> {
    ensure_canvas_view_exists(pool, view_id, "Workspace View").await?;

    let path_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT 
            tracked_paths.id AS repo_path_id, 
            COALESCE(visible_paths.is_visible, 1) AS is_visible 
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
        branch_visibility.insert(format!("{}::{}", repo_path_id, branch_name), is_visible != 0);
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
                cached_git_branches.last_commit_hash
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
                    NOT EXISTS(
                        SELECT 1 FROM canvas_view_visible_paths visibility_seed WHERE visibility_seed.view_id = ?
                    )
                    OR COALESCE(visible_paths.is_visible, 0) = 1
                )
                AND COALESCE(visible_branches.is_visible, 1) = 1
                AND (
                    (COALESCE(card_layout.explode_branches, 0) = 1 AND cached_git_branches.id IS NOT NULL)
                    OR
                    (COALESCE(card_layout.explode_branches, 0) = 0 AND (cached_git_branches.id IS NULL OR cached_git_branches.id = head_branch.id))
                )
        )
        SELECT
            selected_branches.path_id AS repo_path_id,
            COALESCE(card_layout.explode_branches, 0) AS explode_branches,
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
            COALESCE(card_layout.theme_color_hex, '#4F46E5') AS theme_color_hex,
            COALESCE(repo_tags.tags_json, '[]') AS tags_json
        FROM selected_branches
        LEFT JOIN card_layout
            ON card_layout.repo_path_id = selected_branches.path_id
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

pub async fn fetch_branch_commits(
    pool: &SqlitePool,
    branch_id: &str,
    limit: i64,
) -> Result<Vec<CachedCommitRow>, sqlx::Error> {
    let query_str = if limit <= 0 {
        "SELECT commit_hash, author_name, commit_message, strftime('%Y-%m-%d %H:%M:%S', committed_at) as committed_at, signature_status 
         FROM cached_git_commits WHERE branch_id = ? ORDER BY committed_at DESC"
    } else {
        "SELECT commit_hash, author_name, commit_message, strftime('%Y-%m-%d %H:%M:%S', committed_at) as committed_at, signature_status 
         FROM cached_git_commits WHERE branch_id = ? ORDER BY committed_at DESC LIMIT ?"
    };

    let mut query = sqlx::query_as::<_, CachedCommitRow>(query_str).bind(branch_id);
    if limit > 0 {
        query = query.bind(limit);
    }

    let rows = query.fetch_all(pool).await?;
    Ok(rows)
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

pub async fn insert_tracked_path(
    pool: &SqlitePool,
    id: &str,
    display_name: &str,
    absolute_path: &str,
    remote_url: Option<&str>,
    repo_origin_type: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO tracked_paths (
            id, display_name, absolute_path, remote_url, repo_origin_type, uncommitted_changes_count, is_active
         ) VALUES (?, ?, ?, ?, ?, 0, 1)
         ON CONFLICT(absolute_path) DO UPDATE SET
            is_active = 1,
            display_name = excluded.display_name,
            remote_url = excluded.remote_url,
            repo_origin_type = excluded.repo_origin_type;"
    )
    .bind(id)
    .bind(display_name)
    .bind(absolute_path)
    .bind(remote_url)
    .bind(repo_origin_type)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn untrack_repository_path(
    pool: &SqlitePool,
    path_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tracked_paths SET is_active = 0 WHERE id = ?;")
        .bind(path_id)
        .execute(pool)
        .await?;
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
    ahead_of_default_count: i64,
    behind_default_count: i64,
) -> Result<(), sqlx::Error> {
    let branch_id = format!("{}-{}", path_id, branch_name);
    sqlx::query(
        "INSERT INTO cached_git_branches (
            id, path_id, branch_name, is_head, ahead_count, behind_count,
            has_upstream, ahead_of_default_count, behind_default_count, last_commit_hash, updated_at
         )
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)
         ON CONFLICT(path_id, branch_name) DO UPDATE SET
            is_head = 1,
            ahead_count = excluded.ahead_count,
            behind_count = excluded.behind_count,
            has_upstream = excluded.has_upstream,
            ahead_of_default_count = excluded.ahead_of_default_count,
            behind_default_count = excluded.behind_default_count,
            last_commit_hash = excluded.last_commit_hash,
            updated_at = CURRENT_TIMESTAMP;"
    )
    .bind(&branch_id)
    .bind(path_id)
    .bind(branch_name)
    .bind(ahead_count)
    .bind(behind_count)
    .bind(if has_upstream { 1_i64 } else { 0_i64 })
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

pub async fn tag_name_exists(pool: &SqlitePool, tag_name: &str, exclude_id: Option<&str>) -> Result<bool, sqlx::Error> {
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

pub async fn group_name_exists(pool: &SqlitePool, group_name: &str, exclude_id: Option<&str>) -> Result<bool, sqlx::Error> {
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
    .fetch_one(pool)
    .await
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
    .fetch_one(pool)
    .await
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

pub async fn fetch_custom_groups_with_usage(pool: &SqlitePool) -> Result<Vec<GroupSummaryRow>, sqlx::Error> {
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

pub async fn fetch_global_tags_with_usage(pool: &SqlitePool) -> Result<Vec<TagFilterSummaryRow>, sqlx::Error> {
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

    let tag_id: String = sqlx::query_scalar(
        "SELECT id FROM global_tags WHERE tag_name = ? COLLATE NOCASE LIMIT 1;",
    )
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
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING;"
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
    sqlx::query("UPDATE tracked_paths SET is_active = 0, archived_at = CURRENT_TIMESTAMP WHERE id = ?;")
        .bind(path_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn archive_canvas_view(pool: &SqlitePool, view_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE canvas_views SET archived_at = CURRENT_TIMESTAMP WHERE id = ?;")
        .bind(view_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn clone_canvas_view(
    pool: &SqlitePool,
    source_id: &str,
    new_id: &str,
    new_name: &str,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let next_display_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(display_order), -1) + 1 FROM canvas_views;",
    )
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
            WHERE view_id = ?"
        )
        .bind(new_id)
        .bind(source_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
           "INSERT INTO canvas_view_visible_branches (view_id, branch_id, is_visible)
            SELECT ?, branch_id, is_visible
            FROM canvas_view_visible_branches
            WHERE view_id = ?"
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
         FROM canvas_manual_edges WHERE view_id = ?"
    )
    .bind(new_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO canvas_view_branch_cards (view_id, branch_id, pos_x, pos_y)
         SELECT ?, branch_id, pos_x, pos_y
         FROM canvas_view_branch_cards WHERE view_id = ?"
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

async fn resolve_layout_node_key(pool: &SqlitePool, key: &str) -> Result<ResolvedLayoutNodeKey, sqlx::Error> {
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

async fn resolve_branch_visibility_key(pool: &SqlitePool, key: &str) -> Result<Option<String>, sqlx::Error> {
    let direct = sqlx::query_scalar::<_, String>(
        "SELECT id FROM cached_git_branches WHERE id = ? LIMIT 1;",
    )
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

pub async fn rename_canvas_view(pool: &SqlitePool, view_id: &str, new_name: &str) -> Result<(), sqlx::Error> {
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

    let next_display_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(display_order), -1) + 1 FROM canvas_views;",
    )
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

    sqlx::query(
        "INSERT INTO canvas_view_visible_paths (view_id, repo_path_id, is_visible)
         SELECT ?, tracked_paths.id, 1
         FROM tracked_paths
         WHERE tracked_paths.is_active = 1
           AND tracked_paths.archived_at IS NULL;",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}
