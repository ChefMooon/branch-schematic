use git2::{Repository, BranchType};
use serde::{Serialize, Deserialize};

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

/// Opens a local directory path, scans it for Git branch metadata, 
/// parses the active HEAD state, and logs the latest commit structures.
#[tauri::command]
pub fn scan_local_repository(absolute_path: &str) -> Result<Vec<DiscoveredBranch>, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open directory as a Git repo: {}", e))?;

    let mut discovered_branches = Vec::new();
    let branches = repo.branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to iterate local branches: {}", e))?;

    for branch_res in branches {
        let (branch, _type) = branch_res
            .map_err(|e| format!("Failed to read branch reference: {}", e))?;

        // 1. Parse branch name safely
        let branch_name = branch.name()
            .map_err(|e| format!("Failed to parse branch name: {}", e))?
            .unwrap_or("unknown")
            .to_string();

        // 2. Parse the current checked-out HEAD state
        let is_head = branch.is_head();

        // 3. Drill down into the latest commit structure
        let target_commit = branch.get().peel_to_commit()
            .map_err(|e| format!("Failed to resolve branch tip commit for '{}': {}", branch_name, e))?;
        
        let author = target_commit.author();
        let author_name = author.name().unwrap_or("Unknown Author").to_string();
        let commit_summary = target_commit.summary().unwrap_or("No commit message").to_string();
        
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
        ).unwrap();
    }

    #[test]
    fn test_scan_invalid_path() {
        // Passing a non-existent path should return an Error Result, not panic
        let result = scan_local_repository("this/path/does/not/exist/anywhere");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open directory as a Git repo"));
    }

    #[test]
    fn test_scan_valid_empty_repo() {
        let (repo_path, _repo) = create_test_repo("test_empty_repo");
        let path_str = repo_path.to_str().unwrap();

        // An empty initialized git repository has no commits/branches yet
        let result = scan_local_repository(path_str);
        assert!(result.is_ok());
        
        let branches = result.unwrap();
        assert_eq!(branches.len(), 0, "An empty repository should have 0 branches");

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
        let main_branch = branches.iter().find(|b| b.name == "master" || b.name == "main");
        let feat_branch = branches.iter().find(|b| b.name == "feature-branch");

        assert!(main_branch.is_some(), "Default branch should exist");
        assert!(feat_branch.is_some(), "Feature branch should exist");

        // Ensure HEAD tracking works (the default branch is active)
        assert!(main_branch.unwrap().is_head, "Default branch should be marked as HEAD");
        assert!(!feat_branch.unwrap().is_head, "Feature branch should not be marked as HEAD");

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