use notify::{Event, RecursiveMode, Result as NotifyResult, Watcher};
use serde::Serialize;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use git2::{Repository, Oid, Sort};

use crate::git::scan_local_repository;

#[derive(Clone, Serialize)]
struct IndexingNotificationPayload {
    title: String,
    message: String,
    variant: String,
    duration: u64,
}

struct ExtractedCommit {
    hash: String,
    author: String,
    summary: String,
    timestamp: i64,
}

pub struct IndexerDaemon {
    app_handle: AppHandle,
    pool: SqlitePool,
}

impl IndexerDaemon {
    pub fn new(app_handle: AppHandle, pool: SqlitePool) -> Self {
        Self { app_handle, pool }
    }

    pub async fn start_watching(
        &self,
        path_id: String,
        absolute_path: String,
    ) -> Result<(), String> {
        let pool = self.pool.clone();
        let app_handle = self.app_handle.clone();
        let watch_path = PathBuf::from(&absolute_path);

        if !watch_path.exists() {
            return Err(format!("Path does not exist: {}", absolute_path));
        }

        let (tx, mut rx) = mpsc::channel::<NotifyResult<Event>>(100);

        let mut watcher = notify::recommended_watcher(move |res: NotifyResult<Event>| {
            let _ = tx.blocking_send(res);
        })
        .map_err(|e| format!("Failed to initialize directory watcher subsystem: {}", e))?;

        watcher
            .watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to hook file system event boundaries: {}", e))?;

        println!("Started watching: {:?}", watch_path);

        // Run an initial scan to populate data right away
        if let Err(e) = Self::run_index_pass(Some(&app_handle), &pool, &path_id, &absolute_path).await {
            println!("Initial background indexing pass failed: {}", e);
        }

        tokio::spawn(async move {
            let _watcher = watcher; 
            let mut pending_event = false;
            let mut check_interval = tokio::time::interval(Duration::from_millis(200));

            loop {
                check_interval.tick().await;

                while let Ok(event) = rx.try_recv() {
                    if let Ok(ev) = event {
                        if ev.paths.iter().any(|p| {
                            let s = p.to_string_lossy();
                            s.contains("/.git/") && !s.ends_with(".lock")
                        }) {
                            pending_event = true;
                        }
                    }
                }

                if pending_event {
                    tokio::time::sleep(Duration::from_millis(600)).await;
                    pending_event = false;
                    
                    println!("Change signature detected. Processing repository delta logs...");
                    if let Err(e) = Self::run_index_pass(Some(&app_handle), &pool, &path_id, &absolute_path).await {
                        println!("Automated incremental indexing cycle error context: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    async fn run_index_pass(
        app_handle: Option<&AppHandle>,
        pool: &SqlitePool,
        path_id: &str,
        absolute_path: &str,
    ) -> Result<(), String> {
        let branches = scan_local_repository(absolute_path)?;
        
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| format!("Database indexing transaction initialization aborted: {}", e))?;

        for branch in &branches {
            let generated_branch_id = format!("{}-{}", path_id, branch.name);

            sqlx::query(
                "INSERT INTO cached_git_branches (id, path_id, branch_name, is_head, last_commit_hash, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
                 ON CONFLICT(path_id, branch_name) DO UPDATE SET
                    is_head = excluded.is_head,
                    last_commit_hash = excluded.last_commit_hash,
                    updated_at = CURRENT_TIMESTAMP;"
            )
            .bind(&generated_branch_id)
            .bind(path_id)
            .bind(&branch.name)
            .bind(branch.is_head as i32)
            .bind(&branch.latest_commit.hash)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed caching branch row metadata: {}", e))?;

            // 1. Isolate the git2 history traversal to a safe, synchronous scope.
            // No .await occurs inside this block, so non-Send pointers are safely discarded.
            let extracted_commits: Vec<ExtractedCommit> = {
                let mut local_commits = Vec::new();
                if let Ok(repo) = Repository::open(absolute_path) {
                    if let Ok(oid) = Oid::from_str(&branch.latest_commit.hash) {
                        if let Ok(mut revwalk) = repo.revwalk() {
                            let _ = revwalk.set_sorting(Sort::TIME);
                            if revwalk.push(oid).is_ok() {
                                for commit_oid in revwalk.take(50).flatten() {
                                    if let Ok(commit) = repo.find_commit(commit_oid) {
                                        local_commits.push(ExtractedCommit {
                                            hash: commit.id().to_string(),
                                            author: commit.author().name().unwrap_or("Unknown").to_string(),
                                            summary: commit.summary().unwrap_or("No commit message").to_string(),
                                            timestamp: commit.time().seconds(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                local_commits
            };

            // 2. Safely perform database writes using plain strings/integers across await boundaries.
            for c in extracted_commits {
                sqlx::query(
                    "INSERT INTO cached_git_commits (commit_hash, branch_id, author_name, commit_message, committed_at) 
                     VALUES (?1, ?2, ?3, ?4, datetime(?5, 'unixepoch'))
                     ON CONFLICT(commit_hash) DO UPDATE SET
                        author_name=excluded.author_name,
                        commit_message=excluded.commit_message"
                )
                .bind(&c.hash)
                .bind(&generated_branch_id)
                .bind(&c.author)
                .bind(&c.summary)
                .bind(c.timestamp)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed caching historical commit record: {}", e))?;
            }
        }

        tx.commit()
            .await
            .map_err(|e| format!("Transaction commit sequence structural failure: {}", e))?;

        if let Some(app_handle) = app_handle {
            let payload = IndexingNotificationPayload {
                title: "Repository indexed".to_string(),
                message: format!(
                    "Synchronized history updates across {} active branches.",
                    branches.len()
                ),
                variant: "success".to_string(),
                duration: 3000,
            };
            let _ = app_handle.emit("indexing-notification", payload);
        }

        Ok(())
    }
}