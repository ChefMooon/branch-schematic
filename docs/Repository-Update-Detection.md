# Repository Update Detection and Refresh Strategy

## Purpose

This note documents how the application detects that a tracked repository has changed locally and how it balances freshness with UI performance. The Rust `WatcherManager` is the only application-wide repository monitoring owner.

## Manager ownership

At startup, the manager registers active tracked repositories after the database is ready. Repository onboarding, relinking, detail activity, refresh requests, wake recovery, untracking, and shutdown all use manager-owned lifecycle commands. The branch-map view does not create watchers or run an independent hydration polling loop.

The manager normally uses layout-aware filesystem watchers. If watcher registration or recovery fails for an individual repository, the manager starts its own polling monitor for that repository. This is a manager-owned degraded fallback, not a separate application mode or watcher implementation.

After a successful managed cache commit, Rust emits a version 1 `workspace-updated` invalidation event. The event contains repository IDs, a trigger reason, a process-local revision, event and batch metadata, and a timestamp. All batches from one logical outcome share a revision, while each batch has its own event ID. It is only a cache invalidation signal: the shared workspace store re-queries backend data rather than treating the event payload as repository data. Events are bounded to 250 repository IDs per batch, older or duplicate revisions are ignored, and malformed or missed revisions schedule a bounded reconciliation hydration. The aggregate `get_watcher_manager_diagnostics_command` path and the per-repository `get_watcher_manager_debug_snapshot_command` path are separate read-only diagnostics surfaces.

## What triggers a refresh

The app uses two complementary manager-owned mechanisms:

1. Background filesystem watching
   - `WatcherManager` registers repositories, resolves layout-aware metadata scopes, debounces hints, runs the authoritative full-refresh engine, and emits `workspace-updated` after the cache transaction succeeds. The scheduler routes accepted hints through full refresh; targeted metadata/status execution remains a later optimization.

2. Active view polling
   - The branch map relies on the shared invalidation listener and does not run a page-level polling loop.
   - A repository may use manager-owned polling as a degraded fallback when watcher registration or recovery fails.

## How local commits are detected

New local commits are discovered indirectly through Git metadata updates. `WatcherManager` resolves the repository layout and watches logical `HEAD`, refs, `packed-refs`, and `index` targets in the resolved Git metadata root, using stable metadata parents when a target does not exist yet. It does not recursively watch object stores; object-only activity is a verification hint. Worktree monitoring is registered only while a repository is detail-active, and bare repositories have no working-tree watch.

The flow is:

1. A commit is created locally.
2. Git updates refs and object database contents in the repository's resolved Git metadata layout.
3. The active watcher sees the relevant metadata change.
4. The manager classifies and debounces the hint, then schedules the authoritative full refresh.
5. The refresh transaction updates the cached branch and commit rows before the manager publishes its invalidation event.

## Why this design is used

This approach keeps the app fast because it avoids scanning all tracked repositories on every UI render. The manager uses bounded, coalesced event-driven refresh requests for common Git metadata changes, shared frontend invalidation, and scheduled verification or per-repository fallback polling for missed or degraded watcher signals.

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

Fetch, pull, and push do not replace the watcher-based history indexing flow. After contacting `origin`, they refresh sync status and explicitly request the appropriate local refresh so branch and history cache changes do not depend solely on network completion or watcher timing.

That means:

- local commits are primarily detected through filesystem changes
- remote sync state is refreshed through Git network operations
- history cache updates remain centered on the watcher-based indexing path

Managed filesystem events are hints rather than authoritative repository state. A full refresh discovers the current branch set, removes absent branches and dependent mappings transactionally, and retains shared commit rows while any surviving mapping or legacy branch reference still exists. Failed Git probes or cache writes preserve last-known cache data and mark the repository stale instead of clearing it.

## Rollout and measurement

Use `npm run bench:repo-updates -- --repositories 2000` to create a repeatable fixture
metadata run. The output records the machine, operating system, repository mix,
fixture-preparation timing, and the measurement exclusions. The completed 2,000-
repository Windows fixture gate is accepted for the current scope, but it does not
measure Rust manager registration, initial verification, refresh latency, OS watcher
allocations, memory, or CPU. Live Tauri timing must be captured separately from
diagnostics. The 5,000-repository soak remains unverified and deferred.

Use `npm run rollout:check -- diagnostics.json` to evaluate recorded rollout evidence when needed.
The evaluator requests rollback when the 15-minute stale-state rate exceeds 0.5 percent
or the 10-minute registration-failure rate exceeds 2 percent. These metrics are exposed
by aggregate manager diagnostics, but their live denominator behavior and production
captures remain a validation risk. Preserve the database/cache and investigate the
manager state when a gate trips.

## Runtime diagnostics modal

The application title bar includes a read-only `Repository Update Diagnostics` modal
for manual validation. Its activity button is immediately left of Notifications. It
reads the manager-owned
`get_watcher_manager_debug_snapshot_command` snapshot and displays repository IDs,
workspace labels when available, live refresh priority, watcher or polling ownership,
detail activity, running/follow-up state, trigger reason, failure count, and generation.

The modal polls only while it is open. It does not create another watcher, scheduler,
workspace invalidation listener, or refresh path, and it does not persist transient
priority. The snapshot intentionally excludes absolute paths, credentials, and
arbitrary Git output. The modal is distinct from the aggregate diagnostics command
used for rollout metrics. This surface is observational evidence for development and
manual testing; it does not replace automated tests, the accepted 2,000-repository
fixture evidence, or the still-unverified live 5,000-repository soak and desktop
resource measurements. The manual procedure is documented in
[repository-update-diagnostics-guide.md](plans/reports/repository-update-diagnostics-guide.md).

## Notes for future improvement

The remaining rollout work is evidence collection and targeted refresh optimization,
not a second watcher owner. In particular, live desktop validation is still needed
for startup registration, wake recovery, shutdown completion, missing/moved paths,
external Git clients, overflow fallback, resource usage, and the deferred 5,000-
repository soak. If the project later needs stronger guarantees, the next step would
be to add a more explicit refresh policy for large repositories, such as:

- a configurable history depth
- a stronger debounce or backoff policy
- optional forced re-indexing after fetch/pull/push if the branch tip changes significantly
