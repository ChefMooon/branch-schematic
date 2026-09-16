use crate::auth;
use crate::db;
use crate::manager::{RefreshPriority, WatcherManager};
use crate::DbState;
use git2::{
    AutotagOption, Branch, BranchType, Cred, CredentialType, Direction, FetchOptions, Oid,
    PushOptions, RemoteCallbacks, Repository, RepositoryState, ResetType,
};
use reqwest::header::{HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::{Arc, Mutex};
use std::{
    fs,
    path::{Component, Path, PathBuf},
};
use uuid::Uuid;

static GIT_MUTATION_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn enrich_commit_push_states(
    absolute_path: &str,
    branch_name: &str,
    commits: &mut [db::CachedCommitRow],
) -> Result<(), String> {
    for commit in commits.iter_mut() {
        commit.push_state = Some("unknown".to_string());
    }

    let repo = Repository::open(absolute_path)
        .map_err(|error| format!("Failed to open repository for commit history: {error}"))?;
    let branch = match repo.find_branch(branch_name, BranchType::Local) {
        Ok(branch) => branch,
        Err(_) => return Ok(()),
    };
    let upstream = match branch.upstream() {
        Ok(upstream) => upstream,
        Err(error) if error.code() == git2::ErrorCode::NotFound => return Ok(()),
        Err(_) => return Ok(()),
    };
    let Some(upstream_oid) = upstream.get().target() else {
        return Ok(());
    };

    for commit in commits {
        let Ok(commit_oid) = Oid::from_str(&commit.commit_hash) else {
            continue;
        };
        commit.push_state = Some(
            classify_commit_push_state(&repo, commit_oid, upstream_oid)
                .unwrap_or("unknown")
                .to_string(),
        );
    }

    Ok(())
}

fn classify_commit_push_state(
    repo: &Repository,
    commit_oid: Oid,
    upstream_oid: Oid,
) -> Option<&'static str> {
    if commit_oid == upstream_oid {
        return Some("pushed");
    }

    if repo.find_commit(commit_oid).is_err() {
        return Some("unknown");
    }

    let upstream_contains_commit = repo.graph_descendant_of(upstream_oid, commit_oid).ok()?;
    let commit_contains_upstream = repo.graph_descendant_of(commit_oid, upstream_oid).ok()?;

    if upstream_contains_commit {
        Some("pushed")
    } else if commit_contains_upstream {
        Some("unpushed")
    } else {
        Some("unknown")
    }
}

pub(crate) fn compute_unpushed_commit_count(repo: &Repository, branch: &Branch) -> Option<i64> {
    let local_oid = branch.get().target()?;
    let upstream_oid = branch.upstream().ok()?.get().target()?;
    let mut revwalk = repo.revwalk().ok()?;
    revwalk.push(local_oid).ok()?;

    let mut count = 0_i64;
    for commit_oid in revwalk {
        let commit_oid = commit_oid.ok()?;
        if classify_commit_push_state(repo, commit_oid, upstream_oid)? == "unpushed" {
            count += 1;
        }
    }

    Some(count)
}

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
#[serde(rename_all = "camelCase")]
pub struct RepositoryChangeItem {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub staged: bool,
    pub is_conflicted: bool,
    pub is_binary: bool,
    pub diff_available: bool,
    pub diff_summary: Option<String>,
    pub can_stage: bool,
    pub can_unstage: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryChangesSnapshot {
    pub entries: Vec<RepositoryChangeItem>,
    pub is_in_progress_operation: bool,
    pub operation_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryChangesRead {
    pub revision: u64,
    pub unchanged: bool,
    pub snapshot: Option<RepositoryChangesSnapshot>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LatestCommitInfo {
    pub hash: String,
    pub author_name: String,
    pub message: String,
    pub subject: String,
    pub committed_at: i64,
    pub can_undo: bool,
    pub undo_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryFileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub patch: Option<String>,
    pub is_binary: bool,
    pub is_truncated: bool,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub is_binary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceDetails {
    pub id: String,
    pub display_name: String,
    pub alias_name: Option<String>,
    pub absolute_path: String,
    pub repo_origin_type: String,
    pub github_owner_login: Option<String>,
    pub current_branch: String,
    pub available_branches: Vec<String>,
    pub uncommitted_changes_count: usize,
    pub is_favorite: i64,
    pub is_pinned: i64,
    pub group_id: Option<String>,
    pub custom_group: Option<String>,
    pub last_accessed_at: Option<String>,
    pub tags_json: String,
    pub default_branch_name: Option<String>,
    pub theme_color_hex: Option<String>,
    pub icon_name: Option<String>,
    pub ahead_count: i64,
    pub behind_count: i64,
    pub has_upstream: bool,
    pub unpushed_commit_count: Option<i64>,
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
    pub unpushed_commit_count: Option<i64>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteRepositoryOwner {
    pub login: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteRepository {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub owner: RemoteRepositoryOwner,
    pub owner_login: String,
    pub description: Option<String>,
    #[serde(rename = "private")]
    pub is_private: bool,
    pub fork: bool,
    pub permissions_push: bool,
    pub default_branch: String,
    pub updated_at: String,
    pub clone_url: String,
    pub ssh_url: String,
    pub html_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteRepositoryPage {
    pub items: Vec<RemoteRepository>,
    pub page: u32,
    pub per_page: u32,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteBranchCommit {
    pub sha: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteBranch {
    pub name: String,
    pub commit: RemoteBranchCommit,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteBranchPage {
    pub items: Vec<RemoteBranch>,
    pub page: u32,
    pub per_page: u32,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloneRemoteRepositoryResult {
    pub path_id: String,
    pub absolute_path: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedRemoteRepositorySlug {
    pub owner: String,
    pub repo_name: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRepoOwnerPayload {
    login: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRepoPermissionsPayload {
    #[serde(default)]
    push: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubRepoPayload {
    id: i64,
    name: String,
    full_name: String,
    owner: GitHubRepoOwnerPayload,
    description: Option<String>,
    #[serde(rename = "private")]
    is_private: bool,
    #[serde(default)]
    fork: bool,
    permissions: Option<GitHubRepoPermissionsPayload>,
    default_branch: Option<String>,
    updated_at: Option<String>,
    clone_url: Option<String>,
    ssh_url: Option<String>,
    html_url: Option<String>,
}

struct GitHubSingleRepoMeta {
    fork: bool,
    owner_login: String,
    permissions_push: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubBranchCommitPayload {
    sha: String,
}

#[derive(Debug, Deserialize)]
struct GitHubBranchPayload {
    name: String,
    commit: GitHubBranchCommitPayload,
}

fn normalize_api_base_url(profile: &auth::RemoteAuthProfile) -> String {
    profile
        .api_base_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("https://api.github.com")
        .trim_end_matches('/')
        .to_string()
}

fn ensure_remote_access(profile: &auth::RemoteAuthProfile) -> Result<String, String> {
    if profile.auth_level != "full_oauth" {
        return Err("Remote operations require a full OAuth profile.".to_string());
    }

    let token = profile
        .token_value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "The selected profile does not have an OAuth token.".to_string())?
        .to_string();

    Ok(token)
}

fn describe_git2_network_error(context: &str, error: git2::Error) -> String {
    let category = classify_git2_error(&error);
    let guidance = match category {
        GitFailureCategory::Authentication =>
            "Git could not authenticate with the configured remote. Check the selected profile, OS-managed Git credentials, or SSH agent, then try again.",
        GitFailureCategory::Permission =>
            "The remote denied permission to update this repository. Check the selected profile and repository write access.",
        GitFailureCategory::Transport =>
            "Git could not reach the configured remote. Check the remote URL and network connection, then try again.",
        GitFailureCategory::RemoteRejected =>
            "The remote rejected the Git update. Check branch protection, permissions, and whether the remote branch changed.",
        GitFailureCategory::RemoteConfiguration =>
            "Git could not use the configured remote. Check the remote URL and repository configuration, then try again.",
    };
    format!(
        "{context} [{category}; git_error_code={:?}]. {guidance}",
        error.code()
    )
}

fn normalize_pagination(page: Option<u32>, per_page: Option<u32>) -> (u32, u32) {
    let normalized_page = page.unwrap_or(1).max(1);
    let normalized_per_page = per_page.unwrap_or(30).clamp(1, 100);
    (normalized_page, normalized_per_page)
}

fn build_bearer_auth_header(token: &str) -> Result<HeaderValue, String> {
    let value = format!("Bearer {}", token.trim());
    HeaderValue::from_str(&value).map_err(|_| {
        "The stored OAuth token is malformed and cannot be used for GitHub requests. Reconnect the profile to refresh the token.".to_string()
    })
}

fn derive_origin_type(
    meta: &GitHubSingleRepoMeta,
    authenticated_username: Option<&str>,
) -> &'static str {
    if meta.fork {
        return "FORK";
    }

    if let Some(username) = authenticated_username
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if meta.owner_login.eq_ignore_ascii_case(username) {
            return "OWNED";
        }

        if meta.permissions_push {
            return "CONTRIBUTOR";
        }
    }

    "OWNED"
}

async fn fetch_single_github_repo_metadata(
    profile: &auth::RemoteAuthProfile,
    owner: &str,
    repo_name: &str,
) -> Option<GitHubSingleRepoMeta> {
    let token = ensure_remote_access(profile).ok()?;
    let authorization_header = build_bearer_auth_header(&token).ok()?;
    let api_base_url = normalize_api_base_url(profile);
    let endpoint = format!("{}/repos/{}/{}", api_base_url, owner, repo_name);

    if url::Url::parse(&endpoint).is_err() {
        eprintln!(
            "Skipping GitHub repo metadata fetch for profile {} because the API base URL is invalid.",
            profile.id
        );
        return None;
    }

    let response = match reqwest::Client::new()
        .get(&endpoint)
        .header(USER_AGENT, "branch-schematic")
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, authorization_header)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            eprintln!(
                "Failed to request GitHub repo metadata for profile {} and repo {}/{}: {}",
                profile.id, owner, repo_name, error
            );
            return None;
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!(
            "GitHub repo metadata request failed for profile {} and repo {}/{} ({}): {}",
            profile.id, owner, repo_name, status, body
        );
        return None;
    }

    let payload: GitHubRepoPayload = match response.json().await {
        Ok(payload) => payload,
        Err(error) => {
            eprintln!(
                "Failed to decode GitHub repo metadata for profile {} and repo {}/{}: {}",
                profile.id, owner, repo_name, error
            );
            return None;
        }
    };

    Some(GitHubSingleRepoMeta {
        fork: payload.fork,
        owner_login: payload.owner.login,
        permissions_push: payload
            .permissions
            .map(|permissions| permissions.push)
            .unwrap_or(false),
    })
}

async fn resolve_repository_origin_metadata(
    pool: &sqlx::SqlitePool,
    remote_url: Option<&str>,
    profile_id: Option<&str>,
    enrich_via_api: bool,
) -> (String, Option<String>) {
    let Some(remote_url) = remote_url.map(str::trim).filter(|value| !value.is_empty()) else {
        return ("LOCAL_ONLY".to_string(), None);
    };

    let parsed_slug = parse_owner_and_repo_from_url(remote_url);
    let mut github_owner_login = parsed_slug.as_ref().map(|(owner, _)| owner.clone());

    if !enrich_via_api {
        return ("OWNED".to_string(), github_owner_login);
    }

    let Some((owner, repo_name)) = parsed_slug else {
        return ("OWNED".to_string(), None);
    };

    let resolved_profile = match auth::resolve_profile_for_remote(pool, profile_id).await {
        Ok(profile) => profile,
        Err(error) => {
            eprintln!(
                "Skipping GitHub enrichment for remote '{}' because profile resolution failed: {}",
                remote_url, error
            );
            return ("OWNED".to_string(), github_owner_login);
        }
    };

    let profile = &resolved_profile.profile;

    let Some(meta) = fetch_single_github_repo_metadata(&profile, &owner, &repo_name).await else {
        return ("OWNED".to_string(), github_owner_login);
    };

    let repo_origin_type = derive_origin_type(&meta, profile.username.as_deref()).to_string();
    github_owner_login = Some(meta.owner_login);

    (repo_origin_type, github_owner_login)
}

fn describe_remote_repository_listing_error(raw_error: &str) -> String {
    let trimmed = raw_error.trim();
    if trimmed.contains("missing the 'repo' scope") || trimmed.contains("missing the repo scope") {
        return "The connected OAuth token is missing the repo scope required to list private repositories. Reconnect the profile and grant repository access.".to_string();
    }

    if trimmed.contains("OAuth token") {
        return "We couldn't load repositories because the selected profile is not fully authorized. Reconnect the profile and try again.".to_string();
    }

    if trimmed.contains("full OAuth profile") {
        return "We couldn't load repositories because the selected profile is not a full OAuth profile. Update the profile and try again.".to_string();
    }

    if trimmed.contains("No active profile") {
        return "We couldn't load repositories because no active profile is available. Choose or reconnect a profile and try again.".to_string();
    }

    if trimmed.contains("Remote repository request failed (401)") {
        return "GitHub rejected the OAuth token (401). Reconnect the profile and authorize again."
            .to_string();
    }

    if trimmed.contains("Remote repository request failed (403)") {
        let lowered = trimmed.to_lowercase();
        if lowered.contains("rate limit") {
            return "GitHub API rate limit was exceeded (403). Wait a few minutes and try again."
                .to_string();
        }

        if lowered.contains("saml") || lowered.contains("sso") {
            return "GitHub blocked repository access due to organization SSO requirements. Authorize this OAuth app for the organization, then try again.".to_string();
        }

        return "GitHub denied repository access (403). Ensure OAuth scopes include repository access and organization access where needed.".to_string();
    }

    if trimmed.contains("Remote repository request failed (404)") {
        return "The configured GitHub API base URL returned 404 for /user/repos. Verify the profile API base URL.".to_string();
    }

    if let Some((_, detail)) = trimmed.split_once("Failed to request remote repositories:") {
        let clean_detail = detail.trim();
        if !clean_detail.is_empty() {
            return format!(
                "We couldn't reach GitHub to load repositories. Network detail: {}",
                clean_detail
            );
        }

        return "We couldn't load repositories from GitHub right now. Check your connection and try again.".to_string();
    }

    if trimmed.contains("Failed to request remote repositories") {
        return "We couldn't load repositories from GitHub right now. Check your connection and try again.".to_string();
    }

    if trimmed.contains("Remote repository request failed") {
        if let (Some(body_start), Some(body_end)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if body_end > body_start {
                let json_slice = &trimmed[body_start..=body_end];
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_slice) {
                    if let Some(message) = parsed.get("message").and_then(serde_json::Value::as_str)
                    {
                        let clean_message = message.trim();
                        if !clean_message.is_empty() {
                            return format!("GitHub rejected repository listing: {clean_message}");
                        }
                    }
                }
            }
        }

        return "GitHub rejected repository listing. Verify the OAuth profile token and permissions, then try again.".to_string();
    }

    trimmed.to_string()
}

async fn fetch_remote_repositories_page(
    profile: &auth::RemoteAuthProfile,
    page: u32,
    per_page: u32,
) -> Result<RemoteRepositoryPage, String> {
    let token = ensure_remote_access(profile)?;
    let authorization_header = build_bearer_auth_header(&token)?;
    let api_base_url = normalize_api_base_url(profile);
    let endpoint = format!("{}/user/repos", api_base_url);
    url::Url::parse(&endpoint)
        .map_err(|_| format!("The profile API base URL is invalid: {}", api_base_url))?;

    let query = vec![
        ("page", page.to_string()),
        ("per_page", per_page.to_string()),
        ("sort", "updated".to_string()),
        ("visibility", "all".to_string()),
        (
            "affiliation",
            "owner,collaborator,organization_member".to_string(),
        ),
    ];

    let response = reqwest::Client::new()
        .get(&endpoint)
        .query(&query)
        .header(USER_AGENT, "branch-schematic")
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, authorization_header)
        .send()
        .await
        .map_err(|error| format!("Failed to request remote repositories: {}", error))?;

    let has_more = response
        .headers()
        .get("link")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("rel=\"next\""))
        .unwrap_or(false);

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!(
            "Remote repository request failed for profile {} ({}): {}",
            profile.id, status, body
        );
        return Err(format!(
            "Remote repository request failed ({}): {}",
            status, body
        ));
    }

    let payloads: Vec<GitHubRepoPayload> = response
        .json()
        .await
        .map_err(|error| format!("Failed to decode remote repositories response: {}", error))?;

    let items = payloads
        .into_iter()
        .map(|repository| {
            let owner_login = repository.owner.login;
            let permissions_push = repository
                .permissions
                .as_ref()
                .map(|permissions| permissions.push)
                .unwrap_or(false);

            RemoteRepository {
                id: repository.id.to_string(),
                name: repository.name,
                full_name: repository.full_name,
                owner: RemoteRepositoryOwner {
                    login: owner_login.clone(),
                },
                owner_login,
                description: repository.description,
                is_private: repository.is_private,
                fork: repository.fork,
                permissions_push,
                default_branch: repository
                    .default_branch
                    .unwrap_or_else(|| "main".to_string()),
                updated_at: repository.updated_at.unwrap_or_default(),
                clone_url: repository.clone_url.unwrap_or_default(),
                ssh_url: repository.ssh_url.unwrap_or_default(),
                html_url: repository.html_url.unwrap_or_default(),
            }
        })
        .collect();

    Ok(RemoteRepositoryPage {
        items,
        page,
        per_page,
        has_more,
    })
}

async fn fetch_remote_branches_page(
    profile: &auth::RemoteAuthProfile,
    owner: &str,
    repo_name: &str,
    page: u32,
    per_page: u32,
) -> Result<RemoteBranchPage, String> {
    let token = ensure_remote_access(profile)?;
    let authorization_header = build_bearer_auth_header(&token)?;
    let api_base_url = normalize_api_base_url(profile);
    let endpoint = format!("{}/repos/{}/{}/branches", api_base_url, owner, repo_name);
    url::Url::parse(&endpoint)
        .map_err(|_| format!("The profile API base URL is invalid: {}", api_base_url))?;

    let response = reqwest::Client::new()
        .get(&endpoint)
        .query(&[
            ("page", page.to_string()),
            ("per_page", per_page.to_string()),
        ])
        .header(USER_AGENT, "branch-schematic")
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, authorization_header)
        .send()
        .await
        .map_err(|error| format!("Failed to request remote branches: {}", error))?;

    let has_more = response
        .headers()
        .get("link")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("rel=\"next\""))
        .unwrap_or(false);

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!(
            "Remote branch request failed for profile {} ({}): {}",
            profile.id, status, body
        );
        return Err(format!(
            "Remote branch request failed ({}): {}",
            status, body
        ));
    }

    let payloads: Vec<GitHubBranchPayload> = response
        .json()
        .await
        .map_err(|error| format!("Failed to decode remote branches response: {}", error))?;

    let items = payloads
        .into_iter()
        .map(|branch| RemoteBranch {
            name: branch.name,
            commit: RemoteBranchCommit {
                sha: branch.commit.sha,
            },
        })
        .collect();

    Ok(RemoteBranchPage {
        items,
        page,
        per_page,
        has_more,
    })
}

fn parse_repo_name_from_url(repo_url: &str) -> Option<String> {
    let trimmed = repo_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_git_suffix = trimmed.strip_suffix(".git").unwrap_or(trimmed);
    let segment = without_git_suffix
        .rsplit_once('/')
        .map(|(_, tail)| tail)
        .or_else(|| without_git_suffix.rsplit_once(':').map(|(_, tail)| tail))?;

    let parsed = segment.trim();
    if parsed.is_empty() {
        return None;
    }

    Some(parsed.to_string())
}

fn parse_owner_and_repo_from_url(repo_url: &str) -> Option<(String, String)> {
    let trimmed = repo_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    // HTTPS-style remotes: https://host/owner/repo(.git)
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        let parsed_url = url::Url::parse(trimmed).ok()?;
        let segments: Vec<&str> = parsed_url
            .path_segments()?
            .filter(|segment| !segment.trim().is_empty())
            .collect();
        if segments.len() < 2 {
            return None;
        }

        let owner = segments[segments.len() - 2].trim();
        let repo = segments[segments.len() - 1]
            .trim()
            .strip_suffix(".git")
            .unwrap_or(segments[segments.len() - 1].trim());

        if owner.is_empty() || repo.is_empty() {
            return None;
        }

        return Some((owner.to_string(), repo.to_string()));
    }

    // SSH-style remotes: git@host:owner/repo(.git)
    if trimmed.starts_with("git@") {
        let (_, slug) = trimmed.rsplit_once(':')?;
        let cleaned_slug = slug.trim().trim_start_matches('/').trim_end_matches('/');
        if cleaned_slug.is_empty() {
            return None;
        }

        let mut parts = cleaned_slug
            .split('/')
            .filter(|segment| !segment.trim().is_empty());
        let owner = parts.next()?.trim();
        let repo_raw = parts.next()?.trim();
        let repo = repo_raw.strip_suffix(".git").unwrap_or(repo_raw);

        if owner.is_empty() || repo.is_empty() {
            return None;
        }

        return Some((owner.to_string(), repo.to_string()));
    }

    None
}

fn derive_clone_base_from_api(api_base_url: &str) -> Result<String, String> {
    let parsed = url::Url::parse(api_base_url.trim())
        .map_err(|error| format!("Invalid API base URL '{}': {}", api_base_url, error))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "The API base URL does not have a host.".to_string())?;
    Ok(format!("{}://{}", parsed.scheme(), host))
}

fn resolve_clone_url(
    profile: Option<&auth::RemoteAuthProfile>,
    owner: Option<&str>,
    repo_name: Option<&str>,
    repo_url: Option<&str>,
) -> Result<String, String> {
    if let Some(raw_url) = repo_url.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(raw_url.to_string());
    }

    let owner = owner
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "An owner is required when repo_url is not provided.".to_string())?;
    let repo_name = repo_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "A repository name is required when repo_url is not provided.".to_string()
        })?;

    let clone_base = if let Some(active_profile) = profile {
        let api_base_url = normalize_api_base_url(active_profile);
        if api_base_url.contains("api.github.com") {
            "https://github.com".to_string()
        } else {
            derive_clone_base_from_api(&api_base_url)?
        }
    } else {
        "https://github.com".to_string()
    };

    Ok(format!(
        "{}/{}/{}.git",
        clone_base.trim_end_matches('/'),
        owner,
        repo_name
    ))
}

