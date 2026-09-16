use crate::git::{compute_unpushed_commit_count, scan_local_repository, DiscoveredBranch};
use crate::health::{self, HealthState};
use crate::layout::{
    classify_repository_path_state, resolve_repository_layout, RepositoryPathState,
};
use git2::{Oid, Repository, Sort};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use std::collections::HashSet;
use std::future::Future;
use std::sync::Arc;
use tokio::sync::Mutex;

const MAX_HISTORY_COMMITS_PER_BRANCH: usize = 100;
const MAX_WRITE_RETRIES: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RefreshOperation {
    Metadata,
    Status,
    Full,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RefreshOutcome {
    pub path_id: String,
    pub operation: RefreshOperation,
    pub branch_count: usize,
    pub health_state: HealthState,
    pub diagnostics: Vec<String>,
}

#[derive(Clone, Default)]
pub struct RepositoryCacheWriter {
    lock: Arc<Mutex<()>>,
}

impl RepositoryCacheWriter {
    pub async fn run<F, Fut, T>(&self, mut operation: F) -> Result<T, sqlx::Error>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = Result<T, sqlx::Error>>,
    {
        let _guard = self.lock.lock().await;
        let mut attempt = 0;
        loop {
            match operation().await {
                Ok(value) => return Ok(value),
                Err(error) if is_busy_error(&error) && attempt < MAX_WRITE_RETRIES => {
                    let delay = 10_u64.saturating_mul(1 << attempt);
                    attempt += 1;
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
                Err(error) => return Err(error),
            }
        }
    }
}

fn is_busy_error(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Database(database_error) => database_error
            .code()
            .is_some_and(|code| code == "5" || code == "6" || code == "SQLITE_BUSY"),
        _ => false,
    }
}

#[derive(Clone)]
struct ExtractedCommit {
    hash: String,
    author: String,
    summary: String,
    timestamp: i64,
}

#[derive(Clone)]
struct BranchSnapshot {
    branch: DiscoveredBranch,
    commits: Vec<ExtractedCommit>,
    ahead_count: i64,
    behind_count: i64,
    has_upstream: bool,
}

#[derive(Clone, Copy)]
struct BranchSyncStatus {
    ahead_count: i64,
    behind_count: i64,
    has_upstream: bool,
}

fn collect_recent_history(repo: &Repository, tip: &str) -> Vec<ExtractedCommit> {
    let Ok(oid) = Oid::from_str(tip) else {
        return Vec::new();
    };
    let Ok(mut revwalk) = repo.revwalk() else {
        return Vec::new();
    };
    let _ = revwalk.set_sorting(Sort::TIME);
    if revwalk.push(oid).is_err() {
        return Vec::new();
    }
    revwalk
        .take(MAX_HISTORY_COMMITS_PER_BRANCH)
        .flatten()
        .filter_map(|commit_oid| repo.find_commit(commit_oid).ok())
        .map(|commit| ExtractedCommit {
            hash: commit.id().to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            summary: commit.summary().unwrap_or("No commit message").to_string(),
            timestamp: commit.time().seconds(),
        })
        .collect()
}

pub async fn refresh_repository_full(
    pool: &SqlitePool,
    writer: &RepositoryCacheWriter,
    path_id: &str,
    absolute_path: &str,
) -> Result<RefreshOutcome, String> {
    let path = std::path::Path::new(absolute_path);
    if classify_repository_path_state(path) != RepositoryPathState::Valid {
        let transition = if !path.exists() {
            health::verification_missing()
        } else {
            health::verification_failed(
                previous_failure_count(pool, path_id).await.unwrap_or(0),
                "Repository verification failed",
            )
        };
        mark_refresh_failure(pool, path_id, transition).await?;
        return Err("Repository is unavailable for refresh".to_string());
    }
    resolve_repository_layout(path)?;
    let branches = match scan_local_repository(absolute_path) {
        Ok(branches) => branches,
        Err(error) => {
            let transition = health::verification_failed(
                previous_failure_count(pool, path_id).await.unwrap_or(0),
                &error,
            );
            mark_refresh_failure(pool, path_id, transition).await?;
            return Err(format!("Repository refresh failed: {error}"));
        }
    };
    let repository =
        Repository::open(path).map_err(|_| "Repository verification failed".to_string())?;
    if branches.is_empty()
        && !repository.is_empty().unwrap_or(false)
        && repository.head().is_ok_and(|head| head.target().is_none())
    {
        let error = "Repository refresh failed: checked-out branch has no commit".to_string();
        let transition = health::verification_failed(
            previous_failure_count(pool, path_id).await.unwrap_or(0),
            &error,
        );
        mark_refresh_failure(pool, path_id, transition).await?;
        return Err(error);
    }
    let unpushed_commit_count = branches
        .iter()
        .find(|branch| branch.is_head)
        .and_then(|branch| {
            repository
                .find_branch(&branch.name, git2::BranchType::Local)
                .ok()
                .and_then(|head_branch| compute_unpushed_commit_count(&repository, &head_branch))
        });
    let mut diagnostics = Vec::new();
    let mut snapshots = Vec::with_capacity(branches.len());
    for branch in &branches {
        let sync_status = branch_sync_status(&repository, branch)?;
        snapshots.push(BranchSnapshot {
            branch: branch.clone(),
            commits: collect_recent_history(&repository, &branch.latest_commit.hash),
            ahead_count: sync_status.ahead_count,
            behind_count: sync_status.behind_count,
            has_upstream: sync_status.has_upstream,
        });
        if let Some(upstream_name) = missing_upstream_name(&repository, branch) {
            diagnostics.push(format!(
                "Branch '{}' has configured upstream '{}' which is unavailable",
                branch.name, upstream_name
            ));
        }
    }
    if let Err(error) = writer
        .run(|| async {
            reconcile_branch_snapshot(pool, path_id, unpushed_commit_count, &snapshots).await
        })
        .await
    {
        let transition = health::verification_failed(
            previous_failure_count(pool, path_id).await.unwrap_or(0),
            &error.to_string(),
        );
        mark_refresh_failure(pool, path_id, transition).await?;
        return Err(format!("Failed to commit repository refresh: {error}"));
    }

    mark_refresh_success(pool, path_id, health::verification_succeeded()).await?;
    Ok(RefreshOutcome {
        path_id: path_id.to_string(),
        operation: RefreshOperation::Full,
        branch_count: branches.len(),
        health_state: HealthState::Healthy,
        diagnostics,
    })
}

fn branch_sync_status(
    repository: &Repository,
    branch: &DiscoveredBranch,
) -> Result<BranchSyncStatus, String> {
    let local_branch = repository
        .find_branch(&branch.name, git2::BranchType::Local)
        .map_err(|error| format!("Failed to resolve local branch '{}': {error}", branch.name))?;
    let Some(local_oid) = local_branch.get().target() else {
        return Err(format!("Branch '{}' has no commit yet", branch.name));
    };
    let upstream = match local_branch.upstream() {
        Ok(upstream) => upstream,
        Err(_) => {
            if configured_upstream_name(repository, branch).is_some() {
                return Ok(BranchSyncStatus {
                    ahead_count: 0,
                    behind_count: 0,
                    has_upstream: false,
                });
            }
            return Ok(BranchSyncStatus {
                ahead_count: 0,
                behind_count: 0,
                has_upstream: false,
            });
        }
    };
    let Some(upstream_oid) = upstream.get().target() else {
        return Err(format!(
            "Upstream for branch '{}' has no commit",
            branch.name
        ));
    };
    let (ahead_count, behind_count) = repository
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|error| {
            format!(
                "Failed to compare branch '{}' with its upstream: {error}",
                branch.name
            )
        })?;
    Ok(BranchSyncStatus {
        ahead_count: ahead_count as i64,
        behind_count: behind_count as i64,
        has_upstream: true,
    })
}

