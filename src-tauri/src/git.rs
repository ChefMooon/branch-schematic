use std::path::Path;
use uuid::Uuid;
use git2::{Oid, BranchType, Repository};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::DbState;
use crate::db;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitLog {
    pub hash: String,
    pub author: String,
    pub summary: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredBranch {
    pub name: String,
    pub is_head: bool,
    pub latest_commit: CommitLog,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceDetails {
    pub id: String,
    pub display_name: String,
    pub alias_name: Option<String>,
    pub absolute_path: String,
    pub repo_origin_type: String,
    pub current_branch: String,
    pub available_branches: Vec<String>,
    pub uncommitted_changes_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitTopologyRelation {
    pub source_branch: String,
    pub target_branch: String,
    pub common_ancestor: String,
    pub distance_from_ancestor: usize,
}

/// Opens a local directory path, scans it for Git branch metadata,
/// parses the active HEAD state, and logs the latest commit structures.
#[tauri::command]
pub fn scan_local_repository(absolute_path: &str) -> Result<Vec<DiscoveredBranch>, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open directory as a Git repo: {}", e))?;

    let mut discovered_branches = Vec::new();
    let branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to iterate local branches: {}", e))?;

    for branch_res in branches {
        let (branch, _type) =
            branch_res.map_err(|e| format!("Failed to read branch reference: {}", e))?;

        // 1. Parse branch name safely
        let branch_name = branch
            .name()
            .map_err(|e| format!("Failed to parse branch name: {}", e))?
            .unwrap_or("unknown")
            .to_string();

        // 2. Parse the current checked-out HEAD state
        let is_head = branch.is_head();

        // 3. Drill down into the latest commit structure
        let target_commit = branch.get().peel_to_commit().map_err(|e| {
            format!(
                "Failed to resolve branch tip commit for '{}': {}",
                branch_name, e
            )
        })?;

        let author = target_commit.author();
        let author_name = author.name().unwrap_or("Unknown Author").to_string();
        let commit_summary = target_commit
            .summary()
            .unwrap_or("No commit message")
            .to_string();

        let latest_commit = CommitLog {
            hash: target_commit.id().to_string(),
            author: author_name,
            summary: commit_summary,
            timestamp: target_commit.time().seconds(),
        };

        discovered_branches.push(DiscoveredBranch {
            name: branch_name,
            is_head,
            latest_commit,
        });
    }

    Ok(discovered_branches)
}

/// Safely executes a git checkout to switch to an existing local branch.
#[tauri::command]
pub fn execute_git_checkout(absolute_path: &str, branch_name: &str) -> Result<String, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    // Find the target branch reference locally
    let ref_name = format!("refs/heads/{}", branch_name);
    let obj = repo
        .revparse_single(&ref_name)
        .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?;

    // Set HEAD to point to the target branch reference
    repo.set_head(&ref_name)
        .map_err(|e| format!("Failed to set HEAD to '{}': {}", branch_name, e))?;

    // Checkout the index/tree to update files on disk matching the new branch state
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| {
            format!(
                "Failed to checkout files for branch '{}': {}",
                branch_name, e
            )
        })?;

    Ok(format!("Successfully checked out branch '{}'", branch_name))
}

/// Safely creates a new local branch pointing to the current tip/HEAD commit.
#[tauri::command]
pub fn create_git_branch(absolute_path: &str, new_branch_name: &str) -> Result<String, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    // Find the current HEAD target commit so we know where to branch from
    let head_commit = repo
        .head()
        .and_then(|reference| reference.peel_to_commit())
        .map_err(|e| format!("Failed to locate HEAD tip commit: {}", e))?;

    // Create the new branch. Set force parameter to false to avoid overwriting existing references
    repo.branch(new_branch_name, &head_commit, false)
        .map_err(|e| format!("Failed creating branch '{}': {}", new_branch_name, e))?;

    Ok(format!("Successfully created branch '{}'", new_branch_name))
}

