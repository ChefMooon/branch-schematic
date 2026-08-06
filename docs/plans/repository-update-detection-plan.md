# Repository Update Detection and Refresh Plan

## Briefing

The current implementation uses a lightweight, event-driven refresh strategy for tracked repositories. When a repository is added or viewed in the branch-map experience, the app starts a background watcher through the Tauri backend and registers the repository path for filesystem monitoring. The watcher listens for changes under the repository tree, filters for Git metadata changes under `.git/`, and triggers a re-indexing pass that refreshes cached branch, commit, and sync-status data in SQLite.

This design is sensible for a desktop Git tool because it avoids full-repo scans on every render and allows the UI to stay responsive. The main gap is that repository watching is effectively coupled to the branch-map flow, which means the refresh path is not guaranteed to be active for all repositories in every context. The current daemon already coalesces nearby filesystem events into a single indexing pass, but it still lacks explicit policy for UI event emission, wake/sleep recovery, and clearly defined lightweight-versus-full refresh triggers. For larger workspaces, the system also needs a clear strategy for scaling watcher registration, debounce behavior, and refresh coordination so it remains predictable and efficient as the number of tracked repositories grows.

## General

Global settings and persistence decisions:
- Add a `Detail status refresh interval` control to a new `General` section in Settings. Use a slider bounded from 2 to 5 seconds, defaulting to 5 seconds. The setting controls only the polling/reconciliation safety net for the repository in the `detail-active` tier; it does not change background polling or filesystem-event debounce behavior.
- Persist this value in the existing global `settings` record, validate and clamp it to the supported range when reading it, and keep it out of `tracked_paths`.
- Persist repository pinning on `tracked_paths` through a boolean/integer flag with a default of false. Pin and unpin actions belong in the repository-card action list, with a small pin indicator shown on pinned cards.

## Recommended Improvements

### 1. Make repository watching a first-class lifecycle concern

Treat repository monitoring as a core part of repository tracking, not as a side effect of opening the branch-map page.

Recommended direction:
- Register watchers as soon as a repository is added to the workspace or when tracking is enabled.
- Ensure watcher startup is part of the repository onboarding flow rather than a view-specific initialization step.
- Keep watcher state explicit so the app can distinguish between “tracked but not yet monitored,” “monitoring,” “monitoring failed,” and “unreachable.”
- If a repository is moved, renamed, or deleted on disk, treat that as a lifecycle transition rather than a silent success. The backend should detect that the path no longer resolves or that `git rev-parse --git-dir` fails, stop the watcher for the stale path, cancel any in-flight refresh job for that path, and transition the repository row to a non-active state such as `missing` or `moved`. The default recommendation is to preserve the last-known cache rows and mark them stale rather than hard-delete them automatically; if the repository is later re-added at a new path, the app can either rehydrate the existing row by repo identity or create a new row with a fresh identity.

Why this matters:
- It removes the current dependency on the branch-map page for refresh readiness.
- It makes the behavior consistent across the dashboard, index view, and branch-map view.
- It creates a clearer foundation for future observability and recovery logic.
- It prevents edge-case data loss when repositories are renamed, moved, or removed while the app is running.

### 2. Introduce a central watcher manager instead of ad hoc daemon creation

Move from per-view initialization toward a shared backend service that owns repository watcher lifecycle management.

Recommended direction:
- Create a single watcher manager or registry that tracks all active repository watchers.
- Centralize startup, shutdown, restart, and failure handling in one place.
- Allow the manager to coordinate multiple repositories without duplicating watcher logic across views or commands.
- Make the registry responsible for path invalidation, watcher re-registration after sleep/wake, and cleanup of stale watcher handles when a repository is deleted or moved.

Why this matters:
- It reduces the chance of inconsistent behavior when different UI surfaces trigger refresh paths.
- It makes watcher lifecycle management easier to test and reason about.
- It provides a natural place to add metrics, logging, and intelligent restart behavior later.
- It ensures the same lifecycle rules apply whether the repository is opened from the sidebar, the detail view, or the branch-map experience.

### 3. Make refresh behavior more explicit and configurable

The current model is event-driven and efficient, but it should be guided by explicit policy rather than relying only on a simple burst-detection heuristic.

Recommended direction:
- Define a refresh policy for repositories that includes debounce timing, retry behavior, and backoff for repeated changes.
- Apply the debounce policy to both backend refresh scheduling and Tauri IPC emissions. The Rust backend should aggregate bursts of repository updates and emit a single versioned `workspace-updated` invalidation payload containing the affected repository IDs and the trigger reason. The event tells the frontend which repositories to re-query from SQLite; it is not a second source of repository data.
- Use native OS-level watchers such as `FSEvents`, `ReadDirectoryChangesW`, or `inotify` where available, and fall back to a lightweight polling strategy only when watcher registration is unavailable or the OS budget is exhausted.
- Consider repository-specific tuning for large repositories or repositories with high churn.
- Keep the policy simple at first, but make it easy to evolve toward more advanced controls later.

IPC contract:
- Treat `workspace-updated` as an idempotent cache-invalidation event rather than a data snapshot. The frontend should re-read the affected repository records and cached Git rows from SQLite after receiving it.
- Include a payload version, affected repository IDs, trigger reason, batch metadata, and a monotonic event or repository revision sufficient for the frontend to ignore an older result that arrives after a newer refresh.
- Define duplicate delivery as harmless, preserve the bounded batch size, and provide a conservative reconciliation path when an event is missed, malformed, or has an unsupported version.

Why this matters:
- It prevents a flood of re-indexing passes during heavy Git activity.
- It reduces UI stutter by avoiding a burst of React state updates when a rebase, pull, or large checkout produces many filesystem events in quick succession.
- It improves behavior during rapid local commits, rebases, branch creation, or concurrent updates.
- It creates a foundation for future optional throttling, prioritization, or queue-based processing.

### 4. Separate “change detection” from “full indexing” with explicit trigger mapping

The current flow treats a detected change as a reason to run a full branch/commit index pass. That is robust but may be heavier than necessary for some update scenarios, and the plan should make the boundary explicit so lightweight updates do not accidentally miss important state changes.

Recommended direction:
- Define lightweight refreshes and full re-index operations by `.git/` path category rather than by a generic “something changed” rule.
- Treat branch-tip and symbolic-ref changes as lightweight refreshes when appropriate. Examples include changes to `.git/HEAD`, `.git/refs/heads/`, and `.git/refs/remotes/`, which are usually enough to update current-branch text, branch labels, or basic remote-tracking state.
- Reserve full indexing for repository-state changes that could affect history, commit snapshots, or sync calculations. In practice, changes under `.git/objects/` or `.git/index` should trigger a full re-parse of branch history and sync status because they can alter the visible commit graph or working-tree state.
- Keep the mapping conservative so a lightweight update never silently skips a case that could leave the UI desynchronized.
- Treat filesystem events as hints rather than a complete correctness mechanism. A full refresh must include a periodic or on-demand Git-derived reconciliation pass even when no matching filesystem event was observed.
- Make each full refresh authoritative for the repository: upsert the branches and commits discovered in the current snapshot, remove cached branches no longer present, and remove dependent branch-to-commit mappings transactionally. Shared commit rows must not be deleted until their remaining branch references are accounted for.

Why this matters:
- It gives the system more flexibility as the workspace grows.
- It helps avoid unnecessary database writes and processing overhead.
- It makes the architecture easier to evolve toward incremental or targeted refreshes without introducing stale UI states.
- It turns the object-watch decision from an assumption into a verified design constraint.

### 5. Handle OS sleep/wake and missed events

Desktop Git tools are especially vulnerable to missed filesystem notifications after the machine sleeps or the app is resumed. That can leave the UI looking “clean” even though the repository changed while the app was inactive.