#[tauri::command]
pub async fn list_remote_repositories(
    state: tauri::State<'_, DbState>,
    profile_id: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<RemoteRepositoryPage, String> {
    let (page, per_page) = normalize_pagination(page, per_page);
    let resolved_profile =
        auth::resolve_profile_for_remote(state.inner().pool(), profile_id.as_deref()).await?;

    fetch_remote_repositories_page(&resolved_profile.profile, page, per_page)
        .await
        .map_err(|error| describe_remote_repository_listing_error(&error))
}

#[tauri::command]
pub async fn list_enterprise_repositories(
    state: tauri::State<'_, DbState>,
    profile_id: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<RemoteRepositoryPage, String> {
    let resolved_profile =
        auth::resolve_profile_for_remote(state.inner().pool(), profile_id.as_deref()).await?;

    if resolved_profile
        .profile
        .api_base_url
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        return Err("Enterprise profile configuration is missing an API base URL.".to_string());
    }

    let (page, per_page) = normalize_pagination(page, per_page);
    fetch_remote_repositories_page(&resolved_profile.profile, page, per_page)
        .await
        .map_err(|error| describe_remote_repository_listing_error(&error))
}

#[tauri::command]
pub async fn list_remote_branches(
    state: tauri::State<'_, DbState>,
    profile_id: Option<String>,
    owner: String,
    repo_name: String,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<RemoteBranchPage, String> {
    let owner = owner.trim().to_string();
    let repo_name = repo_name.trim().to_string();
    if owner.is_empty() || repo_name.is_empty() {
        return Err("Owner and repository name are required to list branches.".to_string());
    }

    let resolved_profile =
        auth::resolve_profile_for_remote(state.inner().pool(), profile_id.as_deref()).await?;
    let (page, per_page) = normalize_pagination(page, per_page);

    fetch_remote_branches_page(
        &resolved_profile.profile,
        &owner,
        &repo_name,
        page,
        per_page,
    )
    .await
}

#[tauri::command]
pub async fn clone_remote_repository(
    state: tauri::State<'_, DbState>,
    manager: tauri::State<'_, WatcherManager>,
    profile_id: Option<String>,
    owner: Option<String>,
    repo_name: Option<String>,
    repo_url: Option<String>,
    branch: Option<String>,
    destination_path: String,
    clone_into_subfolder: Option<bool>,
) -> Result<CloneRemoteRepositoryResult, String> {
    let destination = Path::new(destination_path.trim());
    if destination.as_os_str().is_empty() {
        return Err("A destination path is required.".to_string());
    }

    if !destination.exists() || !destination.is_dir() {
        return Err("The destination path must be an existing directory.".to_string());
    }

    let resolved_profile =
        auth::resolve_profile_for_remote(state.inner().pool(), profile_id.as_deref()).await?;
    let profile = &resolved_profile.profile;
    let clone_url = resolve_clone_url(
        Some(profile),
        owner.as_deref(),
        repo_name.as_deref(),
        repo_url.as_deref(),
    )?;

    let inferred_repo_name = repo_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| parse_repo_name_from_url(&clone_url))
        .ok_or_else(|| {
            "Unable to determine a repository name for the clone destination.".to_string()
        })?;

    let target_path = resolve_repository_target_path(
        destination,
        &inferred_repo_name,
        clone_into_subfolder.unwrap_or(true),
    )?;
    if target_path.exists() {
        return Err(format!(
            "The destination '{}' already exists.",
            target_path.display()
        ));
    }

    {
        with_built_remote_callbacks(None, Some(profile), &clone_url, |callbacks| {
            let mut fetch_options = FetchOptions::new();
            fetch_options.remote_callbacks(callbacks);
            fetch_options.download_tags(AutotagOption::All);

            let mut builder = git2::build::RepoBuilder::new();
            builder.fetch_options(fetch_options);

            if let Some(branch_name) = branch
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                builder.branch(branch_name);
            }

            builder.clone(&clone_url, &target_path).map(|_| ())
        })?;
    }

    let target_path_string = target_path
        .to_str()
        .ok_or_else(|| "Failed to resolve cloned repository path.".to_string())?
        .to_string();

    let track_result = track_repository_path(
        state.inner().pool(),
        &target_path_string,
        profile_id.as_deref(),
    )
    .await?;
    let path_id =
        db::fetch_tracked_path_id_by_absolute_path(state.inner().pool(), &target_path_string)
            .await
            .map_err(|error| format!("Failed to resolve tracked repository id: {}", error))?
            .ok_or_else(|| "The cloned repository could not be tracked.".to_string())?;

    if let Some(selected_profile_id) = profile_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
    {
        sqlx::query(
            "INSERT INTO repository_profile_assignments (repo_path_id, profile_id)
             VALUES ($1, $2)
             ON CONFLICT(repo_path_id) DO UPDATE SET profile_id = excluded.profile_id, assigned_at = CURRENT_TIMESTAMP",
        )
        .bind(&path_id)
        .bind(selected_profile_id)
        .execute(state.inner().pool())
        .await
        .map_err(|error| format!("Unable to persist the selected repository profile: {error}"))?;
    }

    manager
        .ensure_monitored(
            path_id.clone(),
            target_path_string.clone(),
            RefreshPriority::Foreground,
        )
        .await?;

    Ok(CloneRemoteRepositoryResult {
        path_id,
        absolute_path: target_path_string,
        message: track_result.message,
    })
}

