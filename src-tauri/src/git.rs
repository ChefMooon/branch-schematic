use std::{fs, path::Path};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use git2::{AutotagOption, Branch, BranchType, FetchOptions, Oid, PushOptions, RemoteCallbacks, Repository};
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
    pub is_favorite: i64,
    pub group_id: Option<String>,
    pub custom_group: Option<String>,
    pub last_accessed_at: Option<String>,
    pub tags_json: String,
    pub default_branch_name: Option<String>,
    pub ahead_count: i64,
    pub behind_count: i64,
    pub has_upstream: bool,
    pub ahead_of_default_count: i64,
    pub behind_default_count: i64,
}

/// Snapshot of branch/sync status for a repository's currently checked-out (HEAD)
/// branch only -- this matches exactly what RepositoryCard displays, keeping the
/// analysis cheap even for repositories with many local branches.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoGitStatusSnapshot {
    pub current_branch: String,
    pub available_branches: Vec<String>,
    pub uncommitted_changes_count: usize,
    pub default_branch_name: Option<String>,
    pub last_commit_hash: String,
    pub ahead_count: i64,
    pub behind_count: i64,
    pub has_upstream: bool,
    pub ahead_of_default_count: i64,
    pub behind_default_count: i64,
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
    let _ = repo
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

fn sanitize_repository_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "Repository".to_string();
    }

    trimmed
        .chars()
        .map(|char| match char {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_whitespace() => '-',
            c => c,
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn resolve_repository_target_path(parent_path: &Path, repo_name: &str, create_in_subfolder: bool) -> Result<std::path::PathBuf, String> {
    let cleaned_name = sanitize_repository_name(repo_name);
    if create_in_subfolder {
        let target_dir = parent_path.join(cleaned_name);
        Ok(target_dir)
    } else {
        Ok(parent_path.to_path_buf())
    }
}

fn initialize_repository_structure(path: &Path, include_readme: bool, repo_name: &str, repo_description: &str, gitignore_template: &str, license_template: &str) -> Result<(), String> {
    if path.exists() && path.is_file() {
        return Err(format!("'{}' is a file, not a directory.", path.display()));
    }

    if !path.exists() {
        fs::create_dir_all(path)
            .map_err(|error| format!("Failed to create repository directory '{}': {}", path.display(), error))?;
    }

    let is_existing_repo = Repository::open(path).is_ok();
    if !is_existing_repo {
        Repository::init(path)
            .map_err(|error| format!("Failed to initialize Git repository at '{}': {}", path.display(), error))?;
    }

    if include_readme {
        let readme_path = path.join("README.md");
        if !readme_path.exists() {
            let repo_label = if repo_name.trim().is_empty() {
                "Repository"
            } else {
                repo_name.trim()
            };
            let description_text = if repo_description.trim().is_empty() {
                String::new()
            } else {
                format!("\n\n{}", repo_description.trim())
            };
            let content = format!("# {}{}\n", repo_label, description_text);
            fs::write(&readme_path, content)
                .map_err(|error| format!("Failed to write README at '{}': {}", readme_path.display(), error))?;
        }
    }

    let gitignore_path = path.join(".gitignore");
    if !gitignore_path.exists() {
        let default_gitignore = match gitignore_template {
            "node" => "node_modules/\ndist/\n.env\n",
            "rust" => "target/\nCargo.lock\n",
            _ => "*.log\n",
        };
        fs::write(&gitignore_path, default_gitignore)
            .map_err(|error| format!("Failed to write .gitignore at '{}': {}", gitignore_path.display(), error))?;
    }

    let gitattributes_path = path.join(".gitattributes");
    if !gitattributes_path.exists() {
        let default_gitattributes = "# Auto detect text files and perform LF normalization\n* text=auto\n";
        fs::write(&gitattributes_path, default_gitattributes)
            .map_err(|error| format!("Failed to write .gitattributes at '{}': {}", gitattributes_path.display(), error))?;
    }

    let license_path = path.join("LICENSE");
    if !license_path.exists() {
        let default_license = match license_template {
            "mit" => "MIT License\n\nCopyright (c) 2026\n",
            "apache" => "Apache License 2.0\n\nCopyright (c) 2026\n",
            _ => "Copyright (c) 2026\n",
        };
        fs::write(&license_path, default_license)
            .map_err(|error| format!("Failed to write LICENSE at '{}': {}", license_path.display(), error))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn initialize_new_repository(
    state: tauri::State<'_, DbState>,
    name: String,
    absolute_path: String,
    initialize_with_readme: bool,
    description: String,
    create_in_subfolder: bool,
    gitignore_template: String,
    license_template: String,
) -> Result<(), String> {
    let parent_path = Path::new(&absolute_path);
    let trimmed_name = name.trim();
    let display_name = if trimmed_name.is_empty() {
        parent_path
            .file_name()
            .and_then(|os_str| os_str.to_str())
            .unwrap_or("New Repository")
            .to_string()
    } else {
        trimmed_name.to_string()
    };

    let target_path = resolve_repository_target_path(parent_path, &display_name, create_in_subfolder)?;

    initialize_repository_structure(
        &target_path,
        initialize_with_readme,
        &display_name,
        &description,
        &gitignore_template,
        &license_template,
    )?;

    let repo = Repository::open(&target_path)
        .map_err(|error| format!("The repository path was not created successfully: {}", error))?;

    let mut remote_url: Option<String> = None;
    let mut repo_origin_type = "LOCAL_ONLY";

    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            remote_url = Some(url.to_string());
            repo_origin_type = "OWNED";
        }
    }

    let id = Uuid::new_v4().to_string();

    db::insert_tracked_path(
        &state.0,
        &id,
        &display_name,
        &target_path.to_string_lossy(),
        remote_url.as_deref(),
        repo_origin_type,
    )
    .await
    .map_err(|error| format!("Database indexing loop failure: {}", error))?;

    println!("Repository '{}' initialized and committed to SQLite catalog cache successfully.", display_name);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredRepo {
    pub id: Option<String>,
    pub display_name: String,
    pub absolute_path: String,
    pub is_git_repository: bool,
    pub depth: Option<u32>,
    pub selected: Option<bool>,
}

#[tauri::command]
pub fn crawl_repositories_command(root_path: String, max_depth: u32) -> Result<Vec<DiscoveredRepo>, String> {
    let root = Path::new(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err("The selected folder does not exist or is not a directory.".to_string());
    }

    let mut discovered = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0u32)];

    while let Some((current_path, depth)) = stack.pop() {
        if depth > max_depth {
            continue;
        }

        if let Ok(repo) = Repository::open(&current_path) {
            let display_name = current_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Unknown Repository")
                .to_string();

            discovered.push(DiscoveredRepo {
                id: None,
                display_name: display_name.clone(),
                absolute_path: current_path.to_string_lossy().to_string(),
                is_git_repository: true,
                depth: Some(depth),
                selected: Some(true),
            });

            if depth >= max_depth {
                continue;
            }
        }

        if let Ok(entries) = fs::read_dir(&current_path) {
            let mut child_paths = entries
                .filter_map(|entry| entry.ok())
                .map(|entry| entry.path())
                .filter(|path| path.is_dir())
                .collect::<Vec<_>>();
            child_paths.sort();
            for child_path in child_paths {
                stack.push((child_path, depth + 1));
            }
        }

        if let Ok(repo) = Repository::open(&current_path) {
            let _ = repo;
        }
    }

    discovered.sort_by(|left, right| left.absolute_path.cmp(&right.absolute_path));
    Ok(discovered)
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
        "SELECT
            tracked_paths.id,
            tracked_paths.display_name,
            tracked_paths.alias_name,
            tracked_paths.absolute_path,
            tracked_paths.repo_origin_type,
            tracked_paths.is_favorite,
            tracked_paths.group_id,
            custom_groups.group_name AS custom_group,
            tracked_paths.last_accessed_at,
            tracked_paths.default_branch_name,
            cached_git_branches.ahead_count AS cached_ahead_count,
            cached_git_branches.behind_count AS cached_behind_count,
            cached_git_branches.has_upstream AS cached_has_upstream,
            cached_git_branches.ahead_of_default_count AS cached_ahead_of_default_count,
            cached_git_branches.behind_default_count AS cached_behind_default_count,
            COALESCE(
                (
                    SELECT json_group_array(
                        json_object(
                            'id', global_tags.id,
                            'tag_name', global_tags.tag_name,
                            'color_hex', global_tags.color_hex
                        )
                    )
                    FROM tracked_path_tags
                    JOIN global_tags
                        ON global_tags.id = tracked_path_tags.tag_id
                    WHERE tracked_path_tags.repo_path_id = tracked_paths.id
                ),
                '[]'
            ) AS tags_json
         FROM tracked_paths
            LEFT JOIN custom_groups
                ON custom_groups.id = tracked_paths.group_id
            LEFT JOIN cached_git_branches
                ON cached_git_branches.path_id = tracked_paths.id
                AND cached_git_branches.is_head = 1
         WHERE tracked_paths.is_active = 1"
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
        let is_favorite: i64 = row.get("is_favorite");
        let group_id: Option<String> = row.get("group_id");
        let custom_group: Option<String> = row.get("custom_group");
        let last_accessed_at: Option<String> = row.get("last_accessed_at");
        let tags_json: String = row.get("tags_json");
        let default_branch_name: Option<String> = row.get("default_branch_name");
        let ahead_count: Option<i64> = row.get("cached_ahead_count");
        let behind_count: Option<i64> = row.get("cached_behind_count");
        let has_upstream_raw: Option<i64> = row.get("cached_has_upstream");
        let ahead_of_default_count: Option<i64> = row.get("cached_ahead_of_default_count");
        let behind_default_count: Option<i64> = row.get("cached_behind_default_count");

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
            is_favorite,
            group_id,
            custom_group,
            last_accessed_at,
            tags_json,
            default_branch_name,
            ahead_count: ahead_count.unwrap_or(0),
            behind_count: behind_count.unwrap_or(0),
            has_upstream: has_upstream_raw.unwrap_or(0) != 0,
            ahead_of_default_count: ahead_of_default_count.unwrap_or(0),
            behind_default_count: behind_default_count.unwrap_or(0),
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

#[tauri::command]
pub async fn set_repository_favorite(
    state: tauri::State<'_, DbState>,
    path_id: String,
    is_favorite: bool,
) -> Result<(), String> {
    db::update_repository_favorite(&state.0, &path_id, is_favorite)
        .await
        .map_err(|err| format!("Failed to persist favorite state: {}", err))?;

    Ok(())
}

#[tauri::command]
pub async fn set_repository_origin_type(
    state: tauri::State<'_, DbState>,
    path_id: String,
    origin_type: String,
) -> Result<(), String> {
    if !["OWNED", "FORK", "CONTRIBUTOR", "LOCAL_ONLY"].contains(&origin_type.as_str()) {
        return Err("Invalid repository origin type provided.".to_string());
    }

    crate::db::update_repository_origin_type(&state.0, &path_id, &origin_type)
        .await
        .map_err(|err| format!("Failed to update origin status: {}", err))?;

    Ok(())
}

#[tauri::command]
pub async fn set_repository_group(
    state: tauri::State<'_, DbState>,
    path_id: String,
    group_id: Option<String>,
) -> Result<(), String> {
    let cleaned = group_id.and_then(|group| {
        let trimmed = group.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    db::update_repository_group(&state.0, &path_id, cleaned.as_deref())
        .await
        .map_err(|err| format!("Failed to persist custom group value: {}", err))?;

    Ok(())
}

#[tauri::command]
pub async fn create_custom_group(
    state: tauri::State<'_, DbState>,
    group_name: String,
    color_hex: Option<String>,
) -> Result<db::CustomGroupRow, String> {
    let trimmed_name = group_name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Group name cannot be empty.".to_string());
    }

    let tag_conflict = db::tag_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists. Tags and groups must have unique names.".to_string());
    }

    let group_conflict = db::group_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists.".to_string());
    }

    db::create_custom_group(&state.0, &trimmed_name, color_hex.as_deref())
        .await
        .map_err(|err| format!("Failed to create custom group: {}", err))
}

#[tauri::command]
pub async fn update_custom_group(
    state: tauri::State<'_, DbState>,
    id: String,
    group_name: String,
    color_hex: String,
) -> Result<(), String> {
    let trimmed_name = group_name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Group name cannot be empty.".to_string());
    }

    let tag_conflict = db::tag_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists. Tags and groups must have unique names.".to_string());
    }

    let group_conflict = db::group_name_exists(&state.0, &trimmed_name, Some(&id))
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists.".to_string());
    }

    db::update_custom_group(&state.0, &id, &trimmed_name, &color_hex)
        .await
        .map_err(|err| format!("Failed to update custom group: {}", err))
}