Recommended direction:
- Add an OS lifecycle hook so the watcher manager can react when the system resumes from sleep or the app regains focus.
- On wake, assume that some events may have been missed and invalidate the current “clean” state for tracked repositories.
- Trigger a lightweight verification pass across tracked repositories after wake, and escalate to a full refresh if the repository appears to have changed or if watcher re-registration fails.
- Keep this behavior explicit and non-disruptive so the user sees fresh state without needing a manual refresh.

Why this matters:
- It closes a realistic gap for laptop users and other desktop workflows where external Git activity is common.
- It reduces the chance of stale branch, commit, or sync status after long periods of inactivity.
- It makes recovery behavior deterministic instead of relying on the next manual interaction.

### 6. Protect repository refresh writes against SQLite contention

The plan should explicitly account for concurrent cache updates when multiple repositories change around the same time. A burst of refresh activity could otherwise cause SQLite lock contention or dropped updates during busy Git workflows.

Recommended direction:
- Enable WAL mode for the app’s SQLite database so concurrent readers and writers behave more gracefully.
- Route repository cache and index writes through a single Rust-side writer queue or dispatcher so refresh jobs are serialized at the backend instead of racing in parallel.
- Keep the queue focused on repository refresh/cache writes rather than every database operation, so the UI remains responsive while background indexing stays consistent.
- Enforce a single application instance. Multiple windows within that instance must use the same backend watcher manager, refresh scheduler, and repository-cache writer queue. A second launch should focus or activate the existing instance rather than create a second Rust process. SQLite WAL and busy-timeout settings remain useful safeguards, but cross-process queue sharing is out of scope under this deployment rule.
- For concurrent Git activity from other clients such as VS Code, GitHub Desktop, or the CLI, the backend should treat filesystem notifications as hints rather than ownership claims. If another process is holding a write lock or a repository is temporarily busy, the refresh job should defer and retry with bounded backoff instead of failing permanently.

Why this matters:
- It reduces the chance of `SQLITE_BUSY` errors during overlapping refresh activity.
- It makes large refresh bursts deterministic and easier to reason about.
- It provides a strong foundation for future throttling, retry, and backoff behavior.
- It avoids double-writing or dropped updates when multiple UI surfaces and multiple processes are active at once.

### 7. Add observability around watcher health and refresh outcomes

The app already seems to rely on logs for visibility, but a more structured approach will make future debugging and tuning much easier.

Recommended direction:
- Record watcher startup, shutdown, and failure events in a structured way.
- Track refresh counts, debounce triggers, and index pass outcomes per repository.
- Surface enough diagnostics to understand whether a repository is being watched, whether changes are detected, and whether refreshes are succeeding.
- For user-visible failure states, `monitoring failed` should appear as a warning badge and inline message in the repository list and detail view, while `unreachable` should appear as a stronger warning with a retry affordance. The default behavior should be that the user sees a per-repository warning, and the workspace view should also include an aggregate health indicator showing how many repositories currently need attention. “User interacts with the repository again” should be defined concretely as selecting that repository in the sidebar, opening its detail view, or explicitly clicking Retry from the warning state; any of those actions should trigger a new registration attempt and an immediate refresh check.
- Persist repository health across restarts through the reset migration 2 schema. Store text health states for readability and easier diagnostics, with the allowed values constrained in application code. The durable state should include the repository health status, whether cached data is stale, the last successful verification time, the consecutive failure count, and a sanitized last-error or failure reason suitable for display and diagnostics. Transient watcher handles, queued jobs, in-flight state, and live priority remain runtime-only.
- Recommended `tracked_paths` health fields are `health_state TEXT NOT NULL DEFAULT 'unverified'`, `is_cache_stale INTEGER NOT NULL DEFAULT 1`, `last_verified_at DATETIME DEFAULT NULL`, `last_successful_verification_at DATETIME DEFAULT NULL`, `verification_failure_count INTEGER NOT NULL DEFAULT 0`, and `last_verification_error TEXT DEFAULT NULL`. Use `unverified` for a newly tracked repository until its first successful verification; clear stale/error fields and reset the failure count after successful verification.
- Define recovery transitions explicitly: successful registration and verification clear the failure count and stale error state; a missing or invalid path transitions to `missing` or `moved`; repeated registration or verification failures transition to `unreachable` after the configured threshold; untracking removes or archives the health record according to the existing repository-retention policy.
- Keep telemetry local-only by default. The system should collect only structured counters and state transitions such as watcher start/stop, refresh trigger reason, debounce count, stale-state rate, registration outcome, and queue depth; it should not collect repository paths or names unless the user explicitly opts into a broader diagnostics mode.

Why this matters:
- It turns a currently implicit system into something that can be monitored and tuned.
- It supports diagnosing performance regressions and intermittent misses.
- It helps verify that the refresh strategy is working in real workspaces, not just in isolated scenarios.
- It ensures that backend failures are visible to the user without being disruptive or confusing.

Database impact:
- Persisted repository health is part of the migration 2 schema because the database will be reset before this design is implemented. Add the health columns directly to `tracked_paths` so there is one authoritative health state per tracked repository without introducing a separate table.
- The health fields must be initialized with safe defaults and must not persist active watcher handles, queued jobs, or transient queue state. The reset migration should be tested through startup, restart, missing-path recovery, and unsupported-version handling.
- Use a single global detail-status polling interval setting, defaulting to 5 seconds and bounded to 2 through 5 seconds. Expose it as a user-adjustable slider only if the settings surface can present the responsiveness versus resource-use tradeoff clearly; do not make it a per-repository setting. The setting applies only while a repository is `detail-active` and does not change background polling cadence.
- Persist the global detail-status polling interval in the existing settings record rather than on `tracked_paths`. Because this is a reset-era schema decision, add the setting to the appropriate settings migration path and initialize it to 5 seconds; it must be validated and clamped to the 2-to-5-second range when read.

### 8. Design for repository scale from the beginning

The current behavior is likely acceptable for a small number of repositories, but the architecture should be prepared for larger tracked workspaces.

Recommended direction:
- Assume that the number of tracked repositories can grow significantly over time.
- Treat watcher registration as a bounded OS resource rather than an unlimited capability.
- Avoid per-UI-view watcher initialization patterns that do not scale cleanly.
- Keep the architecture compatible with future optimizations such as batching, repository priority, selective refresh based on activity, or fallback to polling when OS watcher budgets are exhausted.
- Make the watcher manager aware of platform-specific limits such as `inotify` pressure on Linux or `FSEvents` pressure on macOS, and degrade gracefully rather than failing silently.
- On Linux and macOS, if `inotify` or `FSEvents` budgets are exhausted, keep live watches only for active repositories and switch idle or background repositories to stat-based polling with cheap checks such as the `mtime` of `.git/HEAD` and `packed-refs`. On Windows, use `ReadDirectoryChangesW` for active repositories, but if the buffer overflows or the watch becomes unstable, fall back to polling and reopen the watch with a bounded retry loop. Long paths should be normalized to a canonical form before registering a watch, and antivirus-induced delay should be treated as a known failure mode with a safety-net verification poll regardless of platform.

Why this matters:
- It prevents a “works for a few repos, fails for many” transition later.
- It ensures the app remains reliable even when the host OS refuses additional watchers.
- It encourages decisions that are robust as the app matures into a heavier Git dashboard experience.
- It reduces the risk of needing a larger rewrite when repository counts increase.
- It makes the fallback path concrete instead of leaving OS pressure to fail silently.

### 9. Preserve the current user experience while improving backend reliability

The update should not change the visible behavior in a disruptive way. The goal is to make the refresh system more reliable and scalable without making the UI feel more complex.

Recommended direction:
- Keep the dashboard and branch-map experience responsive and consistent.
- Ensure that local commit updates still appear quickly once the system is tracking the repository.
- Avoid introducing UI friction if the backend refresh is temporarily recovering or re-registering watchers.

Why this matters:
- It protects the core workflow of seeing Git updates quickly after local changes.
- It helps ensure that the internal architecture change is invisible to the user except for improved reliability.

### 10. Define an explicit dashboard initial-load policy

