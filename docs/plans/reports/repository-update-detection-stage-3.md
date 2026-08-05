# Repository Update Detection Stage 3 Report

## Decision Record

- **Stage:** 3, Watcher Manager and Scheduler Ownership
- **Date:** 2026-08-05
- **Machine:** Windows 11 Home
- **Decision:** Add one managed runtime owner and scheduler boundary while keeping the legacy recursive watcher as the default flag-off adapter. Existing watcher command call sites remain compatible and route through the manager only when managed mode is explicitly enabled.
- **Disposition:** Pass with risk. Manager ownership, startup enumeration, request coalescing, retry scheduling, lifecycle cleanup, and diagnostics are implemented and tested. Live managed-mode desktop behavior, shutdown event integration, and watcher replacement remain unverified or belong to Stage 4.

Preceding evidence: [Stage 2 report](repository-update-detection-stage-2.md).

## Feature-Flag Contract

The mode is evaluated once when the manager is created:

- `BRANCH_SCHEMATIC_WATCHER_MODE=managed` enables the new manager path.
- `BRANCH_SCHEMATIC_DISABLE_NEW_WATCHER=1`, `true`, or `yes` forces legacy mode and takes precedence.
- Any other value, missing value, or emergency-disable value selects `legacy`.
- The mode is process-scoped and observable through `get_watcher_manager_diagnostics_command`.
- The default remains legacy, as required by Stage 0.

## Changed Files

- `src-tauri/src/manager.rs`: added `WatcherManager`, runtime entries, managed/legacy mode selection, idempotent registration, request coalescing, priority/detail state, bounded retry scheduling, startup enumeration, diagnostics, stop operations, and explicit `stop_all` shutdown primitive.
- `src-tauri/src/lib.rs`: registered manager state after schema readiness, scheduled startup registration of active paths in managed mode, routed `watch_project_directory` through the manager when enabled, and added typed manager commands.
- `src-tauri/src/git.rs`: relink and untrack commands now stop stale managed entries; relinked paths are re-registered at foreground priority in managed mode.
- `src-tauri/src/refresh.rs`: consecutive persisted verification failures are loaded before transitions, and cache-writer failures now mark the repository stale before returning.
- `docs/CODEBASE_MAP.md`: regenerated.
- `docs/plans/reports/repository-update-detection-stage-3.md`: this report.

## Implemented Ownership

- One managed `WatcherManager` is created only after database schema readiness and shares the Stage 2 `RepositoryCacheWriter`.
- Runtime entries are keyed by tracked path ID and retain the current absolute path, generation, priority, detail-active state, running state, follow-up marker, and failure count.
- `ensure_monitored` is idempotent. Requests for an entry already running are coalesced into one follow-up pass and raise priority.
- `request_refresh` promotes an existing entry without creating parallel refresh work.
- `set_detail_active` records foreground detail priority without creating a second registration.
- `stop_monitored` removes runtime ownership for untrack and relink cleanup. Generation checks prevent a removed entry from starting a subsequent follow-up pass.
- Startup enumerates active tracked paths in managed mode and registers them asynchronously so database setup does not block the UI.
- Registration uses pinned paths as visible priority and other active paths as background priority.
- Failed refreshes use bounded exponential retry delays from the Stage 2 health primitive. Persisted consecutive failure counts now advance toward the eight-failure `unreachable` threshold.
- Manager diagnostics expose active mode, entry count, running refreshes, registration attempts, coalesced requests, cancellations, terminal failures, and shutdown state.
- Existing frontend and database-management calls to `watch_project_directory` remain the compatibility boundary. Legacy mode still constructs `IndexerDaemon`; managed mode does not construct a second daemon.
- Relink and untrack lifecycle commands clean up managed runtime entries. Relink re-registers the new path.

## Validation Results

Environment: Windows 11 Home; Node `v22.23.1`; npm `10.9.8`; Rust `rustc 1.94.1 (e408947bf 2026-03-25)`; Cargo `1.94.1 (29ea6fb6a 2026-03-24)`.