fn missing_upstream_name(repository: &Repository, branch: &DiscoveredBranch) -> Option<String> {
    let local_branch = repository
        .find_branch(&branch.name, git2::BranchType::Local)
        .ok()?;
    local_branch.upstream().err()?;
    configured_upstream_name(repository, branch)
}

fn configured_upstream_name(repository: &Repository, branch: &DiscoveredBranch) -> Option<String> {
    let config = repository.config().ok()?;
    config
        .get_string(&format!("branch.{}.merge", branch.name))
        .ok()
}

async fn reconcile_branch_snapshot(
    pool: &SqlitePool,
    path_id: &str,
    unpushed_commit_count: Option<i64>,
    snapshots: &[BranchSnapshot],
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let existing = sqlx::query_as::<_, (String, String)>(
        "SELECT id, branch_name FROM cached_git_branches WHERE path_id = ?",
    )
    .bind(path_id)
    .fetch_all(&mut *transaction)
    .await?;
    let discovered_names = snapshots
        .iter()
        .map(|snapshot| snapshot.branch.name.as_str())
        .collect::<HashSet<_>>();
    let removed = existing
        .into_iter()
        .filter(|(_, name)| !discovered_names.contains(name.as_str()))
        .collect::<Vec<_>>();

    for snapshot in snapshots {
        let branch = &snapshot.branch;
        let branch_id = format!("{}-{}", path_id, branch.name);
        sqlx::query(
                        "INSERT INTO cached_git_branches (
                                id, path_id, branch_name, is_head, ahead_count, behind_count, has_upstream,
                                unpushed_commit_count, last_commit_hash, updated_at
                         )
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(path_id, branch_name) DO UPDATE SET
                             is_head = excluded.is_head,
                             ahead_count = excluded.ahead_count,
                             behind_count = excluded.behind_count,
                             has_upstream = excluded.has_upstream,
                             last_commit_hash = excluded.last_commit_hash,
                             unpushed_commit_count = excluded.unpushed_commit_count,
                             updated_at = CURRENT_TIMESTAMP",
                )
        .bind(&branch_id)
        .bind(path_id)
        .bind(&branch.name)
        .bind(if branch.is_head { 1_i64 } else { 0_i64 })
        .bind(snapshot.ahead_count)
        .bind(snapshot.behind_count)
        .bind(if snapshot.has_upstream { 1_i64 } else { 0_i64 })
        .bind(if branch.is_head { unpushed_commit_count } else { None })
        .bind(&branch.latest_commit.hash)
        .execute(&mut *transaction)
        .await?;

        sqlx::query("DELETE FROM cached_git_commit_branches WHERE branch_id = ?")
            .bind(&branch_id)
            .execute(&mut *transaction)
            .await?;
        for commit in &snapshot.commits {
            sqlx::query(
                "INSERT INTO cached_git_commits (commit_hash, branch_id, author_name, commit_message, committed_at)
                 VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))
                 ON CONFLICT(commit_hash) DO UPDATE SET
                   author_name = excluded.author_name,
                   commit_message = excluded.commit_message",
            )
            .bind(&commit.hash)
            .bind(&branch_id)
            .bind(&commit.author)
            .bind(&commit.summary)
            .bind(commit.timestamp)
            .execute(&mut *transaction)
            .await?;
            sqlx::query(
                "INSERT INTO cached_git_commit_branches (commit_hash, branch_id)
                 VALUES (?, ?) ON CONFLICT(commit_hash, branch_id) DO NOTHING",
            )
            .bind(&commit.hash)
            .bind(&branch_id)
            .execute(&mut *transaction)
            .await?;
        }
    }

    let removed_ids = removed.iter().map(|(id, _)| id.clone()).collect::<Vec<_>>();
    for branch_id in &removed_ids {
        let hashes = sqlx::query_scalar::<_, String>(
            "SELECT commit_hash FROM cached_git_commits WHERE branch_id = ?
             UNION SELECT commit_hash FROM cached_git_commit_branches WHERE branch_id = ?",
        )
        .bind(branch_id)
        .bind(branch_id)
        .fetch_all(&mut *transaction)
        .await?;
        for hash in hashes {
            if let Some(surviving_branch_id) = sqlx::query_scalar::<_, String>(
                "SELECT branch_id FROM cached_git_commit_branches
                 WHERE commit_hash = ? AND branch_id != ? LIMIT 1",
            )
            .bind(&hash)
            .bind(branch_id)
            .fetch_optional(&mut *transaction)
            .await?
            {
                sqlx::query("UPDATE cached_git_commits SET branch_id = ? WHERE commit_hash = ?")
                    .bind(surviving_branch_id)
                    .bind(&hash)
                    .execute(&mut *transaction)
                    .await?;
            } else {
                sqlx::query(
                    "DELETE FROM cached_git_commits
                     WHERE commit_hash = ?
                       AND NOT EXISTS (SELECT 1 FROM cached_git_commit_branches WHERE commit_hash = ?)",
                )
                .bind(&hash)
                .bind(&hash)
                .execute(&mut *transaction)
                .await?;
            }
        }
        sqlx::query("DELETE FROM cached_git_commit_branches WHERE branch_id = ?")
            .bind(branch_id)
            .execute(&mut *transaction)
            .await?;
    }
    for branch_id in &removed_ids {
        sqlx::query("DELETE FROM cached_git_branches WHERE id = ?")
            .bind(branch_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await
}

async fn mark_refresh_success(
    pool: &SqlitePool,
    path_id: &str,
    transition: health::HealthTransition,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE tracked_paths SET health_state = ?, is_cache_stale = ?,
         last_verified_at = CURRENT_TIMESTAMP, last_successful_verification_at = CURRENT_TIMESTAMP,
         verification_failure_count = ?, last_verification_error = ? WHERE id = ?",
    )
    .bind("healthy")
    .bind(if transition.is_cache_stale {
        1_i64
    } else {
        0_i64
    })
    .bind(i64::from(transition.failure_count))
    .bind(transition.error)
    .bind(path_id)
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|error| format!("Failed to persist repository health: {error}"))
}