The dashboard must become usable from cached data without waiting for watcher registration, Git probing, or a refresh pass across every tracked repository to finish.

Recommended direction:
- Load the tracked repository list and the latest cached branch, commit, and sync data from SQLite first, then render the dashboard immediately. Cached data should be marked stale or loading where appropriate rather than making the initial render wait.
- Start watcher registration and initial verification asynchronously after the cached dashboard state is available. Registration should be staggered in bounded batches so a large workspace does not create a startup spike.
- Give the selected repository and repositories visible in the current dashboard context the highest initial refresh priority. Run a foreground or visible refresh for those repositories as capacity allows, while keeping the dashboard interactive.
- Run lightweight metadata checks for the remaining tracked repositories in the background using the watcher or polling tier assigned by the watcher manager. Do not run a full index pass for every repository as a prerequisite for showing the dashboard.
- Escalate a background repository to a full refresh only when its metadata check indicates a relevant change, its cache is missing or stale beyond the configured threshold, it becomes visible or selected, or the user opens its details.
- Apply bounded concurrency, queue deduplication, debounce, and polling jitter to the initial verification pass. Background refreshes should update the UI incrementally through affected-repository `workspace-updated` events rather than waiting for an all-repositories completion barrier.
- Keep remote sync or network activity separate from initial local metadata verification. Dashboard startup must not wait on remote availability.
- Expose an aggregate initial-refresh state or progress signal for diagnostics and optional UI status, but do not block normal dashboard interaction on that state.

Database impact:
- This initial-load policy does not require a schema change. The dashboard can use the existing tracked repository records and cached Git tables, while freshness and in-flight scheduling remain backend/runtime state.
- Existing `last_viewed_at` and `last_accessed_at` fields may be updated by normal user interactions if the current repository model already uses them, but they should not be repurposed as the authoritative live priority state.

Why this matters:
- It gives the dashboard a predictable cache-first startup path.
- It prevents a large tracked workspace from turning initial load into an all-repository full scan.
- It allows fresh results to appear progressively without sacrificing responsiveness.

### 11. Add focus-aware prioritization and lazy refresh behavior

To match the responsiveness of desktop Git clients such as GitHub Desktop, VS Code, and GitKraken, the refresh system should derive repository priority from user attention and visible context rather than treating every tracked repository equally.

Recommended direction:
- Define an explicit priority model with refresh tiers such as `foreground-full`, `visible-medium`, `background-light`, and `on-demand`.
- Maintain the active repository and priority tier in the watcher manager or refresh scheduler as runtime state. The repository opened in the detail experience is `foreground-full`; if no detail view is open, the selected repository is `foreground-full`; recently interacted-with repositories may remain foreground for a short, configurable grace period before being demoted.
- Add a distinct `detail-active` tier to the priority model for the repository whose details are currently open. While this tier is active, run an immediate targeted `git status --porcelain` refresh when details open, use working-tree filesystem events as refresh hints with debounce, and run a 5-second polling/reconciliation safety net. The interval is a single global user setting bounded to 2 through 5 seconds, with 5 seconds as the default. Stop this working-tree monitoring when details close or the repository leaves the detail view.
- Resolve detail-active working-tree watch paths from the repository layout rather than assuming a `.git` directory. For a conventional repository, watch the working-tree root recursively while filtering out `.git` metadata events; for a gitfile-based repository or linked worktree, watch the checked-out worktree root and resolve Git metadata separately; for a submodule, watch the submodule worktree and its own resolved metadata; for a bare repository, do not start a working-tree status watcher because it has no working tree, and use the normal metadata refresh path instead. All filesystem events remain hints, with `git status --porcelain` as the correctness check.
- Assign `visible-medium` to repositories that are currently rendered in the active branch-map view or otherwise visible in the current workspace context, but are not the primary focus.
- Keep the default for most tracked repositories as `background-light`, using lightweight metadata checks and deferred full refreshes until the repository becomes active or is explicitly opened.
- Support `on-demand` behavior for very large workspaces or idle repositories so full refreshes are deferred until the user opens the repository or the app needs richer state.
- Treat page context as a hint rather than the sole source of truth; the primary signals should be active selection, open detail state, recent interaction, and current visibility.
- Apply hard caps to the number of repositories receiving full refreshes at once, and fall back to lighter checks when the workspace is large or OS watcher budgets are constrained.
- Recompute repository priority whenever the user changes views, opens or closes a repository detail view, selects a repository in the sidebar, changes the visible window, or returns from a sleep/wake transition. Visible-window changes should remain throttled as described in the scale section.
- Treat `tracked_paths.is_active` as the persisted tracking/archive state, not as the transient foreground priority flag. The live priority decision should be derived from current UI and watcher-manager signals and should not require a database migration.
- Persisted priority is a separate concern from live priority. Store the existing access timestamps plus a persisted pinned flag in migration 2. A pinned repository is a durable user preference and receives only a bounded five-minute startup refresh boost; after that boost expires, it returns to its normal priority tier. The pin does not create a stronger background polling tier, while `last_accessed_at` and `last_viewed_at` provide recency hints. Neither may restore an active watcher or stale foreground state indefinitely.

Normal repository-open interaction:
- When a user selects a repository or opens its detail view, immediately promote that repository to `foreground-full` and enqueue a repository-specific high-priority refresh, even if the repository was already tracked and its cache appears current.
- Render the last-known cached details immediately when available, then replace them with the refreshed branch, commit, working-tree, and sync information when the refresh completes. The rest of the dashboard must remain interactive while this runs.
- If a refresh for that repository is already running or queued, coalesce the interaction-triggered request with it and raise its priority rather than starting an overlapping refresh.
- If the repository is in `monitoring failed`, `unreachable`, `missing`, or `moved` state, opening it or selecting it must trigger a watcher re-registration attempt and an immediate refresh check, subject to the existing bounded retry policy.
- On failure, preserve the last-known cached details, mark them stale, and show the repository-specific warning and retry affordance. A failed foreground refresh must not erase valid cached data.
- The refresh result must update the detail view and the shared repository cache so other views receive the same new state.

Database impact:
- The normal repository-open refresh is an execution and scheduling behavior and does not require a new table or column. It reads the existing cache, refreshes Git data through the backend, and writes the existing cache tables.
- Persisted priority uses the existing `last_accessed_at` and `last_viewed_at` timestamps plus a pinned flag on `tracked_paths`. The pinned flag is controlled by the repository-card action list and represented by a small pin indicator on the repository card. It is a durable user preference and provides a bounded five-minute startup priority boost, while timestamps provide recency-based startup hints; live priority remains runtime-derived.

Why this matters:
- It ensures the active repository stays responsive and up to date without overloading the system.
- It prevents large workspaces from triggering expensive Git refreshes for every repository at once.
- It matches the behavior of mature desktop Git clients that prioritize attention and visible context over idle background churn.

### 12. Optimize Git execution and remote-sync behavior for scale

The backend should not rely on expensive or chatty Git operations for every event burst.

Recommended direction:
- Prefer machine-readable Git output such as `git status --porcelain`, targeted ref reads, and fast metadata probes over full terminal parsing where possible.
- Avoid spawning Git for every file change or every repository in the sidebar; batch, coalesce, or deduplicate work at the backend whenever practical.
- Keep local refreshes separate from remote sync checks so branch-state updates do not trigger unnecessary network activity.
- Use a slower refresh cadence and exponential backoff for fetch or remote-state polling when the network is unavailable or the remote is slow.
- For future hardening, consider native library-backed Git access where the performance profile justifies it.

Why this matters:
- It reduces process churn, CPU spikes, and I/O pressure during large local Git operations.
- It keeps the UI responsive while still providing accurate branch and sync status.
- It makes remote awareness more resilient and less wasteful in poor-network situations.

### 13. Add explicit scale-and-resilience hardening for large workspaces

