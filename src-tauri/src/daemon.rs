use notify::{Watcher, RecursiveMode, Event, Result as NotifyResult};
use std::path::PathBuf;
use std::time::Duration;
use sqlx::sqlite::SqlitePool;
use tokio::sync::mpsc;

use crate::git::scan_local_repository;

pub struct IndexerDaemon {
    pool: SqlitePool,
}

impl IndexerDaemon {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn start_watching(&self, path_id: String, absolute_path: String) -> Result<(), String> {
        let pool = self.pool.clone();
        let watch_path = PathBuf::from(&absolute_path);

        if !watch_path.exists() {
            return Err(format!("Path does not exist: {}", absolute_path));
        }

        let (tx, mut rx) = mpsc::channel::<NotifyResult<Event>>(100);

        let mut watcher = notify::recommended_watcher(move |res: NotifyResult<Event>| {
            let _ = tx.blocking_send(res);
        }).map_err(|e| format!("Failed to init watcher: {}", e))?;

        let git_dir = watch_path.join(".git");
        let path_to_watch = if git_dir.exists() { &git_dir } else { &watch_path };

        watcher.watch(path_to_watch, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        Box::leak(Box::new(watcher));

        let path_id_clone = path_id.clone();
        let abs_path_clone = absolute_path.clone();
        tokio::spawn(async move {
            while let Some(res) = rx.recv().await {
                match res {
                    Ok(event) => {
                        if event.kind.is_modify() || event.kind.is_create() {
                            tokio::time::sleep(Duration::from_millis(300)).await;
                            if let Err(e) = sync_repository_to_db(&path_id_clone, &abs_path_clone, &pool).await {
                                eprintln!("Daemon Sync Error: {}", e);
                            }
                        }
                    }
                    Err(e) => eprintln!("Watcher event error: {}", e),
                }
            }
        });

        // Initial sweep
        sync_repository_to_db(&path_id, &absolute_path, &self.pool).await?;
        Ok(())
    }
}

async fn sync_repository_to_db(path_id: &str, absolute_path: &str, pool: &SqlitePool) -> Result<(), String> {
    let branches = scan_local_repository(absolute_path)?;
    let mut tx = pool.begin().await.map_err(|e| format!("Database transaction error: {}", e))?;

    for branch in branches {
        let generated_branch_id = format!("{}-{}", path_id, branch.name);

        sqlx::query(
            "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, last_commit_hash) 
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path_id, branch_name) DO UPDATE SET
                is_head=excluded.is_head,
                last_commit_hash=excluded.last_commit_hash"
        )
        .bind(&generated_branch_id)
        .bind(path_id)
        .bind(&branch.name)
        .bind(branch.is_head as i32)
        .bind(&branch.latest_commit.hash)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed caching branch row: {}", e))?;

        sqlx::query(
            "INSERT INTO cached_git_commits (commit_hash, branch_id, author_name, commit_message, committed_at) 
             VALUES (?1, ?2, ?3, ?4, datetime(?5, 'unixepoch'))
             ON CONFLICT(commit_hash) DO UPDATE SET
                author_name=excluded.author_name,
                commit_message=excluded.commit_message"
        )
        .bind(&branch.latest_commit.hash)
        .bind(&generated_branch_id)
        .bind(&branch.latest_commit.author)
        .bind(&branch.latest_commit.summary)
        .bind(branch.latest_commit.timestamp)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed caching commit row: {}", e))?;
    }

    tx.commit().await.map_err(|e| format!("Transaction commit failed: {}", e))?;
    Ok(())
}