#[tauri::command]
pub fn parse_remote_repository_slug(
    repo_url: String,
) -> Result<ParsedRemoteRepositorySlug, String> {
    let (owner, repo_name) = parse_owner_and_repo_from_url(&repo_url).ok_or_else(|| {
        "Unable to parse owner and repository name from URL. Use a GitHub or GitHub Enterprise HTTPS/SSH URL."
            .to_string()
    })?;

    Ok(ParsedRemoteRepositorySlug { owner, repo_name })
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

fn resolve_repository_target_path(
    parent_path: &Path,
    repo_name: &str,
    create_in_subfolder: bool,
) -> Result<std::path::PathBuf, String> {
    let cleaned_name = sanitize_repository_name(repo_name);
    if create_in_subfolder {
        let target_dir = parent_path.join(cleaned_name);
        Ok(target_dir)
    } else {
        Ok(parent_path.to_path_buf())
    }
}

fn initialize_repository_structure(
    path: &Path,
    include_readme: bool,
    repo_name: &str,
    repo_description: &str,
    gitignore_template: &str,
    license_template: &str,
) -> Result<(), String> {
    if path.exists() && path.is_file() {
        return Err(format!("'{}' is a file, not a directory.", path.display()));
    }

    if !path.exists() {
        fs::create_dir_all(path).map_err(|error| {
            format!(
                "Failed to create repository directory '{}': {}",
                path.display(),
                error
            )
        })?;
    }

    let is_existing_repo = Repository::open(path).is_ok();
    if !is_existing_repo {
        Repository::init(path).map_err(|error| {
            format!(
                "Failed to initialize Git repository at '{}': {}",
                path.display(),
                error
            )
        })?;
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
            fs::write(&readme_path, content).map_err(|error| {
                format!(
                    "Failed to write README at '{}': {}",
                    readme_path.display(),
                    error
                )
            })?;
        }
    }

    let gitignore_path = path.join(".gitignore");
    if !gitignore_path.exists() {
        let default_gitignore = match gitignore_template {
            "node" => "node_modules/\ndist/\n.env\n",
            "rust" => "target/\nCargo.lock\n",
            _ => "*.log\n",
        };
        fs::write(&gitignore_path, default_gitignore).map_err(|error| {
            format!(
                "Failed to write .gitignore at '{}': {}",
                gitignore_path.display(),
                error
            )
        })?;
    }

    let gitattributes_path = path.join(".gitattributes");
    if !gitattributes_path.exists() {
        let default_gitattributes =
            "# Auto detect text files and perform LF normalization\n* text=auto\n";
        fs::write(&gitattributes_path, default_gitattributes).map_err(|error| {
            format!(
                "Failed to write .gitattributes at '{}': {}",
                gitattributes_path.display(),
                error
            )
        })?;
    }

    let license_path = path.join("LICENSE");
    if !license_path.exists() {
        let default_license = match license_template {
            "mit" => "MIT License\n\nCopyright (c) 2026\n",
            "apache" => "Apache License 2.0\n\nCopyright (c) 2026\n",
            _ => "Copyright (c) 2026\n",
        };
        fs::write(&license_path, default_license).map_err(|error| {
            format!(
                "Failed to write LICENSE at '{}': {}",
                license_path.display(),
                error
            )
        })?;
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

    let target_path =
        resolve_repository_target_path(parent_path, &display_name, create_in_subfolder)?;

    initialize_repository_structure(
        &target_path,
        initialize_with_readme,
        &display_name,
        &description,
        &gitignore_template,
        &license_template,
    )?;

    let remote_url = {
        let repo = Repository::open(&target_path).map_err(|error| {
            format!(
                "The repository path was not created successfully: {}",
                error
            )
        })?;
        let mut remote_url: Option<String> = None;

        if let Ok(remote) = repo.find_remote("origin") {
            if let Some(url) = remote.url() {
                remote_url = Some(url.to_string());
            }
        }

        remote_url
    };

    let mut repo_origin_type = "LOCAL_ONLY".to_string();
    let mut github_owner_login: Option<String> = None;

    if remote_url.is_some() {
        let (derived_origin_type, derived_owner_login) = resolve_repository_origin_metadata(
            state.inner().pool(),
            remote_url.as_deref(),
            None,
            false,
        )
        .await;
        repo_origin_type = derived_origin_type;
        github_owner_login = derived_owner_login;
    }

    let id = Uuid::new_v4().to_string();

    db::insert_tracked_path(
        state.inner().pool(),
        &id,
        &display_name,
        &target_path.to_string_lossy(),
        remote_url.as_deref(),
        &repo_origin_type,
        github_owner_login.as_deref(),
    )
    .await
    .map_err(|error| format!("Database indexing loop failure: {}", error))?;

    println!(
        "Repository '{}' initialized and committed to SQLite catalog cache successfully.",
        display_name
    );
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RepositoryTrackResult {
    pub outcome: String,
    pub message: String,
    pub id: String,
    pub display_name: String,
    pub absolute_path: String,
    pub metadata_ready: bool,
}

#[tauri::command]
pub fn crawl_repositories_command(
    root_path: String,
    max_depth: u32,
) -> Result<Vec<DiscoveredRepo>, String> {
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

        if Repository::open(&current_path).is_ok() {
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

async fn track_repository_path(
    pool: &sqlx::SqlitePool,
    absolute_path: &str,
    _profile_id: Option<&str>,
) -> Result<RepositoryTrackResult, String> {
    let path = Path::new(absolute_path);

    let remote_url = {
        let repo = Repository::open(path).map_err(|e| {
            format!(
                "The selected folder is not a valid Git repository workspace context: {}",
                e
            )
        })?;
        let mut remote_url: Option<String> = None;

        if let Ok(remote) = repo.find_remote("origin") {
            if let Some(url) = remote.url() {
                remote_url = Some(url.to_string());
            }
        }

        remote_url
    };

    let display_name = path
        .file_name()
        .and_then(|os_str| os_str.to_str())
        .unwrap_or("Unknown Repository")
        .to_string();

    let existing_path_state = db::fetch_tracked_path_state_by_absolute_path(pool, absolute_path)
        .await
        .map_err(|err| format!("Database lookup failure: {}", err))?;

    let id = existing_path_state
        .as_ref()
        .map(|(existing_id, _)| existing_id.clone())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    db::insert_tracked_path(
        pool,
        &id,
        &display_name,
        absolute_path,
        remote_url.as_deref(),
        "LOCAL_ONLY",
        None,
    )
    .await
    .map_err(|err| format!("Database indexing loop failure: {}", err))?;

    if existing_path_state
        .as_ref()
        .is_some_and(|(_, is_active)| *is_active == 1)
    {
        return Ok(RepositoryTrackResult {
            outcome: "already_tracked".to_string(),
            message: format!(
                "Repository '{}' is already in your workspace catalog, so it was not added again.",
                display_name
            ),
            id,
            display_name,
            absolute_path: absolute_path.to_string(),
            metadata_ready: false,
        });
    }

    println!(
        "Repository '{}' committed to SQLite catalog cache successfully.",
        display_name
    );
    Ok(RepositoryTrackResult {
        outcome: "added".to_string(),
        message: format!("Added '{}' to your workspace catalog.", display_name),
        id,
        display_name,
        absolute_path: absolute_path.to_string(),
        metadata_ready: false,
    })
}

#[tauri::command]
pub async fn add_new_tracked_path(
    state: tauri::State<'_, DbState>,
    manager: tauri::State<'_, WatcherManager>,
    absolute_path: String,
) -> Result<RepositoryTrackResult, String> {
    let pool = state.inner().pool().clone();
    let result = track_repository_path(&pool, &absolute_path, None).await?;
    let metadata_pool = pool.clone();
    let metadata_id = result.id.clone();
    tauri::async_runtime::spawn(async move {
        let remote_url = sqlx::query_scalar::<_, Option<String>>(
            "SELECT remote_url FROM tracked_paths WHERE id = ? LIMIT 1",
        )
        .bind(&metadata_id)
        .fetch_optional(&metadata_pool)
        .await
        .ok()
        .flatten()
        .flatten();

        if let Some(remote_url) = remote_url {
            let (origin_type, owner_login) =
                resolve_repository_origin_metadata(&metadata_pool, Some(&remote_url), None, true)
                    .await;
            let _ = db::update_tracked_path_origin_metadata(
                &metadata_pool,
                &metadata_id,
                &origin_type,
                owner_login.as_deref(),
            )
            .await;
        }
    });
    let path_id = db::fetch_tracked_path_id_by_absolute_path(&pool, &absolute_path)
        .await
        .map_err(|error| format!("Failed to resolve tracked repository id: {error}"))?
        .ok_or_else(|| "The tracked repository id could not be resolved.".to_string())?;

    manager
        .ensure_monitored(path_id, absolute_path, RefreshPriority::Foreground)
        .await?;

    Ok(result)
}

#[tauri::command]
pub async fn relink_repository_path(
    state: tauri::State<'_, DbState>,
    manager: tauri::State<'_, WatcherManager>,
    path_id: String,
    absolute_path: String,
) -> Result<RepositoryTrackResult, String> {
    let pool = state.inner().pool();
    let path = std::path::Path::new(&absolute_path);

    let repo = Repository::open(path).map_err(|e| {
        format!(
            "The selected folder is not a valid Git repository workspace context: {}",
            e
        )
    })?;

    let remote_url = {
        let mut remote_url: Option<String> = None;
        if let Ok(remote) = repo.find_remote("origin") {
            if let Some(url) = remote.url() {
                remote_url = Some(url.to_string());
            }
        }
        remote_url
    };

    let display_name = path
        .file_name()
        .and_then(|os_str| os_str.to_str())
        .unwrap_or("Unknown Repository")
        .to_string();

    let mut repo_origin_type = "LOCAL_ONLY".to_string();
    let mut github_owner_login: Option<String> = None;

    if remote_url.is_some() {
        let (derived_origin_type, derived_owner_login) =
            resolve_repository_origin_metadata(pool, remote_url.as_deref(), None, true).await;
        repo_origin_type = derived_origin_type;
        github_owner_login = derived_owner_login;
    }

    let conflicting_path_id = db::fetch_tracked_path_id_by_absolute_path(pool, &absolute_path)
        .await
        .map_err(|err| format!("Database lookup failure: {}", err))?;

    if conflicting_path_id.is_some() && conflicting_path_id.as_deref() != Some(path_id.as_str()) {
        db::deactivate_duplicate_tracked_path(pool, &absolute_path, &path_id)
            .await
            .map_err(|err| format!("Database update failure: {}", err))?;
    }

    db::relink_tracked_path(
        pool,
        &path_id,
        &display_name,
        &absolute_path,
        remote_url.as_deref(),
        &repo_origin_type,
        github_owner_login.as_deref(),
    )
    .await
    .map_err(|err| format!("Database indexing loop failure: {}", err))?;

    manager.stop_monitored(&path_id).await?;
    manager
        .ensure_monitored(
            path_id.clone(),
            absolute_path.clone(),
            RefreshPriority::Foreground,
        )
        .await?;

    Ok(RepositoryTrackResult {
        outcome: "updated".to_string(),
        message: format!(
            "Reattached '{}' to its new workspace location.",
            display_name
        ),
        id: path_id,
        display_name,
        absolute_path,
        metadata_ready: true,
    })
}

#[tauri::command]
pub async fn untrack_repository(
    state: tauri::State<'_, DbState>,
    manager: tauri::State<'_, WatcherManager>,
    path_id: String,
) -> Result<(), String> {
    crate::db::untrack_repository_path(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to archive target repository row: {}", err))?;

    if let Err(error) = manager.stop_monitored(&path_id).await {
        return Err(format!(
            "Repository archived, but its watcher could not be stopped: {}",
            error
        ));
    }

    println!("Successfully archived repository reference: {}", path_id);
    Ok(())
}

#[tauri::command]
pub async fn restore_repository(
    state: tauri::State<'_, DbState>,
    manager: tauri::State<'_, WatcherManager>,
    path_id: String,
) -> Result<(), String> {
    let absolute_path = crate::db::restore_tracked_path(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to restore repository row: {}", err))?;

    if let Err(error) = manager
        .ensure_monitored(path_id.clone(), absolute_path, RefreshPriority::Foreground)
        .await
    {
        return Err(format!(
            "Repository restored, but its watcher could not be started: {}",
            error
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn purge_repository(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<(), String> {
    crate::db::purge_tracked_path(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to permanently purge archived repository: {}", err))
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
            tracked_paths.github_owner_login,
            tracked_paths.is_favorite,
            tracked_paths.is_pinned,
            tracked_paths.group_id,
            custom_groups.group_name AS custom_group,
            tracked_paths.last_accessed_at,
            tracked_paths.default_branch_name,
            tracked_paths.theme_color_hex,
            tracked_paths.icon_name,
            cached_git_branches.ahead_count AS cached_ahead_count,
            cached_git_branches.behind_count AS cached_behind_count,
            cached_git_branches.has_upstream AS cached_has_upstream,
            cached_git_branches.unpushed_commit_count AS cached_unpushed_commit_count,
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
                 WHERE tracked_paths.is_active = 1
                     AND tracked_paths.archived_at IS NULL",
    )
    .fetch_all(state.inner().pool())
    .await
    .map_err(|e| format!("Failed to fetch tracked paths from DB: {}", e))?;

    let mut workspaces = Vec::new();

    for row in rows {
        let id: String = row.get("id");
        let display_name: String = row.get("display_name");
        let alias_name: Option<String> = row.get("alias_name");
        let absolute_path: String = row.get("absolute_path");
        let repo_origin_type: String = row.get("repo_origin_type");
        let github_owner_login: Option<String> = row.get("github_owner_login");
        let is_favorite: i64 = row.get("is_favorite");
        let is_pinned: i64 = row.get("is_pinned");
        let group_id: Option<String> = row.get("group_id");
        let custom_group: Option<String> = row.get("custom_group");
        let last_accessed_at: Option<String> = row.get("last_accessed_at");
        let tags_json: String = row.get("tags_json");
        let default_branch_name: Option<String> = row.get("default_branch_name");
        let theme_color_hex: Option<String> = row.get("theme_color_hex");
        let icon_name: Option<String> = row.get("icon_name");
        let ahead_count: Option<i64> = row.get("cached_ahead_count");
        let behind_count: Option<i64> = row.get("cached_behind_count");
        let has_upstream_raw: Option<i64> = row.get("cached_has_upstream");
        let unpushed_commit_count: Option<i64> = row.get("cached_unpushed_commit_count");
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
            github_owner_login,
            current_branch,
            available_branches,
            uncommitted_changes_count,
            is_favorite,
            is_pinned,
            group_id,
            custom_group,
            last_accessed_at,
            tags_json,
            default_branch_name,
            theme_color_hex,
            icon_name,
            ahead_count: ahead_count.unwrap_or(0),
            behind_count: behind_count.unwrap_or(0),
            has_upstream: has_upstream_raw.unwrap_or(0) != 0,
            unpushed_commit_count,
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

    db::update_repository_alias(state.inner().pool(), &path_id, target_alias.as_deref())
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
    db::update_repository_favorite(state.inner().pool(), &path_id, is_favorite)
        .await
        .map_err(|err| format!("Failed to persist favorite state: {}", err))?;

    Ok(())
}

#[tauri::command]
pub async fn set_repository_pinned(
    state: tauri::State<'_, DbState>,
    watcher_manager: tauri::State<'_, WatcherManager>,
    path_id: String,
    is_pinned: bool,
) -> Result<(), String> {
    db::update_repository_pinned(state.inner().pool(), &path_id, is_pinned)
        .await
        .map_err(|err| format!("Failed to persist pinned state: {}", err))?;

    watcher_manager
        .set_pinned_repository(&path_id, is_pinned)
        .await?;

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

    crate::db::update_repository_origin_type(state.inner().pool(), &path_id, &origin_type)
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

    db::update_repository_group(state.inner().pool(), &path_id, cleaned.as_deref())
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

    let tag_conflict = db::tag_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err(
            "A tag with this name already exists. Tags and groups must have unique names."
                .to_string(),
        );
    }

    let group_conflict = db::group_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists.".to_string());
    }

    db::create_custom_group(state.inner().pool(), &trimmed_name, color_hex.as_deref())
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

    let tag_conflict = db::tag_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err(
            "A tag with this name already exists. Tags and groups must have unique names."
                .to_string(),
        );
    }

    let group_conflict = db::group_name_exists(state.inner().pool(), &trimmed_name, Some(&id))
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err("A group with this name already exists.".to_string());
    }

    db::update_custom_group(state.inner().pool(), &id, &trimmed_name, &color_hex)
        .await
        .map_err(|err| format!("Failed to update custom group: {}", err))
}

#[tauri::command]
pub async fn delete_custom_group(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    db::delete_custom_group(state.inner().pool(), &id)
        .await
        .map_err(|err| format!("Failed to delete custom group: {}", err))
}

#[tauri::command]
pub async fn get_custom_groups_with_usage(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::GroupSummaryRow>, String> {
    db::fetch_custom_groups_with_usage(state.inner().pool())
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

    let tag_conflict = db::tag_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists.".to_string());
    }

    let group_conflict = db::group_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err(
            "A group with this name already exists. Tags and groups must have unique names."
                .to_string(),
        );
    }

    db::create_global_tag(state.inner().pool(), &trimmed_name, color_hex.as_deref())
        .await
        .map_err(|err| format!("Failed to create global tag: {}", err))
}

#[tauri::command]
pub async fn get_global_tags_with_usage(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<db::TagFilterSummaryRow>, String> {
    db::fetch_global_tags_with_usage(state.inner().pool())
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

    let tag_conflict = db::tag_name_exists(state.inner().pool(), &trimmed_name, Some(&id))
        .await
        .map_err(|err| format!("Failed to validate tag name: {}", err))?;
    if tag_conflict {
        return Err("A tag with this name already exists.".to_string());
    }

    let group_conflict = db::group_name_exists(state.inner().pool(), &trimmed_name, None)
        .await
        .map_err(|err| format!("Failed to validate group name: {}", err))?;
    if group_conflict {
        return Err(
            "A group with this name already exists. Tags and groups must have unique names."
                .to_string(),
        );
    }

    db::update_global_tag(state.inner().pool(), &id, &trimmed_name, &color_hex)
        .await
        .map_err(|err| format!("Failed to update global tag: {}", err))
}

#[tauri::command]
pub async fn delete_global_tag(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    db::delete_global_tag(state.inner().pool(), &id)
        .await
        .map_err(|err| format!("Failed to delete global tag: {}", err))
}

#[tauri::command]
pub async fn cleanup_dangling_global_tags(state: tauri::State<'_, DbState>) -> Result<i64, String> {
    db::cleanup_dangling_global_tags(state.inner().pool())
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
    db::attach_repository_tag(
        state.inner().pool(),
        &path_id,
        &tag_name,
        color_hex.as_deref(),
    )
    .await
    .map_err(|err| format!("Failed to attach repository tag: {}", err))?;

    db::fetch_repository_tags(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to reload repository tag list: {}", err))
}

#[tauri::command]
pub async fn remove_repository_tag(
    state: tauri::State<'_, DbState>,
    path_id: String,
    tag_name: String,
) -> Result<Vec<db::RepoTagRow>, String> {
    db::detach_repository_tag(state.inner().pool(), &path_id, &tag_name)
        .await
        .map_err(|err| format!("Failed to detach repository tag: {}", err))?;

    db::fetch_repository_tags(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to reload repository tag list: {}", err))
}

#[tauri::command]
pub async fn get_repository_tags(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<Vec<db::RepoTagRow>, String> {
    db::fetch_repository_tags(state.inner().pool(), &path_id)
        .await
        .map_err(|err| format!("Failed to fetch repository tag list: {}", err))
}

#[tauri::command]
pub async fn touch_repository_last_accessed(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<(), String> {
    db::touch_repository_last_accessed(state.inner().pool(), &path_id)
        .await
        .map_err(|err| {
            format!(
                "Failed to update repository last accessed timestamp: {}",
                err
            )
        })?;

    Ok(())
}

#[tauri::command]
pub async fn get_quick_filter_metadata(
    state: tauri::State<'_, DbState>,
) -> Result<db::QuickFilterMetadata, String> {
    db::fetch_quick_filter_metadata(state.inner().pool())
        .await
        .map_err(|err| format!("Failed to fetch quick filter metadata: {}", err))
}

/// Returns a direct parent-to-child topology relation when one branch is an
/// ancestor of the other. Diverged sibling branches intentionally do not
/// produce an automatic connection.
#[tauri::command]
pub fn determine_branch_topology(
    absolute_path: &str,
    branch_a: &str,
    branch_b: &str,
) -> Result<GitTopologyRelation, String> {
    let normalized_branch_a = branch_a.trim();
    let normalized_branch_b = branch_b.trim();

    if normalized_branch_a.is_empty() || normalized_branch_b.is_empty() {
        return Err("Topology lookup requires a non-empty branch pair".to_string());
    }

    if normalized_branch_a == normalized_branch_b {
        return Err("Topology lookup requires two distinct branches".to_string());
    }

    let repo = Repository::open(absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let ref_a = repo
        .revparse_single(&format!("refs/heads/{}", normalized_branch_a))
        .map_err(|e| format!("Branch '{}' not found: {}", normalized_branch_a, e))?;
    let ref_b = repo
        .revparse_single(&format!("refs/heads/{}", normalized_branch_b))
        .map_err(|e| format!("Branch '{}' not found: {}", normalized_branch_b, e))?;

    let oid_a = ref_a.id();
    let oid_b = ref_b.id();

    let (parent_branch, child_branch, parent_oid, child_oid) = if repo
        .graph_descendant_of(oid_a, oid_b)
        .map_err(|e| e.to_string())?
    {
        (normalized_branch_b, normalized_branch_a, oid_b, oid_a)
    } else if repo
        .graph_descendant_of(oid_b, oid_a)
        .map_err(|e| e.to_string())?
    {
        (normalized_branch_a, normalized_branch_b, oid_a, oid_b)
    } else {
        return Err("Branches are not in a direct ancestor relationship".to_string());
    };

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(child_oid).map_err(|e| e.to_string())?;
    revwalk.hide(parent_oid).map_err(|e| e.to_string())?;
    let distance = revwalk.count();

    Ok(GitTopologyRelation {
        source_branch: parent_branch.to_string(),
        target_branch: child_branch.to_string(),
        common_ancestor: parent_oid.to_string(),
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
pub(crate) fn analyze_repository_git_status(
    absolute_path: &str,
) -> Result<RepoGitStatusSnapshot, String> {
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
    let unpushed_commit_count = head_branch
        .as_ref()
        .and_then(|branch| compute_unpushed_commit_count(&repo, branch));

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
        unpushed_commit_count,
        ahead_of_default_count,
        behind_default_count,
    })
}

/// Re-runs git status analysis for a tracked path and persists the results
/// (default branch name + HEAD branch sync counts) into the SQLite cache so the
/// dashboard reads fresh values on its next hydrate. Shared by the manual refresh
/// command and the fetch/pull/push operations below.
fn build_change_status_label(status: git2::Status) -> String {
    if status.contains(git2::Status::CONFLICTED) {
        "conflicted".to_string()
    } else if status.contains(git2::Status::WT_RENAMED)
        || status.contains(git2::Status::INDEX_RENAMED)
    {
        "renamed".to_string()
    } else if status.contains(git2::Status::WT_NEW) || status.contains(git2::Status::INDEX_NEW) {
        "added".to_string()
    } else if status.contains(git2::Status::WT_DELETED)
        || status.contains(git2::Status::INDEX_DELETED)
    {
        "deleted".to_string()
    } else if status.contains(git2::Status::WT_MODIFIED)
        || status.contains(git2::Status::INDEX_MODIFIED)
    {
        "modified".to_string()
    } else {
        "modified".to_string()
    }
}

fn describe_change_entry(
    repo: &Repository,
    entry: &git2::StatusEntry<'_>,
) -> Result<RepositoryChangeItem, String> {
    let path = entry.path().unwrap_or_default().to_string();
    let status = entry.status();
    let staged = status.contains(git2::Status::INDEX_NEW)
        || status.contains(git2::Status::INDEX_MODIFIED)
        || status.contains(git2::Status::INDEX_DELETED)
        || status.contains(git2::Status::INDEX_RENAMED);
    let is_conflicted = status.contains(git2::Status::CONFLICTED);
    let is_binary = false;
    let diff_available = repo.path().exists() && !path.is_empty();
    let diff_summary = if diff_available {
        Some(format!("{} ({})", path, build_change_status_label(status)))
    } else {
        None
    };

    Ok(RepositoryChangeItem {
        path: path.clone(),
        old_path: None,
        status: build_change_status_label(status),
        staged,
        is_conflicted,
        is_binary,
        diff_available,
        diff_summary,
        can_stage: true,
        can_unstage: staged,
    })
}

const MAX_FILE_DIFF_BYTES: usize = 512 * 1024;

fn repository_relative_path(repo: &Repository, relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("The selected path must be a repository-relative file path.".to_string());
    }

    let workdir = repo
        .workdir()
        .ok_or_else(|| "Bare repositories do not have a working tree to preview.".to_string())?;
    Ok(workdir.join(path))
}

fn bounded_text_file_patch(
    repo: &Repository,
    relative_path: &str,
) -> Result<RepositoryFileDiff, String> {
    let file_path = repository_relative_path(repo, relative_path)?;
    let metadata = fs::metadata(&file_path)
        .map_err(|error| format!("Failed to inspect '{}': {error}", relative_path))?;

    if metadata.len() as usize > MAX_FILE_DIFF_BYTES {
        return Ok(RepositoryFileDiff {
            path: relative_path.to_string(),
            old_path: None,
            patch: None,
            is_binary: false,
            is_truncated: true,
            unavailable_reason: Some("This untracked file is too large to preview.".to_string()),
        });
    }

    let contents = fs::read(&file_path)
        .map_err(|error| format!("Failed to read '{}': {error}", relative_path))?;
    if contents.contains(&0) {
        return Ok(RepositoryFileDiff {
            path: relative_path.to_string(),
            old_path: None,
            patch: None,
            is_binary: true,
            is_truncated: false,
            unavailable_reason: Some("Binary files cannot be previewed as text diffs.".to_string()),
        });
    }

    let text = String::from_utf8(contents).map_err(|_| {
        format!(
            "'{}' is not valid UTF-8 text and cannot be previewed.",
            relative_path
        )
    })?;
    let mut patch = format!("--- /dev/null\n+++ b/{relative_path}\n");
    for line in text.lines() {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
    }

    Ok(RepositoryFileDiff {
        path: relative_path.to_string(),
        old_path: None,
        patch: Some(patch),
        is_binary: false,
        is_truncated: false,
        unavailable_reason: None,
    })
}

fn bounded_diff_patch(diff: &git2::Diff<'_>) -> Result<(String, bool), String> {
    let mut patch = Vec::new();
    let mut is_truncated = false;
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let prefix = matches!(origin, '+' | '-' | ' ').then_some(origin as u8);
        let required_bytes = line.content().len() + usize::from(prefix.is_some());
        if patch.len() + required_bytes > MAX_FILE_DIFF_BYTES {
            is_truncated = true;
            return true;
        }

        if let Some(prefix) = prefix {
            patch.push(prefix);
        }
        patch.extend_from_slice(line.content());
        true
    })
    .map_err(|error| format!("Failed to generate Git diff: {error}"))?;

    Ok((String::from_utf8_lossy(&patch).into_owned(), is_truncated))
}

#[tauri::command]
pub async fn get_repository_file_diff(
    absolute_path: String,
    path: String,
    staged: bool,
) -> Result<RepositoryFileDiff, String> {
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    repository_relative_path(&repo, &path)?;
    let status = repo
        .status_file(Path::new(&path))
        .map_err(|error| format!("Failed to inspect '{}': {error}", path))?;

    if status.contains(git2::Status::WT_NEW) && !staged {
        return bounded_text_file_patch(&repo, &path);
    }

    let mut options = git2::DiffOptions::new();
    options.pathspec(&path);
    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
        let index = repo
            .index()
            .map_err(|error| format!("Failed to inspect Git index: {error}"))?;
        repo.diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut options))
    } else {
        repo.diff_index_to_workdir(None, Some(&mut options))
    }
    .map_err(|error| format!("Failed to compare '{}': {error}", path))?;

    if diff.deltas().next().is_none() {
        return Ok(RepositoryFileDiff {
            path,
            old_path: None,
            patch: None,
            is_binary: false,
            is_truncated: false,
            unavailable_reason: Some(
                "No text diff is available for the selected file.".to_string(),
            ),
        });
    }

    let delta = diff.deltas().next().expect("checked that diff has a delta");
    let old_path = delta
        .old_file()
        .path()
        .map(|value| value.to_string_lossy().into_owned());
    let is_binary = delta.flags().contains(git2::DiffFlags::BINARY);
    if is_binary {
        return Ok(RepositoryFileDiff {
            path,
            old_path,
            patch: None,
            is_binary: true,
            is_truncated: false,
            unavailable_reason: Some("Binary files cannot be previewed as text diffs.".to_string()),
        });
    }

    let (patch, is_truncated) = bounded_diff_patch(&diff)?;
    Ok(RepositoryFileDiff {
        path,
        old_path,
        patch: Some(patch),
        is_binary: false,
        is_truncated,
        unavailable_reason: is_truncated
            .then(|| "The preview was truncated to keep the application responsive.".to_string()),
    })
}

fn resolve_commit_and_parent_trees<'repo>(
    repo: &'repo Repository,
    commit_hash: &str,
) -> Result<(git2::Tree<'repo>, Option<git2::Tree<'repo>>), String> {
    let oid = Oid::from_str(commit_hash)
        .map_err(|error| format!("Invalid commit hash '{commit_hash}': {error}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|error| format!("Failed to resolve commit '{commit_hash}': {error}"))?;

    let commit_tree = commit
        .tree()
        .map_err(|error| format!("Failed to read the tree of commit '{commit_hash}': {error}"))?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .and_then(|parent| parent.tree())
                .map_err(|error| {
                    format!("Failed to read the parent tree of commit '{commit_hash}': {error}")
                })?,
        )
    } else {
        None
    };

    Ok((commit_tree, parent_tree))
}

fn commit_delta_status(status: git2::Delta) -> &'static str {
    match status {
        git2::Delta::Added => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Renamed => "renamed",
        git2::Delta::Copied => "copied",
        _ => "modified",
    }
}

fn diff_commit_against_parent_tree<'repo>(
    repo: &'repo Repository,
    commit_tree: &'repo git2::Tree<'repo>,
    parent_tree: Option<&'repo git2::Tree<'repo>>,
    pathspec: Option<&str>,
) -> Result<git2::Diff<'repo>, String> {
    let mut options = git2::DiffOptions::new();
    if let Some(path) = pathspec {
        options.pathspec(path);
    }

    let mut diff = repo
        .diff_tree_to_tree(parent_tree, Some(commit_tree), Some(&mut options))
        .map_err(|error| format!("Failed to compare the commit against its parent: {error}"))?;

    let mut find_options = git2::DiffFindOptions::new();
    find_options.renames(true).copies(true);
    diff.find_similar(Some(&mut find_options))
        .map_err(|error| format!("Failed to detect renames in the commit: {error}"))?;

    Ok(diff)
}

/// Lists every file changed by a single commit, diffed against its first parent
/// (root commits diff against the empty tree). Rename/copy detection is enabled;
/// each entry carries the destination path, an optional source path for renames
/// and copies, a status label (`added` / `deleted` / `modified` / `renamed` /
/// `copied`), and a binary flag when known. Results are sorted by path ascending.
#[tauri::command]
pub async fn get_commit_changed_files(
    absolute_path: String,
    commit_hash: String,
) -> Result<Vec<CommitChangedFile>, String> {
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    let (commit_tree, parent_tree) = resolve_commit_and_parent_trees(&repo, &commit_hash)?;
    let diff = diff_commit_against_parent_tree(&repo, &commit_tree, parent_tree.as_ref(), None)?;

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let status = commit_delta_status(delta.status());
        let path = delta
            .new_file()
            .path()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default();
        let old_path = match status {
            "renamed" | "copied" => delta
                .old_file()
                .path()
                .map(|value| value.to_string_lossy().into_owned()),
            _ => None,
        };
        let is_binary = delta.flags().contains(git2::DiffFlags::BINARY);

        files.push(CommitChangedFile {
            path,
            old_path,
            status: status.to_string(),
            is_binary,
        });
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(files)
}

/// Produces the bounded text diff of one repository-relative path introduced by
/// a specific commit, using the same parent-resolution rules as
/// `get_commit_changed_files` (first parent, empty tree for root commits) and the
/// same guard rails as `get_repository_file_diff`: no-delta payloads, binary
/// detection with a text-patch fallback, and 512 KB truncation via
/// `MAX_FILE_DIFF_BYTES`.
#[tauri::command]
pub async fn get_commit_file_diff(
    absolute_path: String,
    commit_hash: String,
    path: String,
) -> Result<RepositoryFileDiff, String> {
    fn unavailable(path: String) -> RepositoryFileDiff {
        RepositoryFileDiff {
            path,
            old_path: None,
            patch: None,
            is_binary: false,
            is_truncated: false,
            unavailable_reason: Some(
                "No text diff is available for the selected file.".to_string(),
            ),
        }
    }

    fn binary_unavailable(path: String, old_path: Option<String>) -> RepositoryFileDiff {
        RepositoryFileDiff {
            path,
            old_path,
            patch: None,
            is_binary: true,
            is_truncated: false,
            unavailable_reason: Some("Binary files cannot be previewed as text diffs.".to_string()),
        }
    }

    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    repository_relative_path(&repo, &path)?;
    let relative_path = Path::new(&path);
    let (commit_tree, parent_tree) = resolve_commit_and_parent_trees(&repo, &commit_hash)?;
    let diff = diff_commit_against_parent_tree(&repo, &commit_tree, parent_tree.as_ref(), None)?;

    let delta_index = diff
        .deltas()
        .enumerate()
        .find(|(_, delta)| {
            delta.new_file().path() == Some(relative_path)
                || delta.old_file().path() == Some(relative_path)
        })
        .map(|(index, _)| index);
    let Some(delta_index) = delta_index else {
        return Ok(unavailable(path));
    };

    let mut file_patch = match git2::Patch::from_diff(&diff, delta_index) {
        Ok(Some(file_patch)) => file_patch,
        Ok(None) => return Ok(unavailable(path)),
        Err(error) => return Err(format!("Failed to generate Git diff: {error}")),
    };

    let delta = file_patch.delta();
    let old_path = delta
        .old_file()
        .path()
        .filter(|_| delta.status() != git2::Delta::Added)
        .map(|value| value.to_string_lossy().into_owned());
    if delta.flags().contains(git2::DiffFlags::BINARY) {
        return Ok(binary_unavailable(path, old_path));
    }

    let mut patch_bytes = Vec::new();
    let mut is_truncated = false;
    file_patch
        .print(&mut |_delta, _hunk, line| {
            let origin = line.origin();
            let prefix = matches!(origin, '+' | '-' | ' ').then_some(origin as u8);
            let required_bytes = line.content().len() + usize::from(prefix.is_some());
            if patch_bytes.len() + required_bytes > MAX_FILE_DIFF_BYTES {
                is_truncated = true;
                return true;
            }

            if let Some(prefix) = prefix {
                patch_bytes.push(prefix);
            }
            patch_bytes.extend_from_slice(line.content());
            true
        })
        .map_err(|error| format!("Failed to generate Git diff: {error}"))?;

    let patch = String::from_utf8_lossy(&patch_bytes).into_owned();
    if patch.contains("GIT binary patch") || patch.contains("Binary files ") {
        return Ok(binary_unavailable(path, old_path));
    }

    Ok(RepositoryFileDiff {
        path,
        old_path,
        patch: Some(patch),
        is_binary: false,
        is_truncated,
        unavailable_reason: is_truncated
            .then(|| "The preview was truncated to keep the application responsive.".to_string()),
    })
}

fn stage_path(repo: &Repository, relative_path: &str) -> Result<(), String> {
    let mut index = repo
        .index()
        .map_err(|error| format!("Failed to open Git index: {error}"))?;
    index
        .add_path(Path::new(relative_path))
        .map_err(|error| format!("Failed to stage '{}' in Git: {error}", relative_path))?;
    index
        .write()
        .map_err(|error| format!("Failed to write Git index: {error}"))?;
    Ok(())
}

fn unstage_path(repo: &Repository, relative_path: &str) -> Result<(), String> {
    let mut index = repo
        .index()
        .map_err(|error| format!("Failed to open Git index: {error}"))?;
    index
        .remove_path(Path::new(relative_path))
        .map_err(|error| format!("Failed to unstage '{}' in Git: {error}", relative_path))?;
    index
        .write()
        .map_err(|error| format!("Failed to write Git index: {error}"))?;
    Ok(())
}

pub fn collect_repository_changes(
    absolute_path: &str,
) -> Result<RepositoryChangesSnapshot, String> {
    let repo = Repository::open(absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;

    let mut options = git2::StatusOptions::new();
    options.include_untracked(true);
    options.recurse_untracked_dirs(true);
    options.include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|error| format!("Failed to inspect repository changes: {error}"))?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        if entry.status().contains(git2::Status::IGNORED) {
            continue;
        }
        entries.push(describe_change_entry(&repo, &entry)?);
    }

    entries.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(RepositoryChangesSnapshot {
        entries,
        is_in_progress_operation: false,
        operation_message: None,
    })
}

async fn collect_repository_changes_async(
    absolute_path: String,
) -> Result<RepositoryChangesSnapshot, String> {
    match tauri::async_runtime::spawn_blocking(move || collect_repository_changes(&absolute_path))
        .await
    {
        Ok(result) => result,
        Err(error) => Err(format!("Failed to join repository changes read: {error}")),
    }
}

#[tauri::command]
pub async fn get_repository_changes(
    absolute_path: String,
) -> Result<RepositoryChangesSnapshot, String> {
    collect_repository_changes_async(absolute_path).await
}

#[tauri::command]
pub async fn get_repository_changes_if_changed(
    manager: tauri::State<'_, WatcherManager>,
    path_id: String,
    absolute_path: String,
    known_revision: Option<u64>,
) -> Result<RepositoryChangesRead, String> {
    let (revision, unchanged, snapshot) = manager
        .wait_for_changes_snapshot(&path_id, &absolute_path, known_revision)
        .await?;

    Ok(RepositoryChangesRead {
        revision,
        unchanged,
        snapshot,
    })
}

fn latest_commit_info(repo: &Repository) -> Result<Option<LatestCommitInfo>, String> {
    let head = match repo.head() {
        Ok(head) => head,
        Err(error) if error.code() == git2::ErrorCode::UnbornBranch => return Ok(None),
        Err(error) => return Err(format!("Failed to inspect Git HEAD: {error}")),
    };
    let commit = match head.peel_to_commit() {
        Ok(commit) => commit,
        Err(error) if error.code() == git2::ErrorCode::UnbornBranch => return Ok(None),
        Err(error) => return Err(format!("HEAD does not point to a commit: {error}")),
    };
    let message = commit.message().unwrap_or_default().to_string();
    let subject = commit.summary().unwrap_or_default().to_string();
    let author_name = commit.author().name().unwrap_or("Unknown").to_string();
    let mut undo_reason = None;

    if head.name().is_none() {
        undo_reason = Some("Undo is unavailable while HEAD is detached.".to_string());
    } else if repo.state() != RepositoryState::Clean {
        undo_reason =
            Some("Undo is unavailable while another Git operation is in progress.".to_string());
    } else if commit.parent_count() == 0 {
        undo_reason = Some("The initial commit cannot be undone.".to_string());
    } else if commit.parent_count() > 1 {
        undo_reason = Some("Merge commits cannot be undone here.".to_string());
    } else {
        let index = repo
            .index()
            .map_err(|error| format!("Failed to inspect Git index: {error}"))?;
        if index.has_conflicts() {
            undo_reason =
                Some("Undo is unavailable while the Git index has conflicts.".to_string());
        } else {
            let statuses = repo
                .statuses(Some(
                    &mut git2::StatusOptions::new().include_untracked(true),
                ))
                .map_err(|error| format!("Failed to inspect repository changes: {error}"))?;
            let staged = statuses.iter().any(|entry| {
                entry.status().intersects(
                    git2::Status::INDEX_NEW
                        | git2::Status::INDEX_MODIFIED
                        | git2::Status::INDEX_DELETED
                        | git2::Status::INDEX_RENAMED
                        | git2::Status::INDEX_TYPECHANGE,
                )
            });
            if staged {
                undo_reason =
                    Some("Undo is unavailable while staged changes already exist.".to_string());
            }
        }
    }

    if undo_reason.is_none() {
        let branch = head
            .shorthand()
            .and_then(|name| repo.find_branch(name, BranchType::Local).ok());
        if let Some(branch) = branch {
            match branch.upstream() {
                Err(error) if error.code() == git2::ErrorCode::NotFound => {}
                Err(_) => {
                    undo_reason = Some(
                        "Undo is unavailable because the configured upstream cannot be resolved."
                            .to_string(),
                    );
                }
                Ok(upstream) => match upstream.get().target() {
                    Some(upstream_oid)
                        if upstream_oid == commit.id()
                            || repo
                                .graph_descendant_of(upstream_oid, commit.id())
                                .unwrap_or(false) =>
                    {
                        undo_reason = Some(
                            "Undo is unavailable because this commit is already pushed."
                                .to_string(),
                        );
                    }
                    Some(_) => {}
                    None => {
                        undo_reason = Some("Undo is unavailable because the configured upstream cannot be resolved.".to_string());
                    }
                },
            }
        }
    }

    Ok(Some(LatestCommitInfo {
        hash: commit.id().to_string(),
        author_name,
        message,
        subject,
        committed_at: commit.time().seconds(),
        can_undo: undo_reason.is_none(),
        undo_reason,
    }))
}

#[tauri::command]
pub async fn get_latest_commit(absolute_path: String) -> Result<Option<LatestCommitInfo>, String> {
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    latest_commit_info(&repo)
}

#[tauri::command]
pub async fn stage_repository_paths(
    manager: tauri::State<'_, WatcherManager>,
    absolute_path: String,
    paths: Vec<String>,
) -> Result<RepositoryChangesSnapshot, String> {
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;

    let normalized_paths = paths
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();
    if normalized_paths.is_empty() {
        return Err("No paths were provided to stage.".to_string());
    }

    for relative_path in normalized_paths {
        stage_path(&repo, &relative_path)?;
    }

    let snapshot = collect_repository_changes_async(absolute_path.clone()).await?;
    manager
        .publish_changes_snapshot_for_path(&absolute_path, snapshot.clone(), "stage")
        .await;
    Ok(snapshot)
}

#[tauri::command]
pub async fn unstage_repository_paths(
    manager: tauri::State<'_, WatcherManager>,
    absolute_path: String,
    paths: Vec<String>,
) -> Result<RepositoryChangesSnapshot, String> {
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;

    let normalized_paths = paths
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();
    if normalized_paths.is_empty() {
        return Err("No paths were provided to unstage.".to_string());
    }

    for relative_path in normalized_paths {
        unstage_path(&repo, &relative_path)?;
    }

    let snapshot = collect_repository_changes_async(absolute_path.clone()).await?;
    manager
        .publish_changes_snapshot_for_path(&absolute_path, snapshot.clone(), "unstage")
        .await;
    Ok(snapshot)
}

#[tauri::command]
pub async fn create_commit(
    manager: tauri::State<'_, WatcherManager>,
    absolute_path: String,
    title: String,
    body: Option<String>,
) -> Result<RepositoryChangesSnapshot, String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("Commit title cannot be empty.".to_string());
    }

    {
        let repo = Repository::open(&absolute_path)
            .map_err(|error| format!("Failed to open Git repository: {error}"))?;
        let mut index = repo
            .index()
            .map_err(|error| format!("Failed to inspect Git index: {error}"))?;
        let tree_oid = index
            .write_tree()
            .map_err(|error| format!("Failed to build commit tree: {error}"))?;
        let tree = repo
            .find_tree(tree_oid)
            .map_err(|error| format!("Failed to resolve commit tree: {error}"))?;
        let signature = repo.signature().map_err(|_| "Git identity is not configured. Set user.name and user.email before creating commits.".to_string())?;

        let parent_refs = match repo.head() {
            Ok(head) => match head.peel_to_commit() {
                Ok(commit) => vec![commit],
                Err(_) => Vec::new(),
            },
            Err(_) => Vec::new(),
        };
        let message = match body
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some(body_text) => format!("{trimmed_title}\n\n{body_text}"),
            None => trimmed_title.to_string(),
        };

        let parent_slice: Vec<&git2::Commit<'_>> = parent_refs.iter().collect();
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            parent_slice.as_slice(),
        )
        .map_err(|error| format!("Failed to create commit: {error}"))?;
    }

    let snapshot = collect_repository_changes_async(absolute_path.clone()).await?;
    manager
        .publish_changes_snapshot_for_path(&absolute_path, snapshot.clone(), "commit")
        .await;
    Ok(snapshot)
}