The implementation should explicitly account for the operational realities of tracking at least 2,000 repositories and should be tested against 5,000 repositories in load scenarios. Every watcher cap, poll interval, debounce window, and watcher budget in this plan should be validated against this target scale specifically.

Recommended direction:
- Define a clear watch scope policy that narrows active monitoring to Git metadata paths by default while preserving a fallback path for working-tree changes when needed. The backend should classify changes by whether they affect `.git/HEAD`, refs, objects, index, or worktree state.
- Take an explicit position on `.git/objects/`: the design should watch only `.git/HEAD`, `.git/refs/**`, and `.git/index` live, and treat `.git/objects/` as something consulted on demand during a full refresh rather than watched. That avoids recursive watch pressure from the 256+ fan-out object directories that grow after repacking while still preserving a conservative full-refresh path when history or object state may have changed.
- Support a watcher-tier model with two modes: live OS watches for active repositories and lightweight stat-based polling for idle/background repositories. Polling should use cheap checks such as the mtime of `.git/HEAD` and the refs/packed-refs files rather than holding a persistent watcher for every repo.
- Add both a trailing-edge debounce and a hard maximum wait/force-flush cap so bursts of activity do not leave the UI stale indefinitely. The backend should coalesce nearby events into a single refresh window while still guaranteeing a bounded refresh latency.
- Bound `workspace-updated` IPC payloads explicitly by emitting them in chunks of at most 250 repository IDs. If a wake/sleep event or bulk Git activity affects more repositories than that, the backend should emit multiple smaller events with pagination metadata such as `batch` and `total_batches` rather than one unbounded payload.
- Throttle visible-tier priority recomputation so it does not run on every scroll tick in a virtualized repository list. Recompute only after the visible window has been stable for roughly 250ms or after a 500ms idle period following scroll or resize events, separate from the refresh debounce policy.
- Add a bounded backoff policy for repositories that repeatedly fail to register or re-register a watcher. Start with a short retry interval, expand exponentially up to a cap such as 15 minutes, and transition to an explicit `unreachable` state after a fixed number of consecutive failures (for example 8) until the user interacts with that repository again.
- Add jitter to background polling so repositories on the same `background-light` interval do not synchronize and create a burst problem. Polling should be spread across a small randomized window rather than firing on a single global tick.
- Detect network-mounted repositories (for example, SMB/NFS-style paths) and route them to a polling or degraded mode instead of assuming that native filesystem watches will be reliable.
- Handle non-standard Git layouts explicitly. The backend should identify a gitfile-based repository by probing `$repo/.git` and checking whether it is a file rather than a directory; if it is a file, it should read the `gitdir:` target and resolve the real metadata location before registering any watches. For a linked worktree, the resolver should follow the worktree’s `gitdir` file and, when present, the `commondir` file to reach the actual common metadata directory; for submodules, the watcher should resolve the submodule’s own `.git` file or directory under `.git/modules/<name>` rather than the parent repository’s metadata tree; for bare repositories, the watch root should be the repository root itself and the watch scope should be `HEAD`, `refs/**`, `packed-refs`, and `index` within that directory. The watch paths should therefore differ by layout rather than assuming a single `.git/` directory everywhere.
- Stagger watcher registration at startup rather than initializing every watcher at once. Large tracked sets should be registered in batches with backoff so the app can remain responsive during boot and recovery.
- Add wake/resume handling so the app can recover from sleep or focus transitions by scheduling a lightweight verification pass across tracked repositories, then escalating to a full refresh when evidence suggests a missed event or failed watcher re-registration.
- Prevent in-flight refresh races by deduplicating refresh requests per repository. If a new event arrives while a refresh is already running, the system should either coalesce it into the existing run or queue a single follow-up pass rather than launching overlapping index operations.
- Configure SQLite for sustained refresh load by enabling WAL mode, setting a busy timeout, and serializing repository cache writes through a backend writer queue so refreshes do not contend in a way that causes dropped updates or lock errors.
- Remove implicit small-workspace assumptions from the implementation. Any hardcoded timeouts, event buffer sizes, polling intervals, or UI refresh cadence should be made configurable or bounded so the system can scale to larger repository sets without requiring a rewrite.

Why this matters:
- It ensures the refresh system remains predictable and responsive even as repository counts grow into the thousands and beyond.
- It avoids false assumptions about conventional repo layouts, local-only storage, and uninterrupted watcher availability.
- It gives the implementation a clear path to graceful degradation when OS watcher budgets, recursive watch costs, or storage media make live watching impractical.
- It makes the architecture easier to tune and defend in production because the new lifecycle model is bounded, observable, and resilient under load.

### 14. Define measurable acceptance criteria and a staged rollout

The watcher lifecycle and refresh-policy changes are broad enough that they should not be treated as a single atomic release. The implementation should be rolled out in stages with explicit acceptance criteria and telemetry gates.

Recommended direction:
- Define acceptance criteria against the target scale from recommendation 12. Startup watcher registration should complete within 15 seconds for 2,000 tracked repositories and remain responsive up to 5,000 repositories in soak tests.
- Verify single-instance behavior: a second launch must activate the existing application instance and must not create a second watcher manager, refresh scheduler, or repository-cache writer queue.
- Define dashboard startup acceptance separately from watcher registration: the dashboard must render the tracked repository list and available cached data without waiting for watcher registration or a full refresh across all repositories. Initial verification must continue asynchronously, and the dashboard must remain interactive while it runs.
- Measure foreground refresh latency against a concrete target: a foreground-full refresh should reach the UI within 2 seconds of event coalescing, a visible-medium refresh should settle within 5 seconds, and a background-light refresh should be applied within 30 seconds of a burst without creating a synchronized spike in work.
- Measure normal repository-open behavior separately: selecting or opening a repository must enqueue or promote a `foreground-full` refresh immediately, must not block the rest of the dashboard, and should update the detail view within the foreground refresh target when the repository is reachable. An already-running refresh must be coalesced rather than duplicated.
- Measure `detail-active` working-tree freshness separately: opening details must trigger an immediate `git status --porcelain` refresh; while details remain open, filesystem events must be debounced into status refreshes and the polling safety net must run at the configured 2-to-5-second interval, defaulting to 5 seconds. Closing details must stop this working-tree monitoring.
- Verify persisted-priority behavior: pinning and unpinning must update the repository-card action state and pin indicator, persist across restart, and provide a startup priority boost that expires after five minutes. Current selection and open-detail state must override persisted priority.
- Verify identity behavior: two repositories with different normalized paths remain distinct even when their remote URLs match, while path disappearance and reuse must preserve the existing missing/moved detection flow rather than silently merging repositories.
- Cap steady-state memory and CPU overhead explicitly. The watcher and registry state should remain below roughly 4 KB per tracked repository in steady state, and idle CPU should stay below 3% on a typical 4-core desktop with 2,000 repositories under watch.
- Keep IPC emission bounded and observable by requiring that no `workspace-updated` event contain more than 250 repository IDs and that the backend expose metrics for batches emitted, dropped refreshes, and missed wake recovery.
- Roll out the new watcher model behind a feature flag that is disabled by default. Enable it first for local/internal testing, then for a small beta cohort, then expand gradually to 10%, 50%, and 100% of users while comparing metrics against the legacy path.
- Maintain a fallback path to the previous watcher behavior until the new model meets the acceptance criteria in real workspaces and shows no material regression in stale-state rate, registration failures, or refresh latency.
- Add an explicit rollback trigger: if stale-state rate exceeds 0.5% over 15 minutes, or if watcher registration failure rate exceeds 2% for 10 consecutive minutes while the feature flag is active, disable the new watcher path automatically and revert to the legacy path for the affected workspace. This should be treated as the default rollout safety mechanism unless product chooses a different threshold during sign-off.
- Persisted repository health must be part of the reset migration 2 schema and must fail fast on unsupported schema versions rather than silently running against an unknown shape. Persisted priority is also intended for migration 2, but its exact schema remains subject to the next design decision.
- Every `workspace-updated` IPC payload should include a `version` field so mixed frontend/backend deployments during staged rollout do not desync or misinterpret payloads; incompatible versions should be ignored and fall back to a conservative full refresh from the current state.