#[tauri::command]
pub async fn add_new_tracked_path(
    state: tauri::State<'_, DbState>,
    absolute_path: String
) -> Result<(), String> {
    let path = Path::new(&absolute_path);

    // 1. Validate the directory target is a healthy local Git repository
    let repo = Repository::open(path)
        .map_err(|e| format!("The selected folder is not a valid Git repository workspace context: {}", e))?;

    // 2. Parse out the rightmost directory leaf fragment as the workspace display name
    let display_name = path
        .file_name()
        .and_then(|os_str| os_str.to_str())
        .unwrap_or("Unknown Repository")
        .to_string();

    // 3. Extract remote upstream attributes if an origin tracker exists
    let mut remote_url: Option<String> = None;
    let mut repo_origin_type = "LOCAL_ONLY";

    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            remote_url = Some(url.to_string());
            repo_origin_type = "OWNED"; // Default classification fallback parameter
        }
    }

    // 4. Generate standard cryptographic UUID v4 indexing parameters
    let id = Uuid::new_v4().to_string();

    // 5. Commit record vectors into the database pool
    db::insert_tracked_path(
        &state.0, // Extracting the inner SqlitePool reference
        &id,
        &display_name,
        &absolute_path,
        remote_url.as_deref(),
        repo_origin_type,
    )
    .await
    .map_err(|err| format!("Database indexing loop failure: {}", err))?;

    println!("Repository '{}' committed to SQLite catalog cache successfully.", display_name);
    Ok(())
}