#[tauri::command]
pub async fn delete_custom_group(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    db::delete_custom_group(&state.0, &id)
        .await
        .map_err(|err| format!("Failed to delete custom group: {}", err))
}

#[tauri::command]
pub async fn get_custom_groups_with_usage(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::GroupSummaryRow>, String> {
    db::fetch_custom_groups_with_usage(&state.0)
        .await
        .map_err(|err| format!("Failed to fetch custom groups: {}", err))
}

#[tauri::command]
pub async fn create_global_tag(
    state: tauri::State<'_, DbState>,
    tag_name: String,
    color_hex: Option<String>,
) -> Result<db::RepoTagRow, String> {
    let trimmed_name = tag_name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Tag name cannot be empty.".to_string());
    }

    let tag_conflict = db::tag_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists.".to_string());
    }

    let group_conflict = db::group_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists. Tags and groups must have unique names.".to_string());
    }

    db::create_global_tag(&state.0, &trimmed_name, color_hex.as_deref())
        .await
        .map_err(|err| format!("Failed to create global tag: {}", err))
}

#[tauri::command]
pub async fn get_global_tags_with_usage(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::TagFilterSummaryRow>, String> {
    db::fetch_global_tags_with_usage(&state.0)
        .await
        .map_err(|err| format!("Failed to fetch global tags: {}", err))
}

#[tauri::command]
pub async fn update_global_tag(
    state: tauri::State<'_, DbState>,
    id: String,
    tag_name: String,
    color_hex: String,
) -> Result<(), String> {
    let trimmed_name = tag_name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Tag name cannot be empty.".to_string());
    }

    let tag_conflict = db::tag_name_exists(&state.0, &trimmed_name, Some(&id))
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists.".to_string());
    }

    let group_conflict = db::group_name_exists(&state.0, &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists. Tags and groups must have unique names.".to_string());
    }

    db::update_global_tag(&state.0, &id, &trimmed_name, &color_hex)
        .await
        .map_err(|err| format!("Failed to update global tag: {}", err))
}