Why this matters:
- It turns the architecture change from a best-effort rewrite into a measurable hardening effort with explicit risk controls.
- It gives the team a practical way to validate the new lifecycle model before fully switching over.
- It reduces the chance of a large rollout introducing regressions in real repositories that are difficult to recover from quickly.
- It makes staged rollout safer for both the user and the backend by tying the release to concrete guardrails.

## Decisions Confirmed and Open Questions

The following decisions are confirmed for the next implementation step:
- The desktop application enforces a single running instance. Multiple windows in that instance share one watcher manager, refresh scheduler, and repository-cache writer queue. A second launch activates the existing instance.
- `workspace-updated` is a versioned, idempotent cache-invalidation event. Consumers re-query SQLite for affected repositories instead of treating the event as a repository-data snapshot.
- Full refreshes are authoritative per repository and reconcile removed branches and dependent cache mappings transactionally.
- Repository health is persisted across restarts through the reset migration 2 schema. Runtime watcher handles, queued jobs, in-flight work, and live priority remain transient.

The following implementation boundaries are confirmed:
- The `detail-active` tier uses immediate targeted `git status --porcelain`, debounced working-tree filesystem-event hints, layout-aware watch paths, and a configurable 2-to-5-second polling/reconciliation safety net with a 5-second default. The control belongs in the `General` Settings section. The broader Git metadata path-trigger matrix remains intentionally deferred for the next planning step.
- Repository identity uses normalized `absolute_path` as the primary indicator and `remote_url` as corroborating metadata. This requires no database change because both fields already exist on `tracked_paths`. A future best-effort Git-metadata fingerprint may be added only if moved-repository recovery needs stronger evidence; it must never merge independent clones merely because they share a remote.
- Persisted priority is confirmed as both a restart hint and a user preference. Use the existing `last_accessed_at` and `last_viewed_at` timestamps for recency, add a pinned flag to `tracked_paths`, expose pin/unpin in the repository-card action list, and show a small pin indicator on pinned cards. Pinned state provides only a five-minute startup refresh boost, then returns to the normal tier; pinned state and timestamps must yield to current UI state and must not restore stale foreground monitoring indefinitely.
- Migration 2 should extend `tracked_paths` with the persisted repository-health fields and the pinned flag. Health states use readable text values constrained in application code, with `unverified` as the initial state and the recommended safe defaults documented in the observability section.

## Resolved Implementation Decisions

The following decisions are now normative for implementation. They replace the corresponding alternatives described in the recommendations above.

### Schema version and reset behavior

- Modify the existing migration 2 rather than adding a migration 3. Migration 2 must include the detail-status setting, the repository pin flag, and all persisted repository-health fields.
- This is an alpha-era destructive schema change. Before testing or running the new implementation against an existing database, delete the app database and allow startup to recreate it and apply migrations from an empty file. The reset procedure must be documented for development and manual verification.
- Startup must fail fast when the recorded schema version is newer than the versions supported by the application. It must not silently skip migrations, attempt to reinterpret unknown columns, or run against a partially understood schema.
- A missing database remains recoverable: create the parent directory and database file, run the migration set, and continue with a blank workspace. A malformed, unreadable, or unsupported database is a startup error with a clear diagnostic and a recovery instruction to back up and reset the database.
- Database recovery must be user-visible. When the database is malformed or uses an unsupported schema version, show a recovery state with `Back up database`, `Reset database`, and `Exit` actions. The reset action must require explicit confirmation and must never run silently during normal startup.
- The destructive reset is acceptable for the current alpha because cached workspace data can be re-imported, but it must not be the default production data-management strategy. A production release should preserve the original database, create a backup/export before reset, and prefer a non-destructive migration or repair path whenever one is available. If reset is the only supported recovery, require the user to confirm the backup location and explain exactly what will be removed.
- Migration readiness must be established before exposing commands that read or write the new columns. The Tauri SQL migration target and the SQLx runtime pool must continue to point to the same canonical database path.
- The reset acceptance test must back up and delete the database, launch the app, verify that migration 2 creates the new schema and defaults, restart the app, and verify that the schema is still accepted without another reset. Add a separate recovery test proving that an unsupported schema presents the recovery state without modifying the original database.

### Single-instance enforcement and second-launch activation

- Use `tauri-plugin-single-instance` as the application-level single-instance mechanism. Register it during Tauri builder construction before normal setup work can create watcher or database services.
- The first process owns the database pool, watcher manager, refresh scheduler, and repository-cache writer queue. No second process may initialize any of those services.
- When a second launch is attempted, the plugin must forward its command-line arguments and current working directory to the first process, then the first process must restore, unhide, focus, and request attention for the main window. If the app is in the tray, activation must bring it back to the user-facing window according to the existing tray preference.
- A second launch without an actionable path still activates the existing window. Repository-opening arguments are advisory input to the existing process; they must not bypass normal path validation or create a duplicate tracked-path identity.
- The activation callback must be safe before the main window is fully available. Queue the activation request until setup has completed, and make repeated activation requests idempotent.
- Add tests or a manual acceptance check proving that two launches produce one Rust process, one watcher manager, one refresh scheduler, one writer queue, and one activated main window.

### Watcher manager ownership and lifecycle

- Store one `WatcherManager` in Tauri managed state and expose idempotent lifecycle commands through that manager. Views may request promotion, refresh, or detail-active monitoring, but they must never construct watcher instances directly.
- Key runtime entries by tracked repository ID and retain the canonical normalized path in the entry. A path may be revalidated before use, but a matching remote URL must never merge two independent repository IDs.
- `ensure_monitored` must coalesce concurrent requests for the same repository. `stop_monitored` must cancel the watcher, queued refresh work, and any follow-up pass for that repository. Removing or archiving a repository must call the same shutdown path.
- The manager owns watcher handles, refresh cancellation tokens, retry state, priority state, and in-flight markers. None of these runtime values may be persisted in SQLite.
- The manager must survive view changes and remain active while the app is running. On app shutdown it must stop watchers and cancel scheduler tasks before the database pool is dropped.
- Registration, re-registration, and refresh requests must be deduplicated per repository. A new request while work is running raises priority and records one follow-up request instead of spawning an overlapping indexing pass.

### Refresh and reconciliation ownership

- The backend refresh scheduler is the only component allowed to enqueue repository cache/index writes. A single repository-cache writer queue serializes those writes while allowing non-cache database operations to continue through the normal pool.
- Each refresh request carries a repository ID, priority tier, trigger reason, requested operation (`metadata`, `status`, or `full`), and a coalesced follow-up flag. The scheduler applies bounded concurrency for Git probing and serializes the resulting cache transaction per repository.
- A successful full refresh is authoritative for that repository. Within one transaction, materialize the discovered branch set, upsert current branches and mappings, delete branches absent from the snapshot, remove their dependent mappings, and delete commit rows only after confirming that no remaining branch mapping references them.
- A failed refresh must leave the last-known cache intact, mark the repository stale, record a sanitized failure reason, and schedule bounded retry work. It must never delete valid cached data merely because the current Git probe failed.
- The exact filesystem path-to-operation mapping is deferred to the next planning step. Until that matrix is approved, event hints must use the conservative full-refresh path rather than silently selecting a lightweight operation.

### Git metadata watch and reconciliation matrix

The implementation must classify paths by normalized path components after resolving the repository layout. It must not use platform-specific string fragments such as `contains("/.git/")`. The following matrix is the initial policy for conventional repositories; gitfile-based repositories, linked worktrees, submodules, and bare repositories resolve equivalent logical paths through their layout-specific metadata roots.