#[tauri::command]
pub async fn undo_latest_commit(
    manager: tauri::State<'_, WatcherManager>,
    state: tauri::State<'_, DbState>,
    path_id: String,
    absolute_path: String,
    expected_hash: String,
) -> Result<RepositoryChangesSnapshot, String> {
    let _mutation_guard = GIT_MUTATION_LOCK
        .lock()
        .map_err(|_| "Git mutation lock is unavailable.".to_string())?;
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    let latest =
        latest_commit_info(&repo)?.ok_or_else(|| "There is no commit to undo.".to_string())?;
    if latest.hash != expected_hash {
        return Err(
            "The repository changed before Undo could run. Refresh and try again.".to_string(),
        );
    }
    if !latest.can_undo {
        return Err(latest
            .undo_reason
            .unwrap_or_else(|| "This commit cannot be undone.".to_string()));
    }

    {
        let head = repo
            .head()
            .map_err(|error| format!("Failed to inspect Git HEAD: {error}"))?;
        let commit = head
            .peel_to_commit()
            .map_err(|error| format!("HEAD does not point to a commit: {error}"))?;
        let parent = commit
            .parent(0)
            .map_err(|error| format!("Failed to resolve the commit parent: {error}"))?;
        repo.reset(parent.as_object(), ResetType::Soft, None)
            .map_err(|error| format!("Failed to undo the latest commit: {error}"))?;
    }
    drop(repo);
    drop(_mutation_guard);

    let snapshot = collect_repository_changes_async(absolute_path.clone()).await?;
    manager
        .publish_changes_snapshot_for_path(&absolute_path, snapshot.clone(), "undo_commit")
        .await;
    refresh_and_cache_git_status(state.inner().pool(), &path_id, &absolute_path).await?;
    manager
        .request_refresh(path_id, RefreshPriority::Foreground)
        .await?;
    Ok(snapshot)
}

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
        snapshot.unpushed_commit_count,
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
    refresh_and_cache_git_status(state.inner().pool(), &path_id, &absolute_path).await
}