async fn previous_failure_count(pool: &SqlitePool, path_id: &str) -> Result<u32, sqlx::Error> {
    sqlx::query_scalar::<_, i64>(
        "SELECT verification_failure_count FROM tracked_paths WHERE id = ?",
    )
    .bind(path_id)
    .fetch_optional(pool)
    .await
    .map(|value| value.unwrap_or(0).max(0) as u32)
}

async fn mark_refresh_failure(
    pool: &SqlitePool,
    path_id: &str,
    transition: health::HealthTransition,
) -> Result<(), String> {
    let state = match transition.state {
        HealthState::Missing => "missing",
        HealthState::Moved => "moved",
        HealthState::MonitoringFailed => "monitoring_failed",
        HealthState::Unreachable => "unreachable",
        _ => "monitoring_failed",
    };
    sqlx::query(
        "UPDATE tracked_paths SET health_state = ?, is_cache_stale = 1,
         last_verified_at = CURRENT_TIMESTAMP, verification_failure_count = ?,
         last_verification_error = ? WHERE id = ?",
    )
    .bind(state)
    .bind(i64::from(transition.failure_count))
    .bind(transition.error)
    .bind(path_id)
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|error| format!("Failed to persist repository failure state: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::CommitLog;
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::tempdir;

    async fn fixture_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE tracked_paths (id TEXT PRIMARY KEY, absolute_path TEXT NOT NULL, health_state TEXT NOT NULL DEFAULT 'unverified', is_cache_stale INTEGER NOT NULL DEFAULT 1, last_verified_at TEXT, last_successful_verification_at TEXT, verification_failure_count INTEGER NOT NULL DEFAULT 0, last_verification_error TEXT)").execute(&pool).await.unwrap();
        sqlx::query("CREATE TABLE cached_git_branches (id TEXT PRIMARY KEY, path_id TEXT NOT NULL, branch_name TEXT NOT NULL, is_head INTEGER NOT NULL DEFAULT 0, ahead_count INTEGER NOT NULL DEFAULT 0, behind_count INTEGER NOT NULL DEFAULT 0, has_upstream INTEGER NOT NULL DEFAULT 0, unpushed_commit_count INTEGER DEFAULT NULL, last_commit_hash TEXT NOT NULL, updated_at TEXT, UNIQUE(path_id, branch_name), FOREIGN KEY(path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE)").execute(&pool).await.unwrap();
        sqlx::query("CREATE TABLE cached_git_commits (commit_hash TEXT PRIMARY KEY, branch_id TEXT NOT NULL, author_name TEXT NOT NULL, commit_message TEXT NOT NULL, committed_at TEXT NOT NULL, FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE)").execute(&pool).await.unwrap();
        sqlx::query("CREATE TABLE cached_git_commit_branches (commit_hash TEXT NOT NULL, branch_id TEXT NOT NULL, PRIMARY KEY(commit_hash, branch_id), FOREIGN KEY(commit_hash) REFERENCES cached_git_commits(commit_hash) ON DELETE CASCADE, FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE)").execute(&pool).await.unwrap();
        pool
    }

    fn branch(name: &str, is_head: bool, hash: &str) -> DiscoveredBranch {
        DiscoveredBranch {
            name: name.to_string(),
            is_head,
            latest_commit: CommitLog {
                hash: hash.to_string(),
                author: "Test Author".to_string(),
                summary: "Test commit".to_string(),
                timestamp: 1,
            },
        }
    }

    #[tokio::test]
    async fn writer_serializes_operations() {
        let writer = RepositoryCacheWriter::default();
        let first = writer.clone();
        let second = writer.clone();
        let first_task =
            tokio::spawn(async move { first.run(|| async { Ok::<_, sqlx::Error>(1) }).await });
        let second_task =
            tokio::spawn(async move { second.run(|| async { Ok::<_, sqlx::Error>(2) }).await });
        assert_eq!(first_task.await.unwrap().unwrap(), 1);
        assert_eq!(second_task.await.unwrap().unwrap(), 2);
    }

    #[test]
    fn branch_sync_status_distinguishes_upstream_states() {
        let directory = tempdir().unwrap();
        let repository = git2::Repository::init(directory.path()).unwrap();
        let signature = git2::Signature::now("Test Author", "test@example.com").unwrap();
        let tree = repository.index().unwrap().write_tree().unwrap();
        let first_commit = repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "First commit",
                &repository.find_tree(tree).unwrap(),
                &[],
            )
            .unwrap();
        let second_commit = repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Second commit",
                &repository.find_tree(tree).unwrap(),
                &[&repository.find_commit(first_commit).unwrap()],
            )
            .unwrap();
        repository
            .branch(
                "tracked",
                &repository.find_commit(second_commit).unwrap(),
                true,
            )
            .unwrap();
        repository
            .reference(
                "refs/remotes/origin/tracked",
                first_commit,
                true,
                "test upstream",
            )
            .unwrap();
        repository.set_head("refs/heads/tracked").unwrap();
        let mut config = repository.config().unwrap();
        config.set_str("branch.tracked.remote", "origin").unwrap();
        config
            .set_str("branch.tracked.merge", "refs/heads/tracked")
            .unwrap();

        let tracked = branch("tracked", true, &second_commit.to_string());
        let status = branch_sync_status(&repository, &tracked).unwrap();
        assert_eq!(status.ahead_count, 1);
        assert_eq!(status.behind_count, 0);
        assert!(status.has_upstream);

        let no_upstream = branch("no-upstream", false, &second_commit.to_string());
        repository
            .branch(
                "no-upstream",
                &repository.find_commit(second_commit).unwrap(),
                false,
            )
            .unwrap();
        let status = branch_sync_status(&repository, &no_upstream).unwrap();
        assert_eq!((status.ahead_count, status.behind_count), (0, 0));
        assert!(!status.has_upstream);

        let missing = branch("missing", false, &second_commit.to_string());
        repository
            .branch(
                "missing",
                &repository.find_commit(second_commit).unwrap(),
                false,
            )
            .unwrap();
        let mut config = repository.config().unwrap();
        config.set_str("branch.missing.remote", "origin").unwrap();
        config
            .set_str("branch.missing.merge", "refs/heads/missing")
            .unwrap();
        let status = branch_sync_status(&repository, &missing).unwrap();
        assert_eq!((status.ahead_count, status.behind_count), (0, 0));
        assert!(!status.has_upstream);
        assert_eq!(
            missing_upstream_name(&repository, &missing).as_deref(),
            Some("refs/heads/missing")
        );
    }

    #[tokio::test]
    async fn full_refresh_reconciles_empty_repository() {
        let pool = fixture_pool().await;
        let directory = tempdir().unwrap();
        git2::Repository::init(directory.path()).unwrap();
        sqlx::query("INSERT INTO tracked_paths (id, absolute_path) VALUES ('empty-repo', ?)")
            .bind(directory.path().to_string_lossy().to_string())
            .execute(&pool)
            .await
            .unwrap();

        let outcome = refresh_repository_full(
            &pool,
            &RepositoryCacheWriter::default(),
            "empty-repo",
            directory.path().to_str().unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(outcome.branch_count, 0);
        assert!(outcome.diagnostics.is_empty());
    }

    #[tokio::test]
    async fn full_refresh_reports_missing_configured_upstream() {
        let pool = fixture_pool().await;
        let directory = tempdir().unwrap();
        let repository = git2::Repository::init(directory.path()).unwrap();
        let signature = git2::Signature::now("Test Author", "test@example.com").unwrap();
        let tree = repository.index().unwrap().write_tree().unwrap();
        let commit = repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Initial commit",
                &repository.find_tree(tree).unwrap(),
                &[],
            )
            .unwrap();
        let mut config = repository.config().unwrap();
        config.set_str("branch.master.remote", "origin").unwrap();
        config
            .set_str("branch.master.merge", "refs/heads/master")
            .unwrap();
        sqlx::query("INSERT INTO tracked_paths (id, absolute_path) VALUES ('missing-upstream', ?)")
            .bind(directory.path().to_string_lossy().to_string())
            .execute(&pool)
            .await
            .unwrap();

        let outcome = refresh_repository_full(
            &pool,
            &RepositoryCacheWriter::default(),
            "missing-upstream",
            directory.path().to_str().unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(outcome.branch_count, 1);
        assert_eq!(
            outcome.diagnostics,
            vec![
                "Branch 'master' has configured upstream 'refs/heads/master' which is unavailable"
            ]
        );
        let status: (i64, i64, i64, String) = sqlx::query_as(
            "SELECT ahead_count, behind_count, has_upstream, last_commit_hash
             FROM cached_git_branches
             WHERE path_id = 'missing-upstream' AND branch_name = 'master'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!((status.0, status.1, status.2), (0, 0, 0));
        assert_eq!(status.3, commit.to_string());
    }

    #[tokio::test]
    async fn authoritative_reconciliation_removes_absent_branch_and_retains_shared_commit() {
        let pool = fixture_pool().await;
        sqlx::query("INSERT INTO tracked_paths (id, absolute_path) VALUES ('repo-1', '/tmp/repo')")
            .execute(&pool)
            .await
            .unwrap();
        let directory = tempdir().unwrap();
        let repository = git2::Repository::init(directory.path()).unwrap();
        let tree = repository.index().unwrap().write_tree().unwrap();
        let signature = git2::Signature::now("Test Author", "test@example.com").unwrap();
        let commit = repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Test commit",
                &repository.find_tree(tree).unwrap(),
                &[],
            )
            .unwrap();
        repository
            .branch("feature", &repository.find_commit(commit).unwrap(), false)
            .unwrap();

        let main = branch("main", true, &commit.to_string());
        let feature = branch("feature", false, &commit.to_string());
        let snapshots = vec![
            BranchSnapshot {
                branch: main.clone(),
                commits: collect_recent_history(&repository, &commit.to_string()),
                ahead_count: 3,
                behind_count: 1,
                has_upstream: true,
            },
            BranchSnapshot {
                branch: feature,
                commits: collect_recent_history(&repository, &commit.to_string()),
                ahead_count: 0,
                behind_count: 0,
                has_upstream: false,
            },
        ];
        reconcile_branch_snapshot(&pool, "repo-1", Some(2), &snapshots)
            .await
            .unwrap();
        let cached_count: Option<i64> = sqlx::query_scalar(
            "SELECT unpushed_commit_count FROM cached_git_branches
             WHERE path_id = 'repo-1' AND is_head = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(cached_count, Some(2));
        let sync_status: (i64, i64, i64) = sqlx::query_as(
            "SELECT ahead_count, behind_count, has_upstream
             FROM cached_git_branches
             WHERE path_id = 'repo-1' AND branch_name = 'main'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(sync_status, (3, 1, 1));
        let feature_status: (i64, i64, i64) = sqlx::query_as(
            "SELECT ahead_count, behind_count, has_upstream
             FROM cached_git_branches
             WHERE path_id = 'repo-1' AND branch_name = 'feature'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(feature_status, (0, 0, 0));
        let remaining = vec![BranchSnapshot {
            branch: main,
            commits: collect_recent_history(&repository, &commit.to_string()),
            ahead_count: 0,
            behind_count: 0,
            has_upstream: false,
        }];
        reconcile_branch_snapshot(&pool, "repo-1", Some(0), &remaining)
            .await
            .unwrap();
        let cached_count: Option<i64> = sqlx::query_scalar(
            "SELECT unpushed_commit_count FROM cached_git_branches
             WHERE path_id = 'repo-1' AND is_head = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(cached_count, Some(0));

        let branch_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM cached_git_branches WHERE path_id = 'repo-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let mapping_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM cached_git_commit_branches")
                .fetch_one(&pool)
                .await
                .unwrap();
        let commit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cached_git_commits")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(branch_count, 1);
        assert_eq!(mapping_count, 1);
        assert_eq!(commit_count, 1);
    }

    #[tokio::test]
    async fn missing_repository_preserves_cache_and_marks_health_stale() {
        let pool = fixture_pool().await;
        sqlx::query("INSERT INTO tracked_paths (id, absolute_path, health_state, is_cache_stale) VALUES ('repo-1', '/missing/repo', 'healthy', 0)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO cached_git_branches (id, path_id, branch_name, last_commit_hash) VALUES ('repo-1-main', 'repo-1', 'main', 'abc')")
            .execute(&pool)
            .await
            .unwrap();

        let result = refresh_repository_full(
            &pool,
            &RepositoryCacheWriter::default(),
            "repo-1",
            "/missing/repo",
        )
        .await;
        assert!(result.is_err());
        let branch_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM cached_git_branches WHERE path_id = 'repo-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let state: String =
            sqlx::query_scalar("SELECT health_state FROM tracked_paths WHERE id = 'repo-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(branch_count, 1);
        assert_eq!(state, "missing");
    }
}