| Event or path category | Live watch | Immediate operation | Reconciliation fallback |
|---|---:|---|---|
| `.git/HEAD` | Yes | Metadata refresh; escalate if the checked-out branch changes | Read `HEAD` and current branch |
| `.git/refs/heads/**` | Yes, recursive under `refs` | Full branch/history refresh | Compare the resolved ref snapshot |
| `.git/refs/remotes/**` | Yes, recursive under `refs` | Branch and sync-status refresh | Compare the resolved remote-ref snapshot |
| `.git/packed-refs` | Yes when supported; otherwise stat-polled | Full branch/history refresh | Compare file metadata and parsed refs |
| `.git/index` | Yes for `detail-active` repositories | Working-tree status refresh | Run targeted `git status --porcelain` |
| `.git/objects/**` | No recursive live watch | No direct refresh solely for loose-object creation | Periodic Git-derived verification; escalate when refs or consistency checks indicate visible history changed |
| Pack and commit-graph metadata | No recursive live watch | No direct refresh solely for maintenance activity | Check during periodic verification or a full refresh |
| Worktree files outside `.git` | Only while `detail-active` | Debounced working-tree status refresh | Run `git status --porcelain` at the configured interval |
| Unknown metadata path | No special watch | Conservative full refresh | Full Git verification |

The object-store rule is intentional: recursively watching loose-object directories creates unnecessary watcher pressure at the target scale, while object-only changes from garbage collection or repacking generally do not change the visible branch graph. Ref changes remain the primary signal for history updates. A periodic Git-derived verification pass remains mandatory so filesystem notifications are treated as hints rather than a complete correctness mechanism.

Path classification must include tests for Windows separators and case behavior, canonicalization, root-level `.git` events, gitfile targets, linked worktrees and `commondir`, submodule metadata, bare repositories, packed refs, and unknown paths. Until those layout-specific tests pass, the classifier must choose the conservative full-refresh operation.

### SQLite contention and retry policy

- Configure the runtime SQLite connection for WAL mode and a bounded busy timeout. Verify that the migration connection and SQLx runtime connection use compatible settings against the same file.
- The repository-cache writer queue must retry transient `SQLITE_BUSY` and equivalent lock errors with bounded exponential backoff and jitter. The retry budget is finite; after exhaustion, preserve the cache, mark the refresh as failed/stale, and record the outcome for diagnostics.
- Git operations that fail because another process is changing the repository are transient refresh failures, not permanent repository removal. They follow the same bounded retry path unless path validation proves that the repository is missing or invalid.
- Queue depth, retries, coalesced requests, dropped requests, and terminal failures must be observable through local diagnostics.

### IPC invalidation contract and ordering

- Define `workspace-updated` as a versioned cache-invalidation event with this payload shape:

	```text
	{
		version: 1,
		event_id: string,
		repository_ids: string[],
		trigger: string,
		revision: number,
		batch: number,
		total_batches: number,
		emitted_at: string
	}
	```

- `repository_ids` must contain no more than 250 IDs. A logical refresh result affecting more repositories is split into ordered batches with the same `event_id`, `batch`, and `total_batches` metadata.
- `revision` is a process-local monotonically increasing event sequence owned by the watcher manager. It is used for frontend ordering during one app session; SQLite `updated_at` and the re-query result remain authoritative across restarts.
- The event is emitted only after the repository cache transaction commits. Duplicate delivery is harmless. The frontend ignores an event whose revision is older than the latest revision it has processed for that repository, while still allowing a newer event to trigger a re-query.
- The frontend must subscribe once from a shared workspace synchronization layer, re-query SQLite for affected IDs, and never treat event fields as repository data. If an event is malformed, unsupported, or suspected to have been missed, the consumer schedules a bounded reconciliation query rather than attempting to repair state from the payload.
- Retain user-facing indexing notifications only for explicit foreground actions. Background refreshes use `workspace-updated` and diagnostics rather than success toasts for every repository.

### Frontend cache invalidation and detail synchronization

- Add one shared frontend listener owned by the workspace store or a top-level synchronization hook. It updates affected repository records and invalidates branch, commit, sync-status, and detail-status queries through the existing store/hook boundaries.
- Open detail views must re-query their visible data when their repository ID appears in a committed update event. Responses must be associated with the repository ID and request revision so a late response cannot overwrite newer data or a different selected repository.
- Cache-first rendering remains mandatory: existing SQLite data is rendered immediately, then replaced incrementally after the backend refresh completes. A stale or failed refresh preserves the cached view and adds the health warning state.
- The branch-map view must stop owning watcher startup and must remove its independent four-second hydration loop once event-driven invalidation and the appropriate reconciliation safety net are available. Any remaining polling must be owned by the scheduler policy, not by a page mount.

### Health state machine and retry behavior

- Use the application-level states `unverified`, `monitoring`, `monitoring_failed`, `healthy`, `unreachable`, `missing`, and `moved`. Persist only the durable state and diagnostics fields; watcher handles and retry timers remain runtime-only.
- A newly tracked repository starts as `unverified` and stale. Successful path validation, Git verification, and cache refresh transition it to `healthy`, clear the error, clear stale state, and reset the consecutive failure count.
- A watcher registration failure transitions to `monitoring_failed` while Git verification remains possible. Repeated registration or verification failures transition to `unreachable` after eight consecutive failures. A missing path transitions to `missing`; a valid directory whose Git identity no longer matches the saved repository transitions to `moved`.
- Selecting the repository, opening its details, or clicking Retry resets the retry backoff and attempts registration plus an immediate verification. It does not erase the last-known cache. Successful recovery returns the repository to `healthy`.
- Retry intervals use bounded exponential backoff with jitter, starting at a short delay and capped at 15 minutes. The exact initial delay may be tuned in implementation tests, but the eight-failure threshold and 15-minute cap are part of this contract.
- `last_verification_error` stores sanitized, user-displayable text without repository paths, credentials, remote tokens, or arbitrary command output. Health badges and workspace aggregate counts are derived from the persisted state.

### Detail-active status contract

- Opening a repository detail view immediately requests a targeted working-tree status refresh. The result must include the status entries needed by the changes tab, the uncommitted-change count, and a verification timestamp.
- While detail-active, working-tree filesystem events are hints only and are debounced into a status refresh. A scheduler-owned reconciliation poll runs at the persisted global interval, clamped to 2 through 5 seconds and defaulting to 5 seconds.
- Closing the detail view, switching repositories, navigating away, or unmounting the detail surface cancels its watcher/polling registration. At most one detail-active registration may exist for a repository in the single application instance.
- Status commands have a bounded timeout. A busy index, transient Git lock, or timeout preserves the previous status snapshot, marks it stale, and follows the transient retry policy rather than clearing the changes view.
- Detail refresh responses must be ignored when they no longer match the active repository and request generation. This applies to modal close/reopen and rapid repository switching.

### Performance and acceptance measurement

- Validate scale on Windows first because it is the primary deployment target, then run representative checks on Linux and macOS for watcher-specific behavior. The benchmark corpus must include conventional repositories, gitfile-based worktrees, linked worktrees, submodules, bare repositories, network-mounted paths where available, and repositories with large object stores.
- Measure startup from process initialization to dashboard interactivity, separately from completion of background watcher registration. The dashboard must render cached data without waiting for either operation.
- For 2,000 repositories, watcher registration and initial verification must complete within 15 seconds under the benchmark workload. A 5,000-repository run is a responsiveness and stability soak target, not a requirement to keep all repositories on live recursive watches.
- Measure foreground refresh latency from the end of event coalescing to the committed cache invalidation event; target under 2 seconds. Measure visible-tier refresh under 5 seconds and background refresh under 30 seconds after a burst.
- Report process CPU, private memory, queue depth, watcher count, polling count, refresh latency percentiles, retry counts, and stale-state rate. The 4 KB per-repository runtime target excludes OS-managed watcher allocations and must be reported separately from total process memory.
- Performance tests must use repeatable repository fixtures and record the machine, OS, repository mix, and workload so results can be compared between rollout stages.

### Test matrix and staged rollout controls