| Command | Result |
| --- | --- |
| `cargo test --manifest-path src-tauri/Cargo.toml manager::tests` | Passed: 3 tests. |
| `cargo test --manifest-path src-tauri/Cargo.toml refresh::tests` | Passed: 3 tests. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 42 tests; 0 failed. |
| `npm test` | Passed: 29 test files, 105 tests. Existing React `act(...)` warnings remain. |
| `npm run build` | Passed. Existing Vite large-chunk warning remains. |
| `npm run docs:code` | Passed. |
| `git diff --check` | Passed; only existing Windows line-ending warnings were reported. |

An invalid combined Cargo filter command (`refresh::tests manager::tests`) was rejected by Cargo before running tests; the two valid focused commands were then run separately and passed.

## Manual Checks

The following checks are **critical and unverified**. They should be performed before enabling managed mode beyond local development:

1. Set `BRANCH_SCHEMATIC_WATCHER_MODE=managed`, launch the desktop app, and invoke `get_watcher_manager_diagnostics_command` through the normal diagnostics path or developer tooling. Verify the mode is `managed`, active tracked paths register once, and no legacy daemon watcher is started.
2. Add a repository through the database-management screen and open the branch map. Verify both existing call sites converge on one manager entry, one initial full refresh, and no duplicate refresh loop.
3. Make a local branch/commit change, then issue repeated refresh requests rapidly. Verify diagnostics show coalescing, the cache updates once per settled pass, and the foreground request is not starved by background work.
4. Untrack and relink a repository while managed mode is enabled. Verify the old runtime entry disappears, a relinked path registers once, and no late refresh updates the untracked row.
5. Temporarily point a tracked repository at a missing or invalid path. Verify cached branch/commit data remains readable, health becomes stale, retries are bounded, and repeated failures eventually reach `unreachable`.
6. Start a second application instance and close the app while managed work is active. Verify single-instance behavior remains one process and that no manager task continues after shutdown. Shutdown cleanup is currently exposed as `stop_all` but is not yet connected to a Tauri run-event callback.
7. Repeat the above with the environment unset and with `BRANCH_SCHEMATIC_DISABLE_NEW_WATCHER=1`. Verify the legacy watcher path remains the active mode and managed commands fail cleanly without a second watcher.

These checks require machine/runtime evidence and are not represented as automated passes in this report.

## Known Gaps and Discrepancies

- `daemon.rs` remains recursive and still owns live filesystem watching in legacy mode. Stage 4 owns layout-aware watch scope and trigger policy; Stage 3 intentionally does not replace it.
- The manager currently schedules full refreshes; metadata/status-specific scheduling and actual `notify` watcher registration belong to Stage 4.
- `stop_all` exists and clears runtime ownership, but the current Tauri `Builder` API in this codebase has no `.on_event` method. The application run-event integration must be added through the supported Tauri event boundary before treating shutdown acknowledgement as complete.
- A refresh task can finish work already in progress after `stop_monitored`; generation checks prevent follow-up scheduling, but a stronger cancellation token around the refresh transaction is still needed to guarantee no late cache write after untracking. This is a Stage 3 risk and should be closed before rollout.
- Retry scheduling is bounded per delay and updates persisted failure counts, but the current manager does not yet expose retry timer state or queue depth in diagnostics.
- No frontend code directly calls the new manager-specific commands yet. Existing `watch_project_directory` compatibility calls are sufficient for managed registration, while priority/detail commands are available for Stage 5/6 integration.
- No live managed-mode desktop, second-launch, shutdown, watcher overflow, or large-workspace benchmark evidence was collected.

## Stage Disposition and Handoff

**Pass with risk.** Stage 4 may begin watcher scope and trigger-matrix work behind `WatcherManager`. It must keep one manager as the owner, route all watcher callbacks into manager refresh requests, preserve the legacy default, and add cancellation acknowledgement before allowing untrack or shutdown to complete. The managed mode must remain disabled for normal users until the critical manual checks above pass.