#[tauri::command]
pub async fn delete_global_tag(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    db::delete_global_tag(&state.0, &id)
        .await
        .map_err(|err| format!("Failed to delete global tag: {}", err))
}

#[tauri::command]
pub async fn cleanup_dangling_global_tags(
    state: tauri::State<'_, DbState>,
) -> Result<i64, String> {
    db::cleanup_dangling_global_tags(&state.0)
        .await
        .map_err(|err| format!("Failed to clean dangling tags: {}", err))
}

#[tauri::command]
pub async fn add_repository_tag(
    state: tauri::State<'_, DbState>,
    path_id: String,
    tag_name: String,
    color_hex: Option<String>,
) -> Result<Vec<db::RepoTagRow>, String> {
    db::attach_repository_tag(&state.0, &path_id, &tag_name, color_hex.as_deref())
        .await
        .map_err(|err| format!("Failed to attach repository tag: {}", err))?;

    db::fetch_repository_tags(&state.0, &path_id)
        .await
        .map_err(|err| format!("Failed to reload repository tag list: {}", err))
}

#[tauri::command]
pub async fn remove_repository_tag(
    state: tauri::State<'_, DbState>,
    path_id: String,
    tag_name: String,
) -> Result<Vec<db::RepoTagRow>, String> {
    db::detach_repository_tag(&state.0, &path_id, &tag_name)
        .await
        .map_err(|err| format!("Failed to detach repository tag: {}", err))?;

    db::fetch_repository_tags(&state.0, &path_id)
        .await
        .map_err(|err| format!("Failed to reload repository tag list: {}", err))
}