// ==========================================
// Real network operations: fetch / pull / push
// ==========================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RemoteKind {
    Https,
    Ssh,
}

impl RemoteKind {
    fn is_ssh(self) -> bool {
        matches!(self, Self::Ssh)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RemoteClassification {
    kind: RemoteKind,
    host: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GitFailureCategory {
    Authentication,
    Permission,
    Transport,
    RemoteRejected,
    RemoteConfiguration,
}

impl std::fmt::Display for GitFailureCategory {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Authentication => "authentication",
            Self::Permission => "permission",
            Self::Transport => "transport",
            Self::RemoteRejected => "remote_rejected",
            Self::RemoteConfiguration => "remote_configuration",
        })
    }
}

fn classify_remote_url(remote_url: &str) -> Result<RemoteClassification, String> {
    let value = remote_url.trim();
    if let Ok(parsed) = url::Url::parse(value) {
        let kind = match parsed.scheme().to_ascii_lowercase().as_str() {
            "https" => RemoteKind::Https,
            "ssh" => RemoteKind::Ssh,
            scheme => {
                return Err(format!(
                    "Unsupported remote URL scheme '{scheme}'. Use an HTTPS or SSH remote."
                ))
            }
        };
        let host = parsed
            .host_str()
            .filter(|host| !host.is_empty())
            .ok_or_else(|| "The configured remote URL has no host.".to_string())?;
        return Ok(RemoteClassification {
            kind,
            host: host.to_string(),
        });
    }

    // Git's scp-like syntax is intentionally parsed without treating a
    // Windows drive letter (for example C:\repo) as a remote.
    if !value.contains("://") {
        if let Some((user_host, path)) = value.split_once(':') {
            if !path.is_empty() {
                if let Some((_, host)) = user_host.rsplit_once('@') {
                    if !host.is_empty() {
                        return Ok(RemoteClassification {
                            kind: RemoteKind::Ssh,
                            host: host.to_string(),
                        });
                    }
                }
            }
        }
    }

    Err("The configured remote URL is invalid. Use an HTTPS or SSH remote.".to_string())
}

