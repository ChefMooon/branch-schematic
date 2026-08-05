# Repository Update Detection and Refresh Strategy

## Purpose

This note documents how the application detects that a tracked repository has changed locally and how it balances freshness with UI performance.

## What triggers a refresh

The app uses two complementary mechanisms:

1. Background filesystem watching
   - Each tracked repository is registered with the Tauri backend through `watch_project_directory`.
   - The backend starts an `IndexerDaemon` for that repository.
   - The watcher listens for filesystem changes under the repository's `.git/` directory.
   - When a relevant change is detected, the daemon waits briefly and then runs a new indexing pass.

2. Active view polling
   - The branch-map UI keeps a small polling loop while an active view is open.
   - That loop calls the workspace-node hydration path every 4 seconds to refresh the visible branch metadata without forcing a full scan on every interaction.

## How local commits are detected

New local commits are discovered indirectly through Git metadata updates in the repository's `.git` tree. The watcher is intentionally scoped to `.git/` changes rather than all repository files because the Git metadata change is the signal that local branch tips or commit history changed.

The flow is:

1. A commit is created locally.
2. Git updates refs and object database contents under `.git/`.
3. The watcher sees the change.
4. The daemon debounces the burst of events.
5. An indexing pass runs and updates the cached branch and commit rows.

## Why this design is used

This approach keeps the app fast because it avoids scanning all tracked repositories on every UI render. Instead, the app uses a lightweight event-driven refresh path for the common case (a local Git change) and a low-frequency poll for the active canvas view.

## What gets refreshed

When the indexing pass runs, it updates:

- branch metadata in `cached_git_branches`
- recent commit history in `cached_git_commits`
- commit-to-branch mappings in `cached_git_commit_branches`
- cached ahead/behind sync status for the head branch

## When manual refresh is used

The UI also exposes a manual status refresh path:

- the repository status action calls `refresh_repository_git_status`
- that command recomputes branch sync status and writes it to the cache

Manual refresh is useful when the user wants to force a sync-status update immediately, but it is not the main mechanism for local history updates.

## Remote operations

Fetch, pull, and push do not replace the watcher-based history indexing flow. They primarily refresh sync status for the repository after contacting `origin`.

That means:

- local commits are primarily detected through filesystem changes
- remote sync state is refreshed through Git network operations
- history cache updates remain centered on the watcher-based indexing path

## Notes for future improvement

If the project later needs stronger guarantees, the next step would be to add a more explicit refresh policy for large repositories, such as:

- a configurable history depth
- a stronger debounce or backoff policy
- optional forced re-indexing after fetch/pull/push if the branch tip changes significantly
