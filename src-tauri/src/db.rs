use serde::Serialize;
use sqlx::{FromRow, SqlitePool};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct TrackedPathRow {
    pub id: String,
    pub display_name: String,
    pub absolute_path: String,
    pub remote_url: Option<String>,
    pub is_active: i64,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct WorkspaceNodeRow {
    pub branch_id: String,
    pub branch_name: String,
    pub is_head: i64,
    pub last_commit_hash: String,
    pub commit_message: Option<String>,
    pub pos_x: Option<f64>,
    pub pos_y: Option<f64>,
}

pub const DB_NAME: &str = "branch-schematic.db";
pub const DB_URL: &str = "sqlite:branch-schematic.db";
pub const DEFAULT_CANVAS_VIEW_ID: &str = "default-workspace-view";

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
                
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                archived_at DATETIME DEFAULT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_active ON tracked_paths(is_active) WHERE archived_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_recent ON tracked_paths(last_viewed_at) WHERE last_viewed_at IS NOT NULL;

            -- Spatial View presets
            CREATE TABLE IF NOT EXISTS canvas_views (
                id TEXT PRIMARY KEY NOT NULL,
                view_name TEXT NOT NULL,
                zoom_level REAL NOT NULL DEFAULT 1.0,
                pan_x REAL NOT NULL DEFAULT 0.0,
                pan_y REAL NOT NULL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                archived_at DATETIME DEFAULT NULL
            );
            INSERT OR IGNORE INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y)
            VALUES ('default-workspace-view', 'Default Workspace', 1.0, 0.0, 0.0);

            -- Daemon local cache index tables
            CREATE TABLE IF NOT EXISTS cached_git_branches (
                id TEXT PRIMARY KEY NOT NULL,
                path_id TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                is_head INTEGER NOT NULL DEFAULT 0,
                ahead_count INTEGER NOT NULL DEFAULT 0,
                behind_count INTEGER NOT NULL DEFAULT 0,
                last_commit_hash TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_path_branch ON cached_git_branches(path_id, branch_name);

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
                branch_id TEXT NOT NULL,
                pos_x REAL NOT NULL DEFAULT 0.0,
                pos_y REAL NOT NULL DEFAULT 0.0,
                view_mode TEXT NOT NULL DEFAULT 'EXPANDED',
                commit_density INTEGER NOT NULL DEFAULT 5,
                theme_color_hex TEXT DEFAULT '#4F46E5',
                PRIMARY KEY (view_id, branch_id),
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );

            -- Custom user drawn manual relational lines
            CREATE TABLE IF NOT EXISTS canvas_manual_edges (
                id TEXT PRIMARY KEY NOT NULL,
                view_id TEXT NOT NULL,
                source_branch_id TEXT NOT NULL,
                target_branch_id TEXT NOT NULL,
                edge_style TEXT NOT NULL DEFAULT 'BEZIER',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
                FOREIGN KEY(source_branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE,
                FOREIGN KEY(target_branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
            );
            ",
            kind: MigrationKind::Up,
        }
    ]
}