fn classify_git2_error(error: &git2::Error) -> GitFailureCategory {
    if error.code() == git2::ErrorCode::Auth {
        return GitFailureCategory::Authentication;
    }
    let message = error.message().to_ascii_lowercase();
    if message.contains("permission denied")
        || message.contains("not permitted")
        || message.contains("prohibited")
    {
        return GitFailureCategory::Permission;
    }
    if message.contains("authentication")
        || message.contains("credential")
        || message.contains("username")
    {
        return GitFailureCategory::Authentication;
    }
    if message.contains("rejected")
        || message.contains("non-fast-forward")
        || message.contains("protected branch")
    {
        return GitFailureCategory::RemoteRejected;
    }
    if message.contains("resolve host")
        || message.contains("failed to connect")
        || message.contains("network")
        || message.contains("timed out")
    {
        return GitFailureCategory::Transport;
    }
    GitFailureCategory::RemoteConfiguration
}

fn remote_auth_error(message: &str) -> String {
    format!("Git authentication [authentication]. {message}")
}

fn redact_git_message(message: &str) -> String {
    let mut redacted = message.to_string();
    for scheme in ["https://", "http://", "ssh://"] {
        while let Some(start) = redacted.find(scheme) {
            let Some(at_offset) = redacted[start..].find('@') else {
                break;
            };
            let at = start + at_offset;
            if redacted[start..at].contains(':') {
                redacted.replace_range(start..at, scheme);
            } else {
                break;
            }
        }
    }
    redacted
}

fn with_built_remote_callbacks<F, T>(
    repo: Option<&Repository>,
    profile: Option<&auth::RemoteAuthProfile>,
    remote_url: &str,
    action: F,
) -> Result<T, String>
where
    F: FnOnce(RemoteCallbacks<'_>) -> Result<T, git2::Error>,
{
    let classification = classify_remote_url(remote_url)?;
    let Some(profile) = profile else {
        return Err(remote_auth_error(
            "Select a Local system or Full OAuth profile before contacting a remote.",
        ));
    };

    match profile.auth_level.as_str() {
        "basic" => Err(remote_auth_error(
            "Basic profiles are local-only and cannot perform remote Git operations.",
        )),
        "full_oauth" if classification.kind == RemoteKind::Ssh => Err(remote_auth_error(
            "Full OAuth supports HTTPS remotes only. Configure SSH through your system Git/SSH setup or switch the remote URL to HTTPS; an OAuth token is not used for SSH.",
        )),
        "full_oauth" => {
            let token = profile
                .token_value
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    remote_auth_error(
                        "The Full OAuth profile has no readable keyring token. Reconnect the profile and try again.",
                    )
                })?
                .to_string();
            let mut callbacks = RemoteCallbacks::new();
            callbacks.credentials(move |_url, _username, allowed_types| {
                if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
                    return Cred::userpass_plaintext("x-access-token", &token);
                }
                if allowed_types.contains(CredentialType::USERNAME) {
                    return Cred::username("x-access-token");
                }
                Cred::default()
            });
            action(callbacks)
                .map_err(|error| describe_git2_network_error("Git network operation failed", error))
        }
        "local_system" => {
            let config = match repo {
                Some(repo) => repo.config().map_err(|_| {
                    "Git authentication [authentication]. Unable to read the OS Git configuration."
                        .to_string()
                })?,
                None => git2::Config::open_default().map_err(|_| {
                    "Git authentication [authentication]. Unable to read the OS Git configuration."
                        .to_string()
                })?,
            };
            let authenticator = auth_git2::GitAuthenticator::new();
            let mut callbacks = RemoteCallbacks::new();
            callbacks.credentials(authenticator.credentials(&config));
            action(callbacks)
                .map_err(|error| describe_git2_network_error("Git network operation failed", error))
        }
        _ => Err(remote_auth_error(
            "The selected authentication profile is invalid. Choose Local system or Full OAuth.",
        )),
    }
}

/// Builds git2 `RemoteCallbacks` wired to `auth-git2`'s credential negotiation
/// (SSH agent, SSH key files, the OS git credential helper, and cached HTTPS
/// credentials), then hands them to `action` for the duration of a single network
/// call. Credentials/config can't outlive this function, so callers must perform
/// their git2 network call inside the closure rather than returning the callbacks.
fn with_auth_callbacks<F, T>(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
    action: F,
) -> Result<T, String>
where
    F: FnOnce(RemoteCallbacks) -> Result<T, git2::Error>,
{
    with_auth_callbacks_for_direction(repo, profile, Direction::Fetch, action)
}

fn with_auth_callbacks_for_direction<F, T>(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
    direction: Direction,
    action: F,
) -> Result<T, String>
where
    F: FnOnce(RemoteCallbacks) -> Result<T, git2::Error>,
{
    let remote = repo
        .find_remote("origin")
        .map_err(|e| format!("Failed to resolve 'origin' remote: {}", e))?;
    let remote_url = match direction {
        Direction::Push => remote
            .pushurl()
            .or_else(|| remote.url())
            .unwrap_or_default(),
        Direction::Fetch => remote.url().unwrap_or_default(),
    }
    .to_string();
    with_built_remote_callbacks(Some(repo), profile, &remote_url, action)
}

