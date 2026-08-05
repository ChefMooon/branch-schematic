# Git Commit History Flow and Integration Plan

## Purpose

This document reviews how the application discovers, caches, and presents Git commit history and related branch state. The focus is on the interaction between the desktop app and the local Git repository metadata, plus the remote Git operations that update that state.

## Current Architecture Summary

The app uses a hybrid model:

- Local repository inspection is performed by the Rust backend using the git2 library.
- Branch and commit history are cached into SQLite so the UI can render quickly without repeatedly traversing the repository.
- Remote operations such as fetch, pull, and push are executed through git2 and the repository's configured origin remote.
- The React frontend calls Tauri commands to trigger these workflows.

## Where the Logic Lives

### Backend: Git discovery and caching

- Rust Git command entry points live in [src-tauri/src/git.rs](src-tauri/src/git.rs)
- Background indexing and repository monitoring run from [src-tauri/src/manager.rs](src-tauri/src/manager.rs)
- The cache schema for branch and commit snapshots is defined in [src-tauri/src/db.rs](src-tauri/src/db.rs)

### Frontend: repository actions and rendering

- Repository cards and branch actions invoke Tauri commands from the React app, especially in [src/features/index/components/RepositoryCard.tsx](src/features/index/components/RepositoryCard.tsx)
- The workspace store consumes status data from the backend in [src/stores/workspace-store.ts](src/stores/workspace-store.ts)
- The branch map / canvas views use cached branch metadata from the database layer in [src/features/branch-map](src/features/branch-map)

## How the App Finds Local Git History

### 1. Repository registration and initial warm-up

When a repository is added to the workspace, the frontend calls `ensure_repository_monitored_command` from [src-tauri/src/lib.rs](src-tauri/src/lib.rs). The `WatcherManager` registers the repository and immediately runs an initial refresh so the cache is populated as soon as the repo is tracked.

### 2. How the app notices new local commits

The app does not rely on Git hooks or a UI-side polling loop for commit detection. Instead, the Rust `WatcherManager` uses the `notify` crate to watch layout-aware Git metadata targets.

When Git writes new objects, refs, or other metadata, the watcher detects that change, waits briefly for the burst to settle, and then runs a fresh indexing pass. In practice, this means:

- local commits are noticed through `.git` filesystem changes
- the manager uses a small debounce window before refreshing
- the app reuses cached SQLite state instead of scanning the repository on every render

This is the main mechanism that keeps the app responsive while still making recent local commit history available quickly.

### 3. What the index pass does

The index pass:

- opens the repository with `git2::Repository::open`
- enumerates local branches with `repo.branches(Some(BranchType::Local))`
- identifies the current HEAD branch
- resolves each branch tip commit
- captures the latest commit metadata for each branch
- writes or updates branch rows in `cached_git_branches`
- walks recent history for each branch tip using `git2 revwalk`
- writes recent commits into `cached_git_commits`
- stores branch-to-commit mappings in `cached_git_commit_branches`
- recomputes and caches sync status for the HEAD branch

This produces a lightweight branch snapshot with:

- branch name
- whether it is the current HEAD branch
- latest commit hash
- author
- commit summary
- commit timestamp

### 4. Why the UI stays fast

The frontend reads from the SQLite cache rather than traversing the repo on every render. The shared workspace invalidation event triggers targeted hydration after a successful manager refresh, while the manager can use per-repository polling when filesystem watching is degraded.

## How Commit History Is Cached

The cache is organized around the following tables:

- `cached_git_branches`
  - stores branch-level state such as branch name, HEAD status, last commit hash, and sync counters
- `cached_git_commits`
  - stores historical commits keyed by commit hash and linked to a branch row
- `cached_git_commit_branches`
  - stores the many-to-many mapping between commits and branches so shared commits can be associated with more than one branch

The daemon currently walks the most recent 100 commits per branch and stores them in the commit cache. That remains the current default for UI responsiveness, and the mapping table makes the history model more accurate for shared commit ancestry.

## How the UI Uses the Cached History

The frontend does not directly invoke `git log` from the UI. Instead, the Rust backend exposes database-backed data and status snapshots.

The app uses the cached state to support:

- repository cards showing current branch and sync status
- branch-level views that render recent commit history
- canvas-based branch visualizations that depend on branch metadata

