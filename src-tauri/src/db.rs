use sqlx::SqlitePool;
use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_NAME: &str = "branch-schematic.db";
pub const DB_URL: &str = "sqlite:branch-schematic.db";

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
                absolute_path TEXT NOT NULL UNIQUE,
                remote_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                archived_at DATETIME DEFAULT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tracked_paths_active ON tracked_paths(is_active) WHERE archived_at IS NULL;

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
        let value: i64 = sqlx::query_scalar(&query_str)
            .fetch_one(&pool)
            .await
            .ok()?;

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

// Place this at the very bottom of src/db.rs

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
                .expect(&format!("Failed to run test migration version: {}", migration.version));
        }

        sqlx::query("PRAGMA foreign_keys = ON;").execute(&pool).await.unwrap();

        pool
    }

    #[test]
    fn test_database_integrity_and_foreign_keys() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            // 1. Insert Mock Tracked Path (Multi-directory architecture tracking)
            let path_id = "test-path-uuid-1111";
            sqlx::query(
                "INSERT INTO tracked_paths (id, display_name, absolute_path, remote_url, is_active)
                 VALUES (?, 'Test Core Repo', '/Users/mock/code/test-core', 'https://github.com/test/repo.git', 1);"
            )
            .bind(path_id)
            .execute(&pool)
            .await
            .unwrap();

            // 2. Insert Mock Canvas View (Decoupled spatial states)
            let view_id = "test-view-uuid-2222";
            sqlx::query(
                "INSERT INTO canvas_views (id, view_name, zoom_level, pan_x, pan_y)
                 VALUES (?, 'Sprint 1 Workspace Layout', 1.0, 0.0, 0.0);"
            )
            .bind(view_id)
            .execute(&pool)
            .await
            .unwrap();

            // 3. Insert Mock Daemon-Cached Git Branch
            let branch_id = "test-branch-uuid-3333";
            sqlx::query(
                "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, ahead_count, behind_count, last_commit_hash)
                 VALUES (?, ?, 'feature/auth-pipeline', 1, 2, 0, 'a1b2c3d4e5f6');"
            )
            .bind(branch_id)
            .bind(path_id)
            .execute(&pool)
            .await
            .unwrap();

            // 4. Insert Canvas Spatial View Card Mapping (Connects Branch Cache to a View Node coordinate)
            sqlx::query(
                "INSERT INTO canvas_view_cards (view_id, branch_id, pos_x, pos_y, view_mode, commit_density, theme_color_hex)
                 VALUES (?, ?, 150.5, 300.0, 'EXPANDED', 5, '#4F46E5');"
            )
            .bind(view_id)
            .bind(branch_id)
            .execute(&pool)
            .await
            .unwrap();

            // 5. Verification Queries & Assertions
            let count_cards: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM canvas_view_cards WHERE view_id = ?")
                .bind(view_id)
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count_cards, 1, "Canvas view card should be successfully registered!");

            // 6. Test Cascade Purge Protection 
            // If a tracked path is hard removed, its dependent branch caches and visual cards must clean up automatically via CASCADE
            sqlx::query("DELETE FROM tracked_paths WHERE id = ?;").bind(path_id).execute(&pool).await.unwrap();

            let count_remaining_cards: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM canvas_view_cards WHERE branch_id = ?")
                .bind(branch_id)
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count_remaining_cards, 0, "Foreign key ON DELETE CASCADE failed to clear decoupled visual cards!");

            pool.close().await;
        });
    }
}