async fn resolve_profile_for_repo(
    state: &sqlx::SqlitePool,
    path_id: &str,
) -> Result<auth::ResolvedProfile, String> {
    auth::resolve_profile_for_repository(state, path_id).await
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitAuthenticationDiagnostics {
    pub repository_path_id: String,
    pub resolved_profile_id: String,
    pub resolved_profile_name: String,
    pub auth_level: String,
    pub resolution_source: String,
    pub token_present: bool,
    pub remote_scheme: Option<String>,
    pub remote_host: Option<String>,
    pub credential_strategy: String,
    pub git_error_code: Option<String>,
}

fn remote_location(url: &str) -> (Option<String>, Option<String>) {
    classify_remote_url(url)
        .map(|remote| {
            (
                Some(
                    match remote.kind {
                        RemoteKind::Https => "https",
                        RemoteKind::Ssh => "ssh",
                    }
                    .to_string(),
                ),
                Some(remote.host),
            )
        })
        .unwrap_or((None, None))
}

fn credential_strategy(profile: &auth::RemoteAuthProfile, remote_url: &str) -> String {
    let is_ssh = classify_remote_url(remote_url)
        .map(|remote| remote.kind.is_ssh())
        .unwrap_or(false);
    match (profile.auth_level.as_str(), is_ssh) {
        ("full_oauth", true) => "ssh_setup_required".to_string(),
        ("full_oauth", false) => "oauth_https_token".to_string(),
        ("local_system", _) => "os_git_credentials".to_string(),
        _ => "local_only_rejected".to_string(),
    }
}

/// Returns redacted profile/remote metadata for developer diagnosis only.
/// It intentionally never returns a URL, token, password, or authorization header.
#[tauri::command]
pub async fn diagnose_git_authentication(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<GitAuthenticationDiagnostics, String> {
    if !cfg!(debug_assertions) {
        return Err(
            "Git authentication diagnostics are available only in developer builds.".to_string(),
        );
    }

    let resolved_profile = resolve_profile_for_repo(state.inner().pool(), &path_id).await?;
    let absolute_path = db::get_absolute_path_for_id(state.inner().pool(), &path_id)
        .await
        .map_err(|error| format!("Failed to resolve repository path: {error}"))?;
    let repo = Repository::open(&absolute_path)
        .map_err(|error| format!("Failed to open Git repository: {error}"))?;
    let remote = repo
        .find_remote("origin")
        .map_err(|error| GitAuthenticationDiagnostics {
            repository_path_id: path_id.clone(),
            resolved_profile_id: resolved_profile.profile_id.clone(),
            resolved_profile_name: resolved_profile.profile_name.clone(),
            auth_level: resolved_profile.auth_level.clone(),
            resolution_source: resolved_profile.resolution_source.clone(),
            token_present: resolved_profile.profile.token_value.is_some(),
            remote_scheme: None,
            remote_host: None,
            credential_strategy: "no_origin".to_string(),
            git_error_code: Some(format!("{:?}", error.code())),
        });

    let (remote_scheme, remote_host, strategy, error_code) = match remote {
        Ok(remote) => {
            let remote_url = remote.url().unwrap_or_default();
            let (scheme, host) = remote_location(remote_url);
            (
                scheme,
                host,
                credential_strategy(&resolved_profile.profile, remote_url),
                None,
            )
        }
        Err(diagnostics) => return Ok(diagnostics),
    };

    Ok(GitAuthenticationDiagnostics {
        repository_path_id: path_id,
        resolved_profile_id: resolved_profile.profile_id,
        resolved_profile_name: resolved_profile.profile_name,
        auth_level: resolved_profile.auth_level,
        resolution_source: resolved_profile.resolution_source,
        token_present: resolved_profile.profile.token_value.is_some(),
        remote_scheme,
        remote_host,
        credential_strategy: strategy,
        git_error_code: error_code,
    })
}

/// Fetches all configured refspecs from the repository's `origin` remote.
fn fetch_from_origin(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
) -> Result<(), String> {
    repo.find_remote("origin")
        .map_err(|_| "This repository has no 'origin' remote configured.".to_string())?;

    with_auth_callbacks(repo, profile, |callbacks| {
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
fn push_branch_to_origin(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
    refspec: &str,
) -> Result<(), String> {
    let rejection: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let rejection_for_callback = rejection.clone();

    with_auth_callbacks_for_direction(repo, profile, Direction::Push, |mut callbacks| {
        callbacks.push_update_reference(move |refname, status| {
            if let Some(message) = status {
                let mut guard = rejection_for_callback.lock().unwrap();
                let category = if message.to_ascii_lowercase().contains("permission")
                    || message.to_ascii_lowercase().contains("denied")
                    || message.to_ascii_lowercase().contains("prohibited")
                {
                    GitFailureCategory::Permission
                } else {
                    GitFailureCategory::RemoteRejected
                };
                *guard = Some(format!(
                    "Remote update '{}' failed [{}]: {}",
                    refname,
                    category,
                    redact_git_message(message)
                ));
            }
            Ok(())
        });

        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);
        let mut remote = repo.find_remote("origin")?;
        remote.push(&[refspec], Some(&mut push_options))
    })?;

    if let Some(message) = rejection.lock().unwrap().take() {
        return Err(format!("Git remote update failed. {message}"));
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitPushResult {
    pub outcome: String,
    pub branch_name: String,
    pub message: String,
}

fn ensure_origin_remote(repo: &Repository) -> Result<(), String> {
    repo.find_remote("origin")
        .map(|_| ())
        .map_err(|_| "This repository has no 'origin' remote configured.".to_string())
}

fn remote_branch_exists(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
    branch_name: &str,
) -> Result<bool, String> {
    let remote_branch = format!("refs/heads/{branch_name}");
    with_auth_callbacks_for_direction(repo, profile, Direction::Fetch, |callbacks| {
        let mut remote = repo.find_remote("origin")?;
        remote.connect_auth(Direction::Fetch, Some(callbacks), None)?;
        let exists = remote
            .list()?
            .iter()
            .any(|reference| reference.name() == remote_branch);
        remote.disconnect()?;
        Ok(exists)
    })
}

fn push_current_branch(
    repo: &Repository,
    profile: Option<&auth::RemoteAuthProfile>,
    branch_name: &str,
    replace_existing: bool,
) -> Result<GitPushResult, String> {
    ensure_origin_remote(repo)?;

    let head_ref = repo
        .head()
        .map_err(|_| "The repository has no current branch checked out.".to_string())?;
    if !head_ref.is_branch() {
        return Err(
            "The repository is in a detached HEAD state; check out a branch before pushing."
                .to_string(),
        );
    }

    let local_branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(|_| format!("The current branch '{branch_name}' could not be found."))?;
    let _local_commit = local_branch.get().target().ok_or_else(|| {
        format!("The current branch '{branch_name}' has no local commit to push.")
    })?;

    if let Ok(upstream) = local_branch.upstream() {
        let upstream_name = upstream
            .name()
            .map_err(|_| format!("The upstream for '{branch_name}' could not be resolved."))?
            .ok_or_else(|| format!("The upstream for '{branch_name}' could not be resolved."))?;
        let upstream_remote_branch = upstream_name
            .split_once('/')
            .map(|(_, remote_branch)| remote_branch)
            .filter(|remote_branch| !remote_branch.is_empty())
            .ok_or_else(|| format!("The upstream for '{branch_name}' could not be resolved."))?;
        let refspec = format!(
            "refs/heads/{branch_name}:refs/heads/{upstream_remote_branch}"
        );
        push_branch_to_origin(repo, profile, &refspec)?;
        return Ok(GitPushResult {
            outcome: "pushed".to_string(),
            branch_name: branch_name.to_string(),
            message: format!("Pushed '{branch_name}' to its upstream."),
        });
    }

    if remote_branch_exists(repo, profile, branch_name)? && !replace_existing {
        return Err(format!(
            "Branch '{branch_name}' already exists on origin [publication_conflict]. Publishing over it requires explicit destructive confirmation."
        ));
    }

    let refspec = if replace_existing {
        format!("+refs/heads/{branch_name}:refs/heads/{branch_name}")
    } else {
        format!("refs/heads/{branch_name}:refs/heads/{branch_name}")
    };
    push_branch_to_origin(repo, profile, &refspec)?;

    let mut branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(|_| format!("The current branch '{branch_name}' could not be found."))?;
    branch
        .set_upstream(Some(&format!("origin/{branch_name}")))
        .map_err(|error| {
            format!("Published '{branch_name}', but could not set its upstream: {error}")
        })?;

    Ok(GitPushResult {
        outcome: "published".to_string(),
        branch_name: branch_name.to_string(),
        message: format!("Published '{branch_name}' to origin and set its upstream."),
    })
}

/// Contacts the repository's `origin` remote and updates local remote-tracking
/// refs (e.g. `origin/main`). Re-caches sync status immediately afterward so the
/// dashboard's ahead/behind pills don't wait for the background daemon's debounce.
#[tauri::command]
pub async fn git_fetch_operation(
    state: tauri::State<'_, DbState>,
    path_id: String,
) -> Result<String, String> {
    let absolute_path = db::get_absolute_path_for_id(state.inner().pool(), &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let resolved_profile = resolve_profile_for_repo(state.inner().pool(), &path_id).await?;
    let fetch_result = fetch_from_origin(&repo, Some(&resolved_profile.profile));

    let _ = refresh_and_cache_git_status(state.inner().pool(), &path_id, &absolute_path).await;

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
    let absolute_path = db::get_absolute_path_for_id(state.inner().pool(), &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let resolved_profile = resolve_profile_for_repo(state.inner().pool(), &path_id).await?;
    fetch_from_origin(&repo, Some(&resolved_profile.profile))?;

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

    let _ = refresh_and_cache_git_status(state.inner().pool(), &path_id, &absolute_path).await;

    pull_result
}

#[tauri::command]
pub async fn git_push_operation(
    state: tauri::State<'_, DbState>,
    path_id: String,
    replace_existing: Option<bool>,
) -> Result<GitPushResult, String> {
    let absolute_path = db::get_absolute_path_for_id(state.inner().pool(), &path_id)
        .await
        .map_err(|e| format!("Failed to resolve repository path: {}", e))?;

    let repo = Repository::open(&absolute_path)
        .map_err(|e| format!("Failed to open Git repository: {}", e))?;

    let resolved_profile = resolve_profile_for_repo(state.inner().pool(), &path_id).await?;
    let push_result = (|| -> Result<GitPushResult, String> {
        let head_ref = repo
            .head()
            .map_err(|_| "The repository has no current branch checked out.".to_string())?;
        let branch_name = head_ref
            .shorthand()
            .ok_or_else(|| "The repository has no current branch checked out.".to_string())?
            .to_string();
        push_current_branch(
            &repo,
            Some(&resolved_profile.profile),
            &branch_name,
            replace_existing.unwrap_or(false),
        )
    })();

    let _ = refresh_and_cache_git_status(state.inner().pool(), &path_id, &absolute_path).await;

    push_result
}

// Tests start
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;
    use std::fs::{self, File};
    use std::io::Write;

    fn test_profile(auth_level: &str, token_value: Option<&str>) -> auth::RemoteAuthProfile {
        auth::RemoteAuthProfile {
            id: "test-profile".to_string(),
            display_name: "Test profile".to_string(),
            auth_level: auth_level.to_string(),
            username: None,
            email: None,
            avatar_url: None,
            api_base_url: Some("https://api.github.com".to_string()),
            repository_scope: None,
            folder_scope: None,
            commit_name: None,
            commit_email: None,
            token_value: token_value.map(str::to_string),
            token_expires_at: None,
            last_token_check_at: None,
            is_active: 1,
            is_favorite: 0,
            created_at: None,
            updated_at: None,
        }
    }

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

    fn create_bare_remote_fixture(
        name: &str,
    ) -> (std::path::PathBuf, std::path::PathBuf, Repository) {
        let root = std::env::current_dir()
            .unwrap()
            .join("target")
            .join(format!("phase4-{name}-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).unwrap();
        }
        fs::create_dir_all(&root).unwrap();
        let local_path = root.join("local");
        let bare_path = root.join("remote.git");
        let repo = Repository::init(&local_path).unwrap();
        let bare = Repository::init_bare(&bare_path).unwrap();
        drop(bare);
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Phase 4 Test").unwrap();
        config.set_str("user.email", "phase4@example.com").unwrap();
        repo.remote("origin", bare_path.to_str().unwrap()).unwrap();
        create_initial_commit(&repo, &local_path);
        (root, bare_path, repo)
    }

    #[test]
    fn explains_missing_oauth_token_when_repository_list_fails() {
        assert_eq!(
            describe_remote_repository_listing_error("The selected profile does not have an OAuth token."),
            "We couldn't load repositories because the selected profile is not fully authorized. Reconnect the profile and try again."
        );
    }

    #[test]
    fn credential_strategy_covers_https_and_ssh_auth_matrix() {
        let oauth = test_profile("full_oauth", Some("token"));
        let local = test_profile("local_system", None);
        let basic = test_profile("basic", None);

        assert_eq!(
            credential_strategy(&oauth, "https://example.com/org/repo.git"),
            "oauth_https_token"
        );
        assert_eq!(
            credential_strategy(&oauth, "git@example.com:org/repo.git"),
            "ssh_setup_required"
        );
        assert_eq!(
            credential_strategy(&local, "https://example.com/org/repo.git"),
            "os_git_credentials"
        );
        assert_eq!(
            credential_strategy(&local, "ssh://git@example.com/org/repo.git"),
            "os_git_credentials"
        );
        assert_eq!(
            credential_strategy(&basic, "https://example.com/org/repo.git"),
            "local_only_rejected"
        );
    }

    #[test]
    fn full_oauth_rejects_missing_token_without_invoking_callbacks() {
        let error = with_built_remote_callbacks(
            None,
            Some(&test_profile("full_oauth", None)),
            "https://example.com/org/repo.git",
            |_callbacks| -> Result<(), git2::Error> {
                panic!("callbacks must not be built without a token")
            },
        )
        .unwrap_err();

        assert!(error.contains("no readable keyring token"));
        assert!(!error.contains("secret-token"));
    }

    #[test]
    fn remote_url_parser_rejects_windows_paths_and_unsupported_schemes() {
        assert!(classify_remote_url(r"C:\repos\local").is_err());
        assert!(classify_remote_url("file:///repos/local").is_err());
        assert!(classify_remote_url("https:///missing-host/repo.git").is_err());
        assert_eq!(
            classify_remote_url("HTTPS://example.com/org/repo.git").unwrap(),
            RemoteClassification {
                kind: RemoteKind::Https,
                host: "example.com".to_string(),
            }
        );
    }

    #[test]
    fn git_error_categories_cover_auth_permission_rejection_transport_and_configuration() {
        let cases = [
            (
                git2::Error::new(git2::ErrorCode::Auth, git2::ErrorClass::Net, "auth"),
                GitFailureCategory::Authentication,
            ),
            (
                git2::Error::from_str("permission denied by remote"),
                GitFailureCategory::Permission,
            ),
            (
                git2::Error::from_str("non-fast-forward rejected"),
                GitFailureCategory::RemoteRejected,
            ),
            (
                git2::Error::from_str("failed to connect to host"),
                GitFailureCategory::Transport,
            ),
            (
                git2::Error::from_str("unsupported remote"),
                GitFailureCategory::RemoteConfiguration,
            ),
        ];

        for (error, expected) in cases {
            assert_eq!(classify_git2_error(&error), expected);
        }
    }

    #[test]
    fn push_requires_origin_and_current_branch() {
        let root = std::env::current_dir()
            .unwrap()
            .join("target")
            .join(format!("phase5-missing-origin-{}", std::process::id()));
        if root.exists() {
            fs::remove_dir_all(&root).unwrap();
        }
        fs::create_dir_all(&root).unwrap();
        let repo = Repository::init(&root).unwrap();
        let error = push_current_branch(
            &repo,
            Some(&test_profile("local_system", None)),
            "main",
            false,
        )
        .unwrap_err();
        assert!(error.contains("no 'origin' remote"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn classifies_https_ssh_and_scp_remotes_without_exposing_credentials() {
        assert_eq!(
            classify_remote_url("https://x-access-token:secret@example.com/org/repo.git").unwrap(),
            RemoteClassification {
                kind: RemoteKind::Https,
                host: "example.com".to_string(),
            }
        );
        assert_eq!(
            classify_remote_url("ssh://git@example.com/org/repo.git").unwrap(),
            RemoteClassification {
                kind: RemoteKind::Ssh,
                host: "example.com".to_string(),
            }
        );
        assert_eq!(
            classify_remote_url("git@example.com:org/repo.git").unwrap(),
            RemoteClassification {
                kind: RemoteKind::Ssh,
                host: "example.com".to_string(),
            }
        );
    }

    #[test]
    fn oauth_ssh_preflight_never_constructs_token_or_agent_credentials() {
        let error = with_built_remote_callbacks(
            None,
            Some(&test_profile("full_oauth", Some("secret-token"))),
            "git@example.com:org/repo.git",
            |_callbacks| Ok::<_, git2::Error>(()),
        )
        .unwrap_err();

        assert!(error.contains("SSH"));
        assert!(error.contains("not used"));
        assert!(!error.contains("secret-token"));
    }

    #[test]
    fn basic_profiles_are_rejected_before_remote_callbacks() {
        let error = with_built_remote_callbacks(
            None,
            Some(&test_profile("basic", None)),
            "https://example.com/org/repo.git",
            |_callbacks| Ok::<_, git2::Error>(()),
        )
        .unwrap_err();

        assert!(error.contains("local-only"));
        assert!(error.contains("authentication"));
    }

    #[test]
    fn network_error_preserves_git_error_code_and_category() {
        let error = git2::Error::from_str("Could not resolve host");
        let described = describe_git2_network_error("Fetch transport failed", error);
        assert!(described.contains("transport"));
        assert!(described.contains("git_error_code=GenericError"));
        assert!(!described.contains("secret"));
    }

    #[test]
    fn rejection_messages_are_redacted() {
        assert_eq!(
            redact_git_message("remote https://user:secret@example.com/repo.git rejected"),
            "remote https://example.com/repo.git rejected"
        );
    }

    #[test]
    fn first_publication_pushes_branch_and_sets_upstream() {
        let (root, _bare_path, repo) = create_bare_remote_fixture("publication");
        let branch_name = repo.head().unwrap().shorthand().unwrap().to_string();
        let result = push_current_branch(
            &repo,
            Some(&test_profile("local_system", None)),
            &branch_name,
            false,
        )
        .unwrap();

        assert_eq!(result.outcome, "published");
        let expected_upstream = format!("origin/{branch_name}");
        assert_eq!(
            repo.find_branch(&branch_name, BranchType::Local)
                .unwrap()
                .upstream()
                .unwrap()
                .name()
                .unwrap(),
            Some(expected_upstream.as_str())
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn existing_upstream_push_preserves_normal_push_behavior() {
        let (root, _bare_path, repo) = create_bare_remote_fixture("upstream");
        let branch_name = repo.head().unwrap().shorthand().unwrap().to_string();
        push_branch_to_origin(
            &repo,
            Some(&test_profile("local_system", None)),
            &format!("refs/heads/{branch_name}:refs/heads/{branch_name}"),
        )
        .unwrap();
        let upstream_name = format!("origin/{branch_name}");
        repo.find_branch(&branch_name, BranchType::Local)
            .unwrap()
            .set_upstream(Some(&upstream_name))
            .unwrap();
        let local_path = root.join("local");
        create_initial_commit(&repo, &local_path);

        let result = push_current_branch(
            &repo,
            Some(&test_profile("local_system", None)),
            &branch_name,
            false,
        )
        .unwrap();

        assert_eq!(result.outcome, "pushed");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn diagnostics_expose_only_remote_scheme_and_host() {
        assert_eq!(
            remote_location("https://x-access-token:secret@example.com/org/repo.git"),
            (Some("https".to_string()), Some("example.com".to_string()))
        );
        assert_eq!(
            remote_location("git@example.com:org/repo.git"),
            (Some("ssh".to_string()), Some("example.com".to_string()))
        );
        let diagnostics = GitAuthenticationDiagnostics {
            repository_path_id: "repo".to_string(),
            resolved_profile_id: "profile".to_string(),
            resolved_profile_name: "Profile".to_string(),
            auth_level: "full_oauth".to_string(),
            resolution_source: "active_profile".to_string(),
            token_present: true,
            remote_scheme: Some("https".to_string()),
            remote_host: Some("example.com".to_string()),
            credential_strategy: "oauth_https_token".to_string(),
            git_error_code: None,
        };
        let serialized = serde_json::to_string(&diagnostics).unwrap();
        assert!(!serialized.contains("secret"));
        assert!(!serialized.contains("x-access-token"));
    }

    #[test]
    fn provider_api_remains_full_oauth_only() {
        assert!(ensure_remote_access(&test_profile("basic", Some("token"))).is_err());
        assert!(ensure_remote_access(&test_profile("local_system", None)).is_err());
        assert_eq!(
            ensure_remote_access(&test_profile("full_oauth", Some("token"))).unwrap(),
            "token"
        );
    }

    #[test]
    fn preserves_missing_repo_scope_when_repository_list_fails() {
        assert_eq!(
            describe_remote_repository_listing_error("The connected OAuth token is missing the 'repo' scope required to list private repositories."),
            "The connected OAuth token is missing the repo scope required to list private repositories. Reconnect the profile and grant repository access."
        );
    }

    #[test]
    fn test_track_repository_path_reports_existing_repo_without_insert_duplicate() {
        let (repo_path, _repo) = create_test_repo("test_track_duplicate_repo");
        let path_str = repo_path.to_str().unwrap();

        let pool = tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
            sqlx::query(
                r#"
                CREATE TABLE tracked_paths (
                    id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    absolute_path TEXT NOT NULL UNIQUE,
                    remote_url TEXT,
                    repo_origin_type TEXT NOT NULL,
                    uncommitted_changes_count INTEGER NOT NULL,
                    is_active INTEGER NOT NULL,
                    archived_at DATETIME DEFAULT NULL
                );
                "#,
            )
            .execute(&pool)
            .await
            .unwrap();
            pool
        });

        let first_result =
            tauri::async_runtime::block_on(track_repository_path(&pool, path_str, None)).unwrap();
        let second_result =
            tauri::async_runtime::block_on(track_repository_path(&pool, path_str, None)).unwrap();

        assert_eq!(first_result.outcome, "added");
        assert_eq!(second_result.outcome, "already_tracked");

        let count: i64 = tauri::async_runtime::block_on(async {
            sqlx::query_scalar("SELECT COUNT(*) FROM tracked_paths")
                .fetch_one(&pool)
                .await
                .unwrap()
        });

        assert_eq!(count, 1);

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_track_repository_path_reports_readded_inactive_repo_as_added() {
        let (repo_path, _repo) = create_test_repo("test_track_readd_inactive_repo");
        let path_str = repo_path.to_str().unwrap();

        let pool = tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
            sqlx::query(
                r#"
                CREATE TABLE tracked_paths (
                    id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    absolute_path TEXT NOT NULL UNIQUE,
                    remote_url TEXT,
                    repo_origin_type TEXT NOT NULL,
                    uncommitted_changes_count INTEGER NOT NULL,
                    is_active INTEGER NOT NULL,
                    archived_at DATETIME DEFAULT NULL
                );
                "#,
            )
            .execute(&pool)
            .await
            .unwrap();
            pool
        });

        let first_result =
            tauri::async_runtime::block_on(track_repository_path(&pool, path_str, None)).unwrap();
        tauri::async_runtime::block_on(async {
            sqlx::query("UPDATE tracked_paths SET is_active = 0 WHERE absolute_path = ?")
                .bind(path_str)
                .execute(&pool)
                .await
                .unwrap();
        });
        let second_result =
            tauri::async_runtime::block_on(track_repository_path(&pool, path_str, None)).unwrap();

        assert_eq!(first_result.outcome, "added");
        assert_eq!(second_result.outcome, "added");

        let active_count: i64 = tauri::async_runtime::block_on(async {
            sqlx::query_scalar("SELECT COUNT(*) FROM tracked_paths WHERE is_active = 1")
                .fetch_one(&pool)
                .await
                .unwrap()
        });

        assert_eq!(active_count, 1);

        fs::remove_dir_all(repo_path).unwrap();
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
    fn test_get_repository_changes_excludes_ignored_untracked_files() {
        let (repo_path, repo) = create_test_repo("test_changes_exclude_ignored_files");
        create_initial_commit(&repo, &repo_path);

        let gitignore_path = repo_path.join(".gitignore");
        fs::write(&gitignore_path, "ignored.log\n").unwrap();

        let tracked_path = repo_path.join("README.md");
        fs::write(&tracked_path, "# Test Repo\nupdated\n").unwrap();
        fs::write(repo_path.join("ignored.log"), "ignored\n").unwrap();
        fs::write(repo_path.join("visible.txt"), "visible\n").unwrap();

        let snapshot = tauri::async_runtime::block_on(get_repository_changes(
            repo_path.to_str().unwrap().to_string(),
        ))
        .unwrap();
        let paths = snapshot
            .entries
            .iter()
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>();

        assert!(paths.contains(&".gitignore"));
        assert!(paths.contains(&"README.md"));
        assert!(paths.contains(&"visible.txt"));
        assert!(!paths.contains(&"ignored.log"));

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_repository_file_diff_returns_changed_and_untracked_text() {
        let (repo_path, repo) = create_test_repo("test_repository_file_diff");
        create_initial_commit(&repo, &repo_path);
        fs::write(repo_path.join("README.md"), "# Test Repo\nupdated\n").unwrap();
        fs::write(repo_path.join("new-file.txt"), "new file\n").unwrap();

        let changed_diff = tauri::async_runtime::block_on(get_repository_file_diff(
            repo_path.to_str().unwrap().to_string(),
            "README.md".to_string(),
            false,
        ))
        .unwrap();
        let untracked_diff = tauri::async_runtime::block_on(get_repository_file_diff(
            repo_path.to_str().unwrap().to_string(),
            "new-file.txt".to_string(),
            false,
        ))
        .unwrap();

        assert!(changed_diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("+updated")));
        assert!(untracked_diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("+new file")));
        assert!(!changed_diff.is_binary);
        assert!(!untracked_diff.is_binary);

        fs::remove_dir_all(repo_path).unwrap();
    }

    fn commit_workdir_state(repo: &Repository, message: &str) -> String {
        let mut index = repo.index().unwrap();
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .unwrap();
        index.update_all(["*"].iter(), None).unwrap();
        index.write().unwrap();

        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let signature = repo.signature().unwrap();
        let parent = repo.head().ok().and_then(|head| head.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parents,
        )
        .unwrap()
        .to_string()
    }

    #[test]
    fn test_get_commit_changed_files_reports_modified_file() {
        let (repo_path, repo) = create_test_repo("test_commit_changed_modified");
        create_initial_commit(&repo, &repo_path);
        fs::write(repo_path.join("README.md"), "# Test Repo\nupdated\n").unwrap();
        let hash = commit_workdir_state(&repo, "Update readme");

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            hash.clone(),
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "README.md");
        assert_eq!(files[0].status, "modified");
        assert!(files[0].old_path.is_none());
        assert!(!files[0].is_binary);

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            hash,
            "README.md".to_string(),
        ))
        .unwrap();
        assert!(diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("+updated")));

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_changed_files_reports_added_file() {
        let (repo_path, repo) = create_test_repo("test_commit_changed_added");
        create_initial_commit(&repo, &repo_path);
        fs::write(repo_path.join("added.txt"), "brand new\n").unwrap();
        let hash = commit_workdir_state(&repo, "Add file");

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            hash,
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "added.txt");
        assert_eq!(files[0].status, "added");

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_changed_files_reports_deleted_file() {
        let (repo_path, repo) = create_test_repo("test_commit_changed_deleted");
        create_initial_commit(&repo, &repo_path);
        fs::write(repo_path.join("doomed.txt"), "delete me\n").unwrap();
        commit_workdir_state(&repo, "Add doomed file");
        fs::remove_file(repo_path.join("doomed.txt")).unwrap();
        let hash = commit_workdir_state(&repo, "Delete doomed file");

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            hash.clone(),
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "doomed.txt");
        assert_eq!(files[0].status, "deleted");

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            hash,
            "doomed.txt".to_string(),
        ))
        .unwrap();
        assert!(diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("-delete me")));

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_changed_files_reports_renamed_file_with_old_path() {
        let (repo_path, repo) = create_test_repo("test_commit_changed_renamed");
        create_initial_commit(&repo, &repo_path);
        fs::write(repo_path.join("original.txt"), "stable content\n").unwrap();
        commit_workdir_state(&repo, "Add original file");
        fs::rename(
            repo_path.join("original.txt"),
            repo_path.join("renamed.txt"),
        )
        .unwrap();
        let hash = commit_workdir_state(&repo, "Rename original file");

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            hash.clone(),
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "renamed.txt");
        assert_eq!(files[0].status, "renamed");
        assert_eq!(files[0].old_path.as_deref(), Some("original.txt"));

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            hash,
            "renamed.txt".to_string(),
        ))
        .unwrap();
        assert_eq!(diff.old_path.as_deref(), Some("original.txt"));
        assert!(!diff.is_truncated);

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_changed_files_treats_root_commit_as_additions() {
        let (repo_path, repo) = create_test_repo("test_commit_root");
        create_initial_commit(&repo, &repo_path);
        let head = repo.head().unwrap().peel_to_commit().unwrap();
        let root_hash = head.id().to_string();

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            root_hash.clone(),
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "README.md");
        assert_eq!(files[0].status, "added");

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            root_hash,
            "README.md".to_string(),
        ))
        .unwrap();
        assert!(diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("+++ b/README.md")));
        assert!(diff
            .patch
            .as_deref()
            .is_some_and(|patch| patch.contains("--- /dev/null")));

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_file_diff_flags_binary_content() {
        let (repo_path, repo) = create_test_repo("test_commit_binary");
        create_initial_commit(&repo, &repo_path);
        fs::write(
            repo_path.join("asset.bin"),
            [0x00u8, 0x01, 0x02, 0x00, 0xFF],
        )
        .unwrap();
        let hash = commit_workdir_state(&repo, "Add binary asset");

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            hash.clone(),
        ))
        .unwrap();
        assert_eq!(files.len(), 1);

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            hash,
            "asset.bin".to_string(),
        ))
        .unwrap();

        assert!(
            diff.is_binary
                || diff
                    .patch
                    .as_deref()
                    .is_some_and(|patch| patch.contains("GIT binary patch")),
            "expected binary handling, got {diff:?}"
        );

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_file_diff_truncates_large_patches() {
        let (repo_path, repo) = create_test_repo("test_commit_truncated");
        create_initial_commit(&repo, &repo_path);

        let large_body = "padding line with plenty of text to grow the patch\n".repeat(12_000);
        fs::write(repo_path.join("large.txt"), &large_body).unwrap();
        let hash = commit_workdir_state(&repo, "Add large file");

        let diff = tauri::async_runtime::block_on(get_commit_file_diff(
            repo_path.to_str().unwrap().to_string(),
            hash,
            "large.txt".to_string(),
        ))
        .unwrap();

        assert!(diff.is_truncated);
        let patch = diff.patch.unwrap_or_default();
        assert!(patch.len() <= MAX_FILE_DIFF_BYTES);
        assert!(diff.unavailable_reason.is_some());

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_get_commit_changed_files_diffs_merge_commits_against_first_parent_only() {
        let (repo_path, repo) = create_test_repo("test_commit_merge_first_parent");
        create_initial_commit(&repo, &repo_path);
        let base = repo.head().unwrap().peel_to_commit().unwrap();
        let base_tree = base.tree().unwrap();
        let signature = repo.signature().unwrap();

        let main_blob_oid = repo.blob(b"main side\n").unwrap();
        let feature_blob_oid = repo.blob(b"feature side\n").unwrap();

        let mut main_builder = repo.treebuilder(Some(&base_tree)).unwrap();
        main_builder
            .insert("main-file.txt", main_blob_oid, 0o100644)
            .unwrap();
        let main_tree = repo.find_tree(main_builder.write().unwrap()).unwrap();
        let main_tip = repo
            .commit(
                None,
                &signature,
                &signature,
                "Main side",
                &main_tree,
                &[&base],
            )
            .unwrap();

        let mut feature_builder = repo.treebuilder(Some(&base_tree)).unwrap();
        feature_builder
            .insert("feature-file.txt", feature_blob_oid, 0o100644)
            .unwrap();
        let feature_tree = repo.find_tree(feature_builder.write().unwrap()).unwrap();
        let feature_tip = repo
            .commit(
                None,
                &signature,
                &signature,
                "Feature side",
                &feature_tree,
                &[&base],
            )
            .unwrap();

        let mut merge_builder = repo.treebuilder(Some(&base_tree)).unwrap();
        merge_builder
            .insert("main-file.txt", main_blob_oid, 0o100644)
            .unwrap();
        merge_builder
            .insert("feature-file.txt", feature_blob_oid, 0o100644)
            .unwrap();
        let merge_tree = repo.find_tree(merge_builder.write().unwrap()).unwrap();
        let main_tip_commit = repo.find_commit(main_tip).unwrap();
        let feature_tip_commit = repo.find_commit(feature_tip).unwrap();
        let merge_commit = repo
            .commit(
                None,
                &signature,
                &signature,
                "Merge feature",
                &merge_tree,
                &[&main_tip_commit, &feature_tip_commit],
            )
            .unwrap();

        let files = tauri::async_runtime::block_on(get_commit_changed_files(
            repo_path.to_str().unwrap().to_string(),
            merge_commit.to_string(),
        ))
        .unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "feature-file.txt");
        assert_eq!(files[0].status, "added");

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
    fn test_determine_branch_topology_requires_distinct_non_empty_branches() {
        let (repo_path, _repo) = create_test_repo("test_topology_requires_distinct_branches");
        let path_str = repo_path.to_str().unwrap();

        let result = determine_branch_topology(path_str, "", "main");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("non-empty branch pair"));

        let result = determine_branch_topology(path_str, "main", "main");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("distinct branches"));

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_determine_branch_topology_returns_parent_to_child_distance() {
        let (repo_path, repo) = create_test_repo("test_topology_merge_base_distance");
        create_initial_commit(&repo, &repo_path);

        let base_commit = repo.head().unwrap().peel_to_commit().unwrap();
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

        let _feature_oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Feature commit",
                &tree,
                &[&parent_commit],
            )
            .unwrap();

        let branch_names: Vec<String> = repo
            .branches(Some(BranchType::Local))
            .unwrap()
            .flatten()
            .filter_map(|(branch, _)| branch.name().ok().flatten().map(|name| name.to_string()))
            .collect();
        let secondary_branch = branch_names
            .iter()
            .find(|name| *name != "feature")
            .unwrap()
            .clone();

        let result =
            determine_branch_topology(repo_path.to_str().unwrap(), &secondary_branch, "feature");
        assert!(result.is_ok());

        let topology = result.unwrap();
        assert_eq!(topology.source_branch, secondary_branch);
        assert_eq!(topology.target_branch, "feature");
        assert_eq!(topology.distance_from_ancestor, 1);

        fs::remove_dir_all(repo_path).unwrap();
    }

    #[test]
    fn test_determine_branch_topology_rejects_diverged_siblings() {
        let (repo_path, repo) = create_test_repo("test_topology_rejects_diverged_siblings");
        create_initial_commit(&repo, &repo_path);
        let base_commit = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature-a", &base_commit, false).unwrap();
        repo.branch("feature-b", &base_commit, false).unwrap();

        let result =
            determine_branch_topology(repo_path.to_str().unwrap(), "feature-a", "feature-b");
        assert!(result.unwrap_err().contains("direct ancestor relationship"));

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
        head_ref
            .rename("refs/heads/main", true, "test setup")
            .unwrap();

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
        head_ref
            .rename("refs/heads/master", true, "test setup")
            .unwrap();

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