#[tauri::command]
pub async fn get_repository_tags(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<Vec<db::RepoTagRow>, String> {
    db::fetch_repository_tags(&state.0, &path_id)
        .await
        .map_err(|err| format!("Failed to fetch repository tag list: {}", err))
}

#[tauri::command]
pub async fn touch_repository_last_accessed(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<(), String> {
    db::touch_repository_last_accessed(&state.0, &path_id)
        .await
        .map_err(|err| format!("Failed to update repository last accessed timestamp: {}", err))?;

    Ok(())
}

#[tauri::command]
pub async fn get_quick_filter_metadata(
    state: tauri::State<'_, DbState>,
) -> Result<db::QuickFilterMetadata, String> {
    db::fetch_quick_filter_metadata(&state.0)
        .await
        .map_err(|err| format!("Failed to fetch quick filter metadata: {}", err))
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

// ==========================================
// Default branch detection + ahead/behind sync status
// ==========================================

/// Resolves the repository's default/"head" branch name (e.g. "main").
/// Strategy: 1) read the symbolic target of `refs/remotes/origin/HEAD` if present
/// (the most reliable signal, set by `git remote set-head origin -a` / most clone
/// operations), 2) otherwise fall back to a `main` -> `master` heuristic against the
/// repository's known local branches.
fn resolve_default_branch_name(repo: &Repository, local_branches: &[String]) -> Option<String> {
    if let Ok(origin_head) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Some(target) = origin_head.symbolic_target() {
            if let Some(name) = target.strip_prefix("refs/remotes/origin/") {
                return Some(name.to_string());
            }
        }
    }

    if local_branches.iter().any(|b| b == "main") {
        return Some("main".to_string());
    }
    if local_branches.iter().any(|b| b == "master") {
        return Some("master".to_string());
    }

    None
}

/// Computes how far `branch` is ahead/behind its configured upstream remote-tracking
/// branch (e.g. `origin/feature-x`). Returns `(ahead, behind, has_upstream)`.
fn compute_upstream_sync(repo: &Repository, branch: &Branch) -> (i64, i64, bool) {
    let local_oid = match branch.get().target() {
        Some(oid) => oid,
        None => return (0, 0, false),
    };

    match branch.upstream() {
        Ok(upstream) => match upstream.get().target() {
            Some(upstream_oid) => match repo.graph_ahead_behind(local_oid, upstream_oid) {
                Ok((ahead, behind)) => (ahead as i64, behind as i64, true),
                Err(_) => (0, 0, true),
            },
            None => (0, 0, false),
        },
        Err(_) => (0, 0, false),
    }
}

/// Computes how far `head_oid` has diverged from the repository's default/head branch,
/// useful for comparing a feature branch against `main` even when no remote is involved.
/// Returns `(ahead_of_default, behind_default)`.
fn compute_divergence_from_default(
    repo: &Repository,
    head_oid: Oid,
    default_branch_name: &str,
) -> Option<(i64, i64)> {
    let default_oid = repo
        .find_branch(default_branch_name, BranchType::Local)
        .ok()
        .and_then(|b| b.get().target())
        .or_else(|| {
            let remote_name = format!("origin/{}", default_branch_name);
            repo.find_branch(&remote_name, BranchType::Remote)
                .ok()
                .and_then(|b| b.get().target())
        })?;

    if default_oid == head_oid {
        return Some((0, 0));
    }

    repo.graph_ahead_behind(head_oid, default_oid)
        .ok()
        .map(|(ahead, behind)| (ahead as i64, behind as i64))
}

/// Opens the repository and computes branch/sync status for ONLY the currently
/// checked-out (HEAD) branch -- this matches exactly what RepositoryCard displays
/// and keeps the operation cheap even for repositories with many local branches.
pub(crate) fn analyze_repository_git_status(absolute_path: &str) -> Result<RepoGitStatusSnapshot, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let mut current_branch = "main".to_string();
    let mut available_branches = vec!["main".to_string()];
    let mut head_branch: Option<Branch> = None;

    if let Ok(branches) = repo.branches(Some(BranchType::Local)) {
        let mut local_branches = Vec::new();
        for branch_res in branches.flatten() {
            let (branch, _type) = branch_res;
            if let Ok(Some(name)) = branch.name() {
                let b_name = name.to_string();
                local_branches.push(b_name.clone());
                if branch.is_head() {
                    current_branch = b_name;
                    head_branch = Some(branch);
                }
            }
        }
        if !local_branches.is_empty() {
            available_branches = local_branches;
        }
    }

    let mut uncommitted_changes_count = 0;
    let mut diff_options = git2::DiffOptions::new();
    diff_options.include_untracked(true);
    if let Ok(diff) = repo.diff_index_to_workdir(None, Some(&mut diff_options)) {
        uncommitted_changes_count = diff.stats().map(|s| s.files_changed()).unwrap_or(0);
    }

    let default_branch_name = resolve_default_branch_name(&repo, &available_branches);

    let last_commit_hash = head_branch
        .as_ref()
        .and_then(|branch| branch.get().peel_to_commit().ok())
        .map(|commit| commit.id().to_string())
        .unwrap_or_default();

    let (ahead_count, behind_count, has_upstream) = match &head_branch {
        Some(branch) => compute_upstream_sync(&repo, branch),
        None => (0, 0, false),
    };

    let (ahead_of_default_count, behind_default_count) = match (&head_branch, &default_branch_name)
    {
        (Some(branch), Some(default_name)) => branch
            .get()
            .target()
            .and_then(|oid| compute_divergence_from_default(&repo, oid, default_name))
            .unwrap_or((0, 0)),
        _ => (0, 0),
    };

    Ok(RepoGitStatusSnapshot {
        current_branch,
        available_branches,
        uncommitted_changes_count,
        default_branch_name,
        last_commit_hash,
        ahead_count,
        behind_count,
        has_upstream,
        ahead_of_default_count,
        behind_default_count,
    })
}

/// Re-runs git status analysis for a tracked path and persists the results
/// (default branch name + HEAD branch sync counts) into the SQLite cache so the
/// dashboard reads fresh values on its next hydrate. Shared by the manual refresh
/// command and the fetch/pull/push operations below.
pub(crate) async fn refresh_and_cache_git_status(
    pool: &sqlx::SqlitePool,
    path_id: &str,
    absolute_path: &str,
) -> Result<RepoGitStatusSnapshot, String> {
    let snapshot = analyze_repository_git_status(absolute_path)?;

    db::update_default_branch_name(pool, path_id, snapshot.default_branch_name.as_deref())
        .await
        .map_err(|e| format!("Failed to persist default branch name: {}", e))?;

    db::upsert_head_branch_git_status(
        pool,
        path_id,
        &snapshot.current_branch,
        &snapshot.last_commit_hash,
        snapshot.ahead_count,
        snapshot.behind_count,
        snapshot.has_upstream,
        snapshot.ahead_of_default_count,
        snapshot.behind_default_count,
    )
    .await
    .map_err(|e| format!("Failed to cache branch sync status: {}", e))?;

    Ok(snapshot)
}

/// Recomputes and caches the default branch + ahead/behind sync status for a tracked
/// repository on demand (the "Refresh status" button on RepositoryCard). This is a
/// purely local recomputation -- it does NOT contact the remote; use Fetch for that.
#[tauri::command]
pub async fn refresh_repository_git_status(
    state: tauri::State<'_, DbState>,
    path_id: String,
    absolute_path: String,
) -> Result<RepoGitStatusSnapshot, String> {
    refresh_and_cache_git_status(&state.0, &path_id, &absolute_path).await
}

// ==========================================
// Real network operations: fetch / pull / push
// ==========================================

/// Builds git2 `RemoteCallbacks` wired to `auth-git2`'s credential negotiation
/// (SSH agent, SSH key files, the OS git credential helper, and cached HTTPS
/// credentials), then hands them to `action` for the duration of a single network
/// call. Credentials/config can't outlive this function, so callers must perform
/// their git2 network call inside the closure rather than returning the callbacks.
fn with_auth_callbacks<F, T>(repo: &Repository, action: F) -> Result<T, String>
where
    F: FnOnce(RemoteCallbacks) -> Result<T, git2::Error>,
{
    let config = repo
        .config()
        .map_err(|e| format!("Failed to read Git config: {}", e))?;
    let authenticator = auth_git2::GitAuthenticator::new();
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(authenticator.credentials(&config));
    action(callbacks).map_err(|e| format!("Git network operation failed: {}", e))
}

/// Fetches all configured refspecs from the repository's `origin` remote.
fn fetch_from_origin(repo: &Repository) -> Result<(), String> {
    repo.find_remote("origin")
        .map_err(|_| "This repository has no 'origin' remote configured.".to_string())?;

    with_auth_callbacks(repo, |callbacks| {
        let mut remote = repo.find_remote("origin")?;
        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);
        fetch_options.download_tags(AutotagOption::All);
        let empty_refspecs: Vec<String> = Vec::new();
        remote.fetch(&empty_refspecs, Some(&mut fetch_options), None)
    })
}