The actual SQL access is mediated through the backend database layer in [src-tauri/src/db.rs](src-tauri/src/db.rs), which exposes the queries that power the workspace and branch-map views.

## How Remote Git Operations Work

The app also supports real Git network operations against the repository's `origin` remote.

### Fetch

The `git_fetch_operation` command:

- resolves the repository path from the tracked path id
- opens the repository with `git2`
- uses auth callbacks to negotiate credentials
- calls fetch on the `origin` remote
- refreshes cached sync status afterward

### Pull

The `git_pull_operation` command:

- fetches from `origin`
- analyzes whether the current branch can be fast-forwarded
- performs a fast-forward update if possible
- rejects divergent branches with a clear error message
- refreshes cached sync status afterward

### Push

The `git_push_operation` command:

- resolves the current branch
- verifies that it has an upstream configured
- pushes the branch to `origin` using a push refspec
- refreshes cached sync status afterward

Importantly, fetch/pull/push currently refresh sync status, but they do not run the full branch-history reindex pass. For that reason, the history cache depends primarily on the filesystem watcher and the initial scan.

## Related Notes

A more operational view of the refresh strategy, including the exact watcher triggers and performance tradeoffs, is documented in [docs/Repository-Update-Detection.md](docs/Repository-Update-Detection.md).

## Relationship to GitHub

The GitHub integration in this project is mostly about repository discovery and authentication, not about directly reading commit history from the GitHub API.

The application relies on local Git state for commit history and branch topology. GitHub is mainly used for:

- identifying repository ownership and remote metadata
- authenticating remote network operations
- loading repositories into the app for tracking

## Current Gaps and Risks

The current implementation is effective for local branch visualization and lightweight history caching, but there are a few areas worth reviewing:

1. Commit history is capped at 100 commits per branch
   - That is enough for compact views, but it is not a full audit trail for larger repositories.

2. History updates are driven by filesystem watchers and the active-canvas refresh loop
   - This is responsive, but it can still lag behind unusual repository changes if the watcher misses an event or if the repo is modified outside the expected path patterns.

3. Sync status is cached separately from history
   - The app recomputes ahead/behind state and stores it, which is good for UI performance, but the UI can still show stale sync information until the next refresh or index cycle.

4. Remote operations refresh sync status but do not re-run the full history index pass
   - That keeps the network flow lightweight, but it means history updates are primarily driven by local filesystem changes rather than by fetch/pull/push events.

5. Remote operations are local Git operations, not GitHub API history reads
   - If the product eventually wants GitHub commit history beyond the local clone, a direct API-backed history flow may be necessary.

## Recommended Plan

### Phase 1: Document and verify the current flow

- Confirm the exact Tauri commands used by the UI for repository status and history refresh.
- Map the database tables that power branch and commit views.
- Capture the existing behavior in documentation and usage notes for future contributors.

### Phase 2: Improve robustness of local history indexing

- Evaluate whether the app should index more than the last 50 commits per branch.
- Consider supporting a configurable history depth or a full-history mode for larger repositories.
- Add clearer logging or diagnostics when indexing fails for a repository.

### Phase 3: Strengthen sync-state freshness

- Ensure refresh actions trigger consistent branch and history cache updates.
- Review whether fetch/pull/push should also refresh commit history metadata when the branch tip changes significantly.

### Phase 4: Consider a richer history model

- If the app needs richer commit visualization, consider adding a dedicated history-sync pipeline that can pull a larger set of commits and preserve branch ancestry more explicitly.
- If GitHub-hosted history is required, introduce a separate backend path that reads commit history from the GitHub API and merges it with the local cache.

## Suggested Implementation Order

1. Audit the existing frontend-to-backend command flow.
2. Document the current behavior and identify any gaps in the cache model.
3. Improve the indexing pass to make history refreshes more predictable.
4. Add optional tuning for history depth and refresh behavior.
5. Revisit whether GitHub API history should be surfaced directly in the UI.

## Conclusion

The app currently treats Git history as a locally discovered and locally cached data source. The Rust backend performs the real repository inspection and remote Git operations, while the frontend consumes the resulting state through Tauri commands and SQLite-backed queries. This is a solid foundation for branch visualization and lightweight history browsing, and it can be extended to support more detailed history views and stronger sync guarantees.