- Add focused Rust tests for manager idempotency, cancellation, request coalescing, state transitions, full-refresh deletion, orphan commit cleanup, event batching, event ordering, and lock retry behavior.
- Add frontend tests for cache-first hydration, invalidation re-query, stale response rejection, detail-active start/stop, unsupported event fallback, pin persistence, health badges, and aggregate health counts.
- Add integration or manual acceptance tests for database reset/restart, single-instance second-launch activation, missing and moved paths, wake recovery, Windows path handling, supported Git layouts, and repository operations performed by another Git client.
- The new watcher model is controlled by a feature flag whose default is disabled until internal load and correctness checks pass. The flag source, workspace scope, and rollback owner must be defined before rollout. Automatic rollback disables the new path for an affected workspace when stale-state rate exceeds 0.5% over 15 minutes or registration failures exceed 2% for 10 consecutive minutes.
- Keep the legacy watcher path available until the new path meets the stated acceptance targets without material regression. Rollout stages remain internal, beta, 10%, 50%, and 100%, with metrics reviewed at each gate.

## Priority Discrepancy Remediation Plan

This staged plan addresses the current mismatch between the intended branch-map priority behavior and the implementation. It is limited to priority ownership and its branch-map integration; it does not replace the broader lifecycle, refresh, schema, or rollout stages above.

### Confirmed discrepancy

The intended priority model is:

| Repository context | Intended tier | Current equivalent |
|---|---|---|
| Open detail view or explicit repository selection | `foreground-full` | `RefreshPriority::Foreground` |
| Repository included in the active branch-map view/scope but not foreground | `visible-medium` | `RefreshPriority::Visible` |
| Tracked repository outside the active visible context | `background-light` | `RefreshPriority::Background` |

The current manager assigns ordinary startup repositories `Background` and pinned repositories `Visible`, but the branch-map view does not publish its active view scope to the manager. As a result, repositories represented by the selected branch-map view remain background unless another action promotes them. The current priority value also does not yet select a different refresh operation or polling cadence; it is primarily runtime state used for promotion/coalescing and diagnostics.

The term “visible” in this plan means included by the active canvas view’s repository scope, not merely intersecting the current ReactFlow viewport. Viewport-aware prioritization may be added later as an optimization, but it must not replace active-view scope promotion or make repositories disappear from monitoring when they are panned off-screen.

### Stage P0: Baseline and contract freeze

**Objective:** Record the current priority behavior and freeze the branch-map priority contract before implementation.

**Work packages:**

- Capture manager priority snapshots for startup, active branch-map view, view switching, scope changes, pinning, repository selection, and detail open/close.
- Confirm that the active view’s visible repository set is the deduplicated `repo_path_id` values from the authoritative `get_workspace_nodes(viewId)` result after path and branch visibility rules are applied. A repository is included when at least one branch node remains in scope. ReactFlow viewport intersection and tag-filter dimming do not alter this set; viewport intersection may only affect a separate optional optimization tier.
- Replace scalar priority mutation with signal-owned runtime state. Track independent signals for detail sessions, explicit selection, active-view membership, and the startup pin boost. Compute the effective tier from those signals using `Foreground > Visible > Background > OnDemand`; removing one signal must recompute the tier without affecting the others.
- Define explicit selection ownership and lifetime. Selection must have a manager-facing owner and clear on deselect, view switch, branch-map route unmount, repository removal, or replacement by another selection. Selection and detail state are separate signals and must not be inferred from each other.
- Define active signals explicitly: any current detail session and explicit repository selection are foreground signals; active canvas-view inclusion is a visible signal; the pin flag is only a bounded startup hint and never a permanent visible or foreground signal.
- Record that priority is not complete until it affects an explicitly documented scheduler behavior. A diagnostic label alone does not satisfy the contract.

**Validation gate:** Add or update a baseline report with debug snapshots and a table showing the expected and observed tier for each scenario. No production behavior changes are allowed in this stage.

### Stage P1: Manager-owned priority state and promotion API

**Objective:** Give the `WatcherManager` an explicit, idempotent API for updating active-view visibility without allowing views to construct watchers or mutate runtime entries directly.

**Work packages:**

- Add a manager operation equivalent to `set_visible_repositories(view_id, repository_ids)` or a scoped promotion/reconciliation API. The manager must validate that IDs are active tracked repositories before changing runtime priority.
- Reconcile the complete visible set atomically: promote IDs in the set to `Visible`, remove the active-view visible signal from IDs no longer in the set, and preserve `Foreground` for selected/detail-active repositories. An empty set must clear the previous active-view signal.
- Make repeated updates idempotent and coalesce updates arriving while registration or refresh work is running. Do not create duplicate watcher handles or overlapping refreshes.
- Keep the active-view signal runtime-only. Do not persist it in `tracked_paths`, `canvas_views`, or `is_active`.
- Replace permanent pinned-to-visible startup behavior with a runtime startup boost. At manager initialization, record one monotonic startup epoch; a pinned repository receives `Visible` only while `now - startup_epoch < 5 minutes`. The boost must not restart on watcher re-registration, refresh retry, wake recovery, or pin-row reread. A process restart starts a new bounded epoch but never restores foreground or active-view state.
- Add diagnostics for the source of a promotion and the effective tier so `visible` cannot be confused with “pinned” or “currently running.”

**Validation gate:** Rust tests cover complete-set reconciliation, empty-set clearing, duplicate IDs, unknown/inactive IDs, foreground protection, foreground-to-visible fallback, visible-to-background demotion, pin-boost expiry, restart epoch behavior, lower-priority trigger protection, and concurrent promotion with an in-flight refresh.

### Stage P2: Branch-map scope synchronization

**Objective:** Make the active branch-map view publish its visible repository scope to the manager through the existing frontend/backend boundary.

**Work packages:**

- On branch-map initialization and every active view change, derive the deduplicated repository IDs represented by the active view after scope and branch visibility rules are applied. Derive the set only from the completed `get_workspace_nodes(viewId)` result; tag-filter dimming and viewport position do not alter membership.
- Send the complete set to the manager through a typed Tauri command or the shared workspace synchronization layer. The branch-map component must request priority changes only; it must never create or own watcher instances.
- Reconcile scope changes when repositories or branches are hidden/unhidden, views are duplicated/renamed/deleted, tracked repositories are archived/untracked, or cache invalidation changes the rendered node set.
- Clear the previous active-view signal when leaving the branch-map route, when no active view exists, or when hydration returns no nodes. Do not clear foreground/selection/detail-active state as a side effect.
- Ensure late responses from a previous view cannot overwrite the priority set for the newer active view. Associate requests with an active-view generation or use a manager-side latest-set-wins contract.

**Validation gate:** Frontend tests verify promotion on initial load, active-view switching, scope changes, empty views, deduplication for exploded branches, tag-filter non-effect, route unmount cleanup, hydration completion, and stale response rejection. A manual check confirms that repositories in the selected view report `visible` while unrelated tracked repositories remain `background`.

### Stage P3: Priority-aware refresh scheduling and lifecycle integration

**Objective:** Ensure the promoted tier changes meaningful refresh behavior and remains correct across all priority signals.

**Work packages:**

- Define this normative scheduler matrix before implementation:

| Tier | Queue ordering | Refresh operation | Polling/reconciliation | Concurrency |
|---|---|---|---|---|
| `Foreground` | Highest | Immediate full refresh for selection; targeted status refresh for detail-active | Detail-active poll uses the global 2-to-5-second interval; selection alone does not create a separate poll | Subject to the foreground cap |
| `Visible` | Above background | Metadata or conservative full refresh according to the trigger matrix; active-view promotion itself requests one coalesced verification | Uses the visible-tier policy, not the detail-active interval | Subject to the visible-tier cap |
| `Background` | Lowest scheduled tier | Lightweight metadata verification, escalating to full refresh when evidence requires it | Jittered background polling/fallback policy | Subject to the background cap |
| `OnDemand` | User-requested work only | Explicit full/status request | No recurring poll from this tier | Uses the applicable foreground request cap |

	The implementation may refine operation details only through an approved discrepancy. It must not satisfy the contract by changing labels while leaving queue ordering, refresh selection, and polling behavior identical.