pub fn read_bool_setting(_app: &tauri::AppHandle, column: &str) -> bool {
    let column_owned = column.to_string();

    tauri::async_runtime::block_on(async move {
        // 2. Use the central DB_URL constant directly
        let pool = SqlitePool::connect(DB_URL).await.ok()?;

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

pub async fn ensure_default_canvas_view(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y)
         VALUES (?, 'Default Workspace', 1.0, 0.0, 0.0);",
    )
    .bind(DEFAULT_CANVAS_VIEW_ID)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_workspace_nodes(
    pool: &SqlitePool,
) -> Result<Vec<WorkspaceNodeRow>, sqlx::Error> {
    ensure_default_canvas_view(pool).await?;

    let rows = sqlx::query_as::<_, WorkspaceNodeRow>(
        "SELECT
            branches.id AS branch_id,
            branches.branch_name,
            branches.is_head,
            branches.last_commit_hash,
            commits.commit_message,
            cards.pos_x,
            cards.pos_y
         FROM cached_git_branches AS branches
         LEFT JOIN canvas_view_cards AS cards
            ON cards.branch_id = branches.id
           AND cards.view_id = ?
         LEFT JOIN cached_git_commits AS commits
            ON commits.commit_hash = branches.last_commit_hash
         ORDER BY branches.is_head DESC, branches.branch_name ASC",
    )
    .bind(DEFAULT_CANVAS_VIEW_ID)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn update_canvas_card_position(
    pool: &SqlitePool,
    branch_id: &str,
    pos_x: f64,
    pos_y: f64,
) -> Result<(), sqlx::Error> {
    ensure_default_canvas_view(pool).await?;

    sqlx::query(
        "INSERT INTO canvas_view_cards (view_id, branch_id, pos_x, pos_y)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(view_id, branch_id) DO UPDATE SET
            pos_x = excluded.pos_x,
            pos_y = excluded.pos_y;",
    )
    .bind(DEFAULT_CANVAS_VIEW_ID)
    .bind(branch_id)
    .bind(pos_x)
    .bind(pos_y)
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
            id,
            display_name,
            absolute_path,
            remote_url,
            repo_origin_type,
            uncommitted_changes_count,
            is_active
         ) VALUES (?, ?, ?, ?, ?, 0, 1)
         ON CONFLICT(absolute_path) DO UPDATE SET
            is_active = 1,
            display_name = excluded.display_name,
            remote_url = excluded.remote_url,
            repo_origin_type = excluded.repo_origin_type;",
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
    sqlx::query(
        "UPDATE tracked_paths
         SET is_active = 0
         WHERE id = ?;",
    )
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
    sqlx::query(
        "UPDATE tracked_paths
         SET alias_name = ?
         WHERE id = ?;",
    )
    .bind(alias)
    .bind(path_id)
    .execute(pool)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("Failed to connect to in-memory test SQLite DB");

        let migrations = get_migrations();
        for migration in migrations {
            sqlx::query(&migration.sql)
                .execute(&pool)
                .await
                .unwrap_or_else(|_| panic!("Failed to run test migration version: {}", migration.version));
        }

        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await
            .unwrap();

        pool
    }

    #[test]
    fn test_workspace_nodes_round_trip_from_canvas_card_positions() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active)
                 VALUES ('path-1', 'Workspace One', '/tmp/workspace-one', 1);",
            )
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, last_commit_hash)
                 VALUES ('branch-1', 'path-1', 'feature/test', 1, 'abc123');",
            )
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO cached_git_commits (commit_hash, branch_id, author_name, commit_message, committed_at)
                 VALUES ('abc123', 'branch-1', 'Test Author', 'Latest workspace branch commit', '2026-01-01T00:00:00Z');",
            )
            .execute(&pool)
            .await
            .unwrap();

            update_canvas_card_position(&pool, "branch-1", 120.5, 240.0)
                .await
                .unwrap();

            let nodes = fetch_workspace_nodes(&pool).await.unwrap();

            assert_eq!(nodes.len(), 1);
            assert_eq!(nodes[0].branch_id, "branch-1");
            assert_eq!(nodes[0].branch_name, "feature/test");
            assert_eq!(nodes[0].commit_message.as_deref(), Some("Latest workspace branch commit"));
            assert_eq!(nodes[0].pos_x, Some(120.5));
            assert_eq!(nodes[0].pos_y, Some(240.0));

            pool.close().await;
        });
    }

    #[test]
    fn test_update_canvas_card_position_updates_existing_position() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active)
                 VALUES ('path-1', 'Workspace One', '/tmp/workspace-one', 1);",
            )
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, last_commit_hash)
                 VALUES ('branch-1', 'path-1', 'feature/test', 1, 'abc123');",
            )
            .execute(&pool)
            .await
            .unwrap();

            update_canvas_card_position(&pool, "branch-1", 40.0, 80.0)
                .await
                .unwrap();

            update_canvas_card_position(&pool, "branch-1", 96.0, 144.0)
                .await
                .unwrap();

            let stored_position = sqlx::query_as::<_, (f64, f64)>(
                "SELECT pos_x, pos_y FROM canvas_view_cards WHERE view_id = ? AND branch_id = ?",
            )
            .bind(DEFAULT_CANVAS_VIEW_ID)
            .bind("branch-1")
            .fetch_one(&pool)
            .await
            .unwrap();

            assert_eq!(stored_position, (96.0, 144.0));

            pool.close().await;
        });
    }

    #[test]
    fn test_fetch_active_tracked_paths_returns_only_active_rows() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, remote_url, is_active) VALUES (?, 'Active Repo', '/tmp/active', 'https://example.com/active.git', 1);",
            )
            .bind("active-path")
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, remote_url, is_active) VALUES (?, 'Inactive Repo', '/tmp/inactive', 'https://example.com/inactive.git', 0);",
            )
            .bind("inactive-path")
            .execute(&pool)
            .await
            .unwrap();

            let tracked_paths = fetch_active_tracked_paths(&pool).await.unwrap();

            assert_eq!(tracked_paths.len(), 1);
            assert_eq!(tracked_paths[0].id, "active-path");
            assert_eq!(tracked_paths[0].display_name, "Active Repo");
            assert_eq!(tracked_paths[0].absolute_path, "/tmp/active");

            pool.close().await;
        });
    }

    #[test]
    fn test_database_integrity_and_foreign_keys() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            let path_id = "test-path-uuid-1111";
            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, remote_url, is_active)
                 VALUES (?, 'Test Core Repo', '/Users/mock/code/test-core', 'https://github.com/test/repo.git', 1);",
            )
            .bind(path_id)
            .execute(&pool)
            .await
            .unwrap();

            let view_id = "test-view-uuid-2222";
            sqlx::query(
                "INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y)
                 VALUES (?, 'Sprint 1 Workspace Layout', 1.0, 0.0, 0.0);",
            )
            .bind(view_id)
            .execute(&pool)
            .await
            .unwrap();

            let branch_id = "test-branch-uuid-3333";
            sqlx::query(
                "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, ahead_count, behind_count, last_commit_hash)
                 VALUES (?, ?, 'feature/auth-pipeline', 1, 2, 0, 'a1b2c3d4e5f6');",
            )
            .bind(branch_id)
            .bind(path_id)
            .execute(&pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO canvas_view_cards (view_id, branch_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex)
                 VALUES (?, ?, 150.5, 300.0, 'EXPANDED', 5, '#4F46E5');",
            )
            .bind(view_id)
            .bind(branch_id)
            .execute(&pool)
            .await
            .unwrap();

            let count_cards: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM canvas_view_cards WHERE view_id = ?")
                    .bind(view_id)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(count_cards, 1, "Canvas view card should be successfully registered!");

            sqlx::query("DELETE FROM tracked_paths WHERE id = ?;")
                .bind(path_id)
                .execute(&pool)
                .await
                .unwrap();

            let count_remaining_cards: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM canvas_view_cards WHERE branch_id = ?")
                    .bind(branch_id)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(
                count_remaining_cards, 0,
                "Foreign key ON DELETE CASCADE failed to clear decoupled visual cards!",
            );

            pool.close().await;
        });
    }
}