/// Pushes `refspec` to `origin`, surfacing any remote-side rejection reason
/// (e.g. non-fast-forward) as a readable error rather than a silent transport success.
fn push_branch_to_origin(repo: &Repository, refspec: &str) -> Result<(), String> {
    let config = repo
        .config()
        .map_err(|e| format!("Failed to read Git config: {}", e))?;
    let authenticator = auth_git2::GitAuthenticator::new();
    let rejection: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let rejection_for_callback = rejection.clone();

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(authenticator.credentials(&config));
    callbacks.push_update_reference(move |refname, status| {
        if let Some(message) = status {
            let mut guard = rejection_for_callback.lock().unwrap();
            *guard = Some(format!("Remote rejected '{}': {}", refname, message));
        }
        Ok(())
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("Failed to resolve 'origin' remote: {}", e))?;

    remote
        .push(&[refspec], Some(&mut push_options))
        .map_err(|e| format!("Push transport failed: {}", e))?;

    if let Some(message) = rejection.lock().unwrap().take() {
        return Err(message);
    }

    Ok(())
}

/// Contacts the repository's `origin` remote and updates local remote-tracking
/// refs (e.g. `origin/main`). Re-caches sync status immediately afterward so the
/// dashboard's ahead/behind pills don't wait for the background daemon's debounce.
#[tauri::command]
pub async fn git_fetch_operation(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<String, String> {
    let absolute_path = db::get_absolute_path_for_id(&state.0, &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let fetch_result = fetch_from_origin(&repo);

    let _ = refresh_and_cache_git_status(&state.0, &path_id, &absolute_path).await;

    fetch_result.map(|_| "Fetched the latest changes from origin.".to_string())
}

/// Fetches from `origin`, then fast-forwards the current branch to its upstream tip
/// if possible. Diverged branches return a clear error instead of attempting an
/// automatic merge commit or surfacing conflict-resolution UI (out of scope for now).
#[tauri::command]
pub async fn git_pull_operation(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<String, String> {
    let absolute_path = db::get_absolute_path_for_id(&state.0, &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    fetch_from_origin(&repo)?;

    let pull_result = (|| -> Result<String, String> {
        let head_ref = repo
            .head()
            .map_err(|e| format!("Failed to resolve HEAD: {}", e))?;
        let branch_name = head_ref
            .shorthand()
            .ok_or_else(|| "Could not determine the current branch name.".to_string())?
            .to_string();

        let local_branch = repo
            .find_branch(&branch_name, BranchType::Local)
            .map_err(|e| format!("Failed to read local branch '{}': {}", branch_name, e))?;

        let upstream_branch = local_branch.upstream().map_err(|_| {
            format!(
                "Branch '{}' has no upstream configured to pull from.",
                branch_name
            )
        })?;

        let upstream_oid = upstream_branch
            .get()
            .target()
            .ok_or_else(|| "Could not resolve the upstream branch tip.".to_string())?;

        let annotated_commit = repo
            .find_annotated_commit(upstream_oid)
            .map_err(|e| format!("Failed to read upstream commit: {}", e))?;

        let (analysis, _preference) = repo
            .merge_analysis(&[&annotated_commit])
            .map_err(|e| format!("Failed to analyze merge: {}", e))?;

        if analysis.is_up_to_date() {
            return Ok("Already up to date.".to_string());
        }

        if analysis.is_fast_forward() {
            let local_ref_name = format!("refs/heads/{}", branch_name);
            let mut reference = repo
                .find_reference(&local_ref_name)
                .map_err(|e| format!("Failed to find local branch reference: {}", e))?;

            reference
                .set_target(upstream_oid, "branch-schematic: fast-forward pull")
                .map_err(|e| format!("Failed to fast-forward branch '{}': {}", branch_name, e))?;

            repo.set_head(&local_ref_name)
                .map_err(|e| format!("Failed to update HEAD: {}", e))?;

            repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
                .map_err(|e| format!("Failed to checkout fast-forwarded files: {}", e))?;

            return Ok(format!(
                "Fast-forwarded '{}' to match its upstream.",
                branch_name
            ));
        }

        Err(format!(
            "Branch '{}' has diverged from its upstream and requires a manual merge. Pull only supports fast-forward updates.",
            branch_name
        ))
    })();

    let _ = refresh_and_cache_git_status(&state.0, &path_id, &absolute_path).await;

    pull_result
}

/// Pushes the current branch to its already-configured upstream on `origin`.
/// Does not create a new remote branch or set up tracking for unpublished branches
/// (a "publish branch" flow is a possible future addition).
#[tauri::command]
pub async fn git_push_operation(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<String, String> {
    let absolute_path = db::get_absolute_path_for_id(&state.0, &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let push_result = (|| -> Result<String, String> {
        let head_ref = repo
            .head()
            .map_err(|e| format!("Failed to resolve HEAD: {}", e))?;
        let branch_name = head_ref
            .shorthand()
            .ok_or_else(|| "Could not determine the current branch name.".to_string())?
            .to_string();

        let local_branch = repo
            .find_branch(&branch_name, BranchType::Local)
            .map_err(|e| format!("Failed to read local branch '{}': {}", branch_name, e))?;

        local_branch.upstream().map_err(|_| {
            format!(
                "Branch '{}' has no upstream branch configured to push to.",
                branch_name
            )
        })?;

        let refspec = format!("refs/heads/{branch_name}:refs/heads/{branch_name}");
        push_branch_to_origin(&repo, &refspec)?;

        Ok(format!("Pushed '{}' to origin.", branch_name))
    })();

    let _ = refresh_and_cache_git_status(&state.0, &path_id, &absolute_path).await;

    push_result
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
    fn test_resolve_repository_target_path_uses_subfolder_when_enabled() {
        let parent = std::path::Path::new("repos");
        let target = resolve_repository_target_path(parent, "My Repo", true).unwrap();

        assert_eq!(target, parent.join("My-Repo"));
    }

    #[test]
    fn test_resolve_repository_target_path_uses_parent_when_disabled() {
        let parent = std::path::Path::new("repos");
        let target = resolve_repository_target_path(parent, "My Repo", false).unwrap();

        assert_eq!(target, parent.to_path_buf());
    }

    #[test]
    fn test_resolve_repository_target_path_replaces_spaces_with_hyphens() {
        let parent = std::path::Path::new("repos");
        let target = resolve_repository_target_path(parent, "My New Repo", true).unwrap();

        assert_eq!(target, parent.join("My-New-Repo"));
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

    #[test]
    fn test_resolve_default_branch_name_prefers_main_over_master() {
        // No `refs/remotes/origin/HEAD` exists in this local-only test repo, so
        // resolution should fall through to the local-branch heuristic and prefer
        // "main" over "master" when both are present.
        let (repo_path, repo) = create_test_repo("test_default_branch_main_vs_master");
        create_initial_commit(&repo, &repo_path);

        // The initial commit may land on "main" or "master" depending on the local
        // git init.defaultBranch config; force it onto "main" so the test is
        // deterministic, then add a "master" branch pointing at the same commit.
        let mut head_ref = repo.head().unwrap();
        head_ref.rename("refs/heads/main", true, "test setup").unwrap();

        let head_commit = repo.head().unwrap().peel_to_commit().unwrap();
        if repo.find_branch("master", BranchType::Local).is_err() {
            repo.branch("master", &head_commit, false).unwrap();
        }

        let local_branches = vec!["main".to_string(), "master".to_string()];
        let resolved = resolve_default_branch_name(&repo, &local_branches);

        assert_eq!(resolved, Some("main".to_string()));

        // Clean up
        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_resolve_default_branch_name_falls_back_to_master() {
        let (repo_path, repo) = create_test_repo("test_default_branch_master_only");
        create_initial_commit(&repo, &repo_path);

        // `create_test_repo` + `create_initial_commit` produce a default branch named
        // either "main" or "master" depending on the local git config; rename it to
        // "master" explicitly so this test is deterministic regardless of environment.
        let mut head_ref = repo.head().unwrap();
        head_ref.rename("refs/heads/master", true, "test setup").unwrap();

        let local_branches = vec!["master".to_string()];
        let resolved = resolve_default_branch_name(&repo, &local_branches);

        assert_eq!(resolved, Some("master".to_string()));

        // Clean up
        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_compute_divergence_from_default_after_diverging_commits() {
        let (repo_path, repo) = create_test_repo("test_divergence_from_default");
        create_initial_commit(&repo, &repo_path);

        let base_commit = repo.head().unwrap().peel_to_commit().unwrap();
        let default_branch_name = repo
            .head()
            .unwrap()
            .shorthand()
            .unwrap_or("main")
            .to_string();

        // Create a feature branch off the default branch, then add one commit to it
        // while leaving the default branch untouched -- the feature branch should end
        // up exactly 1 commit ahead and 0 commits behind the default branch.
        repo.branch("feature", &base_commit, false).unwrap();
        repo.set_head("refs/heads/feature").unwrap();
        repo.checkout_head(None).unwrap();

        let file_path = repo_path.join("feature.txt");
        let mut file = File::create(file_path).unwrap();
        writeln!(file, "feature work").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("feature.txt")).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let signature = repo.signature().unwrap();
        let parent_commit = repo.head().unwrap().peel_to_commit().unwrap();

        let feature_oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Feature commit",
                &tree,
                &[&parent_commit],
            )
            .unwrap();

        let divergence = compute_divergence_from_default(&repo, feature_oid, &default_branch_name);

        assert_eq!(divergence, Some((1, 0)));

        // Clean up
        fs::remove_dir_all(repo_path).unwrap();
    }
}