- Preserve the conservative trigger matrix: active-view visibility must not suppress a required full refresh, and filesystem events remain hints subject to Git-derived verification.
- Ensure filesystem, polling, wake, onboarding, selection, detail, archive/untrack, and shutdown paths route through the same manager priority state. A background-triggered event must not accidentally demote an already-visible or foreground repository.
- Define how visible repositories behave when the active view changes during an in-flight refresh: finish the current authorized operation, coalesce one follow-up if needed, and apply the latest effective priority to queued work.
- Keep foreground selection/detail-active precedence over visible scope and ensure closing detail removes only the detail signal, allowing active-view visibility to remain.
- Make detail activation an atomic, latest-state-wins manager transition. The manager must update detail state, reconcile watcher targets, schedule the immediate status refresh, and install or remove the detail timer as one transition. A stale open request must never reactivate detail monitoring after close. Detail state must use a stable session token or reference count so closing one exploded branch-card detail cannot clear another active detail session for the same repository.
- Make pin expiry and app restart deterministic. A pinned repository receives the bounded startup boost defined in P1, then returns to its context-derived tier without reviving a watcher or foreground state by itself.

**Validation gate:** Scheduler tests prove tier-specific queue ordering/operation behavior, no demotion by lower-priority triggers, correct foreground-to-visible and visible-to-background fallback, pin expiry, wake recovery, no overlapping refreshes, detail target reconfiguration, close-during-registration, rapid open-close-open, and independent exploded-card detail sessions. Diagnostics must expose effective tier, active signals, and the reason it was selected.

### Stage P4: End-to-end branch-map and scale validation

**Objective:** Prove that priority follows user context without creating a startup or scrolling storm.

**Work packages:**

- Test active-view switching and scope changes with multiple repositories, shared branch IDs, exploded branch cards, missing repositories, and repositories whose watchers are in fallback polling mode.
- Verify cache-first branch-map rendering: visible repositories are promoted asynchronously after nodes are available, and the map is not blocked on manager registration or a full refresh barrier.
- Apply the existing visible-window recomputation throttle only if viewport-aware prioritization is implemented. It must be separate from active-view scope promotion and must not run on every scroll event.
- Treat fixture preparation as insufficient for acceptance. Add a live Tauri measurement scenario that records registration latency, effective priority transitions, queue depth, refresh concurrency, watcher/polling counts, CPU, memory, and stale-state latency. Report the 2,000-repository run and 5,000-repository soak separately; active-view membership must not imply simultaneous full refreshes for every repository.
- P4 is blocked until the existing feature-flag source, precedence, scope, and rollback contract is resolved in the earlier implementation stages. With the flag disabled, no new scope-sync command, manager registration, or priority mutation may execute. With the flag enabled, the legacy watcher/polling path must not also register or refresh the same repository. Diagnostics must expose the active mode.

**Validation gate:** Run the focused frontend and Rust tests, full builds, and the applicable scale benchmark. Record observed tier transitions and resource measurements in the stage report. The branch-map promotion is not rollout-ready if it only changes diagnostics without improving the documented scheduler behavior or if it causes all active-view repositories to refresh concurrently without caps.

### Adversarial review findings incorporated

The plan was reviewed against the current branch-map, canvas-store, workspace-store, manager, and detail-view paths. The review identified and this revision addresses the following failure modes:

- **Scope ambiguity:** “Visible” could mean active-view membership or current viewport intersection. The plan now makes active-view membership normative and keeps viewport optimization optional.
- **Demotion bugs:** A naïve “set visible” command could permanently promote repositories or demote foreground/detail-active repositories. The plan now requires complete-set reconciliation, precedence, and signal-specific removal.
- **Exploded-node duplication:** A repository can produce multiple branch cards. The plan now requires repository-ID deduplication before promotion.
- **Stale view races:** A delayed response from an old active view could overwrite a newer view’s set. The plan now requires generation or latest-set-wins protection.
- **Pinning confusion:** Pinning was acting as a permanent `Visible` priority. The plan now treats it as a five-minute startup hint and tests expiry independently from active-view visibility.
- **Label-only implementation:** Changing `Background` to `Visible` would not necessarily change refresh work. The plan now requires explicit scheduler effects and tests that distinguish runtime labels from behavior.
- **Lifecycle gaps:** Branch-map-only updates could be lost during onboarding, wake, archive, untrack, detail close, or fallback polling. The plan now routes all signals through the manager and tests their precedence.
- **Scale regression:** Promoting every active-view repository without queue or concurrency limits could create a burst. The plan now requires bounded scheduling and measurements at the existing scale targets.
- **Scalar-priority recovery:** A single `max()` priority cannot demote a repository when a view, selection, detail session, or pin boost ends. The plan now requires independent signal ownership and effective-tier recomputation.
- **Detail watcher race:** Enabling detail after watcher registration can omit worktree targets, and close can race with a pending open. The plan now requires an atomic manager transition, target reconciliation, latest-state-wins behavior, and session ownership.
- **Selection ownership gap:** The current branch-map path has no shared selection lifetime. The plan now requires an explicit owner and clear policy instead of assuming node selection exists.
- **Benchmark overclaim:** Fixture specifications do not prove live priority or resource behavior. The plan now requires a live Tauri measurement scenario and separates 2,000-repository validation from the 5,000-repository soak.

### Final priority handoff criteria

Priority work is ready to enter implementation only when:

- active-view repositories reliably become `Visible` and unrelated repositories remain `Background`;
- foreground selection and detail-active state override visible scope and recover correctly when removed;
- pinning provides only the bounded startup boost;
- priority changes are manager-owned, idempotent, generation-safe, and shared across views;
- effective priority changes an explicitly documented scheduler behavior rather than diagnostics alone;
- cache invalidation, refresh failure, fallback polling, wake recovery, and shutdown preserve the same priority invariants; and
- focused tests, full builds, and scale measurements are recorded without changing production code during planning.

## Implementation Notes for the Future

This update should be treated as a foundation change rather than a narrow bug fix. The main objective is to make repository update detection dependable, predictable, and scalable across the full app experience.

The work should be planned in phases:
1. Establish the target scale assumption and benchmark harness, including explicit acceptance targets for registration time, refresh latency, memory overhead, and idle CPU usage.
2. Implement the cache-first dashboard initial-load path and explicit repository-open refresh interaction, then verify that cached data renders before asynchronous watcher registration and background verification begin.
3. Implement reliable watcher registration for tracked repositories and lock in the watch-scope policy so live watches are limited to `.git/HEAD`, `.git/refs/**`, and `.git/index`, while `.git/objects/` is handled on demand during full refreshes.
4. Add wake/sleep recovery, missed-event handling, explicit lifecycle recovery logic, and bounded backoff with an `unreachable` terminal state for repeatedly failing watchers.
5. Centralize lifecycle management and error handling, including a bounded watcher registry, batch registration, graceful fallback to polling when OS limits are reached, and explicit recovery after focus transitions.
6. Introduce configurable debounce and refresh policy, including coalesced Tauri IPC notifications emitted in bounded batches, visibility-priority throttling for virtualized lists, jittered background polling, and a backend write queue for repository cache/index updates.
7. Add SQLite concurrency safeguards such as WAL mode, busy-timeout handling, and retry logic for transient write contention.
8. Optimize Git execution paths for local refreshes and add throttled, backoff-based remote sync behavior.
9. Add observability, metrics, and performance guardrails so watcher health, refresh outcomes, and rollout health can be inspected in real workspaces.
10. Roll out the new lifecycle model behind a feature flag in staged phases, verify behavior against 2,000- and 5,000-repository load scenarios, and only then switch the default path over fully.

This approach will help ensure the system remains robust as repository counts, update frequency, and user expectations grow.