#[tauri::command]
pub async fn untrack_repository(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<(), String> {
    crate::db::untrack_repository_path(&state.0, &path_id)
        .await
        .map_err(|err| format!("Failed to untrack target repository row: {}", err))?;
        
    println!("Successfully hidden/untracked repo reference: {}", path_id);
    Ok(())
}

#[tauri::command]
pub async fn get_tracked_workspaces(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<WorkspaceDetails>, String> {
    let rows = sqlx::query(
        "SELECT id, display_name, alias_name, absolute_path, repo_origin_type 
         FROM tracked_paths 
         WHERE is_active = 1"
    )
    .fetch_all(&state.0)
    .await
    .map_err(|e| format!("Failed to fetch tracked paths from DB: {}", e))?;

    let mut workspaces = Vec::new();

    for row in rows {
        let id: String = row.get("id");
        let display_name: String = row.get("display_name");
        let alias_name: Option<String> = row.get("alias_name");
        let absolute_path: String = row.get("absolute_path");
        let repo_origin_type: String = row.get("repo_origin_type");

        let mut current_branch = "main".to_string();
        let mut available_branches = vec!["main".to_string()];
        let mut uncommitted_changes_count = 0;

        if let Ok(repo) = Repository::open(&absolute_path) {
            if let Ok(branches) = repo.branches(Some(BranchType::Local)) {
                let mut local_branches = Vec::new();
                for branch_res in branches.flatten() {
                    let (branch, _type) = branch_res;
                    if let Ok(Some(name)) = branch.name() {
                        let b_name = name.to_string();
                        local_branches.push(b_name.clone());
                        if branch.is_head() {
                            current_branch = b_name;
                        }
                    }
                }
                if !local_branches.is_empty() {
                    available_branches = local_branches;
                }
            }

            let mut diff_options = git2::DiffOptions::new();
            diff_options.include_untracked(true);
            if let Ok(diff) = repo.diff_index_to_workdir(None, Some(&mut diff_options)) {
                uncommitted_changes_count = diff.stats().map(|s| s.files_changed()).unwrap_or(0);
            }
        }

        workspaces.push(WorkspaceDetails {
            id,
            display_name,
            alias_name,
            absolute_path,
            repo_origin_type,
            current_branch,
            available_branches,
            uncommitted_changes_count,
        });
    }

    Ok(workspaces)
}

#[tauri::command]
pub async fn set_repository_alias(
    state: tauri::State<'_, DbState>,
    path_id: String,
    alias: Option<String>,
) -> Result<(), String> {
    // Sanitize empty values to None strings
    let target_alias = match alias {
        Some(ref s) if s.trim().is_empty() => None,
        other => other,
    };

    db::update_repository_alias(&state.0, &path_id, target_alias.as_deref())
        .await
        .map_err(|err| format!("Failed to record custom workspace name alteration: {}", err))?;

    Ok(())
}

/// Finds the closest common ancestor (merge base) between two branches
/// and calculates structural relationship topology.
#[tauri::command]
pub fn determine_branch_topology(
    absolute_path: &str,
    branch_a: &str,
    branch_b: &str,
) -> Result<GitTopologyRelation, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    // Resolve structural tips
    let ref_a = repo.revparse_single(&format!("refs/heads/{}", branch_a))
        .map_err(|e| format!("Branch '{}' not found: {}", branch_a, e))?;
    let ref_b = repo.revparse_single(&format!("refs/heads/{}", branch_b))
        .map_err(|e| format!("Branch '{}' not found: {}", branch_b, e))?;

    let oid_a = ref_a.id();
    let oid_b = ref_b.id();

    // Find closest common ancestor commit (Merge Base)
    let merge_base_oid = repo.merge_base(oid_a, oid_b)
        .map_err(|e| format!("No common ancestor found between branches: {}", e))?;

    // Simple graph walk to compute relative commit distance from ancestor to branch A tip
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(oid_a).map_err(|e| e.to_string())?;
    revwalk.hide(merge_base_oid).map_err(|e| e.to_string())?;
    let distance = revwalk.count();

    Ok(GitTopologyRelation {
        source_branch: branch_b.to_string(), // Convention: from older/common base or peer
        target_branch: branch_a.to_string(),
        common_ancestor: merge_base_oid.to_string(),
        distance_from_ancestor: distance,
    })
}

// Tests start
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;

    // Helper function to dynamically create a temporary git repository for testing
    fn create_test_repo(repo_name: &str) -> (std::path::PathBuf, Repository) {
        let temp_dir = std::env::temp_dir().join(repo_name);

        // Clean up any leftovers from previous test runs
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir).unwrap();
        }
        fs::create_dir_all(&temp_dir).unwrap();

        // Initialize a brand new git repository
        let repo = Repository::init(&temp_dir).unwrap();

        // Git needs a configuration for identity to successfully commit
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    // Helper to make an initial commit so HEAD and a real commit hash exist
    fn create_initial_commit(repo: &Repository, repo_path: &std::path::Path) {
        let file_path = repo_path.join("README.md");
        let mut file = File::create(file_path).unwrap();
        writeln!(file, "# Test Repo").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("README.md")).unwrap();
        index.write().unwrap();

        let oid = index.write_tree().unwrap();
        let tree = repo.find_tree(oid).unwrap();
        let signature = repo.signature().unwrap();

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Initial commit",
            &tree,
            &[],
        )
        .unwrap();
    }

    #[test]
    fn test_scan_invalid_path() {
        // Passing a non-existent path should return an Error Result, not panic
        let result = scan_local_repository("this/path/does/not/exist/anywhere");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Failed to open directory as a Git repo"));
    }

    #[test]
    fn test_scan_valid_empty_repo() {
        let (repo_path, _repo) = create_test_repo("test_empty_repo");
        let path_str = repo_path.to_str().unwrap();

        // An empty initialized git repository has no commits/branches yet
        let result = scan_local_repository(path_str);
        assert!(result.is_ok());

        let branches = result.unwrap();
        assert_eq!(
            branches.len(),
            0,
            "An empty repository should have 0 branches"
        );

        // Clean up
        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_scan_repo_with_branches() {
        let (repo_path, repo) = create_test_repo("test_active_repo");
        create_initial_commit(&repo, &repo_path);

        // Create a second branch named "feature-branch"
        let head_commit = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature-branch", &head_commit, false).unwrap();

        let path_str = repo_path.to_str().unwrap();
        let result = scan_local_repository(path_str);

        assert!(result.is_ok());
        let branches = result.unwrap();

        // Should find master/main AND the feature branch
        assert_eq!(branches.len(), 2);

        // Verify the properties match our setup
        let main_branch = branches
            .iter()
            .find(|b| b.name == "master" || b.name == "main");
        let feat_branch = branches.iter().find(|b| b.name == "feature-branch");

        assert!(main_branch.is_some(), "Default branch should exist");
        assert!(feat_branch.is_some(), "Feature branch should exist");

        // Ensure HEAD tracking works (the default branch is active)
        assert!(
            main_branch.unwrap().is_head,
            "Default branch should be marked as HEAD"
        );
        assert!(
            !feat_branch.unwrap().is_head,
            "Feature branch should not be marked as HEAD"
        );

        // Check deep nested commit metadata captures
        let main_commit = &main_branch.unwrap().latest_commit;
        let feat_commit = &feat_branch.unwrap().latest_commit;

        assert_eq!(main_commit.hash.len(), 40);
        assert_eq!(main_commit.author, "Test User");
        assert_eq!(main_commit.summary, "Initial commit");
        assert_eq!(feat_commit.hash, main_commit.hash);
        assert!(main_commit.timestamp > 0);

        // Clean up
        fs::remove_dir_all(repo_path).unwrap();
    }
}
