# Repository Update Detection Stage 4 Report

## Decision Record

- **Stage:** 4, Watch Scope, Trigger Matrix, and Debounce
- **Date:** 2026-08-05
- **Machine:** Windows 11 Home
- **Decision:** Add layout-aware watch-scope and trigger-classification primitives, and make the managed `WatcherManager` the sole owner of managed `notify` watcher tasks. Preserve the recursive `IndexerDaemon` path for legacy mode.
- **Disposition:** Pass with risk. Automated layout, manager, Rust, frontend, build, formatting, and diff checks pass. Live managed-mode filesystem integration, overflow injection, and desktop lifecycle checks remain unverified.

Preceding evidence: [Stage 3 report](repository-update-detection-stage-3.md).

## Implemented Contract

- Managed monitoring resolves repository layout before watcher registration.
- Watch targets cover logical `HEAD`, `refs`, `packed-refs`, and `index` paths.
- Missing logical files or ref directories fall back to their stable metadata parent, allowing first creation to be observed.
- Ref directories are recursive; metadata files and fallback metadata parents are non-recursive.
- The working-tree root is watched recursively only when `detail_active` is enabled.
- Git object stores are never registered as recursive watch targets.
- Lock-file events are ignored.
- Trigger classification is path-component based:
  - `HEAD` -> metadata
  - local refs -> full refresh
  - remote refs -> metadata
  - packed refs -> full refresh
  - index and worktree changes while detail-active -> status
  - object-store activity -> verification hint
  - unknown metadata -> conservative full refresh
  - index/worktree changes outside detail-active -> ignored
- Managed callbacks use a bounded synchronous channel. Callback send failure, watcher errors, and registration failures set a degraded/force-flush signal instead of being silently discarded.
- Managed events use a trailing debounce of 200 ms and a one-second force-flush cap before requesting a refresh.
- A repository receives at most one managed watcher task. Stopping a repository or stopping the manager aborts that task.
- Managed event handling currently routes all accepted hints through the existing authoritative full-refresh scheduler. Targeted metadata/status refresh execution remains a later integration step because the refresh engine currently exposes only the full operation.
- Legacy mode remains unchanged and continues to construct `IndexerDaemon` through the existing command boundary.

## Changed Files

- `src-tauri/src/layout.rs`: added `WatchTarget`, `WatchTrigger`, layout-derived watch targets, trigger classification, and regression tests.
- `src-tauri/src/manager.rs`: added managed `notify` watcher task ownership, bounded callback delivery, overflow/error fallback, debounce, and watcher cleanup on stop/shutdown.
- `docs/plans/reports/repository-update-detection-stage-4.md`: this report.

The worktree also contains unrelated pre-existing modifications in other files; they were not reverted or folded into this stage.

## Validation Results

Environment: Windows 11 Home; Node `v22.23.1`; npm `10.9.8`; Rust `rustc 1.94.1 (e408947bf 2026-03-25)`; Cargo `1.94.1 (29ea6fb6a 2026-03-24)`.

| Command | Result |
| --- | --- |
| `cargo test --manifest-path src-tauri/Cargo.toml layout::tests` | Passed: 4 tests. |
| `cargo test --manifest-path src-tauri/Cargo.toml manager::tests` | Passed: 3 tests. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 44 tests; 0 failed. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Passed after applying rustfmt. |
| `npm test` | Passed: 29 test files, 105 tests. Existing React `act(...)` warnings remain. |
| `npm run build` | Passed. Existing Vite large-chunk warning remains. |
| `git diff --check` | Passed; existing Windows line-ending warnings were reported. |

An initial combined Cargo filter (`layout::tests manager::tests`) was rejected by Cargo before compilation because Cargo accepts one test filter per invocation. The two focused commands were then run separately and passed.

## Automated Evidence

- `classifies_watch_triggers_and_ignores_lock_files` verifies HEAD, local refs, object-store hints, detail-active index handling, and lock-file suppression.
- `watch_scopes_exclude_object_store_and_worktree_without_detail_priority` verifies object stores are not recursively watched and working-tree monitoring is detail-only.
- Existing manager tests continue to verify managed-mode opt-in, idempotent registration/coalescing, and stop cleanup.
- Full Rust and frontend suites pass with no Stage 4 test failures.

## Manual Checks

The following checks are **unverified** and require live machine/runtime evidence:

1. Set `BRANCH_SCHEMATIC_WATCHER_MODE=managed`, launch the desktop app, and verify diagnostics show managed mode with one watcher task per active repository and no legacy daemon watcher.
2. Create the first branch in a repository with no initial `refs` directory and create an initial `index`; verify the stable-parent fallback observes both creations.
3. Exercise local branch creation, checkout, packed-ref creation, remote-ref updates, worktree edits, and object-only activity with an external Git client; verify the expected refresh hints and no object-store recursive watch.
4. Generate a rapid event burst and verify one trailing-edge refresh plus the one-second force flush rather than an unbounded event loop.
5. Simulate callback-channel overflow, watcher registration failure, and watcher error delivery; verify diagnostics/health expose degraded behavior and a verification/full-refresh fallback.
6. Verify conventional repositories, gitfile worktrees, linked worktrees, submodules, bare repositories, symlink/case-variant paths, and missing-path recovery under managed mode.
7. Stop, untrack, relink, close the window, and exit while watcher activity is present; verify no late refresh is emitted after ownership is removed and shutdown cleanup completes.

These checks are not claimed as passed because no live managed-mode desktop or overflow harness was run in this stage.

## Known Gaps and Discrepancies

- The manager currently requests the existing full refresh for all classified hints. The trigger enum records the resolved matrix, but metadata/status-specific Git work is not yet wired to separate refresh operations.
- Watch-task failures and callback overflow are converted into an immediate refresh fallback, but manager diagnostics do not yet expose watcher count, polling count, or a durable degraded reason. Stage 7 owns those scale diagnostics.
- The watcher task is abortable, but cancellation acknowledgement around an already-running refresh transaction remains a Stage 3 risk. `stop_monitored` prevents subsequent work and aborts the watcher task; it does not yet await an explicit refresh cancellation barrier.
- The current watcher task does not automatically re-register after OS sleep/wake or task termination. Wake recovery and polling fallback belong to Stage 7.
- The default feature flag remains legacy. Managed mode must remain disabled for normal users until the manual checks above and the Stage 3 shutdown checks pass.

## Stage Disposition and Handoff

**Pass with risk.** Stage 5 may build IPC invalidation on top of manager-owned committed refresh requests. Stage 5 should preserve the trigger metadata, add post-commit event ordering, and avoid adding a second watcher or polling owner. Before rollout, close the live integration, overflow, and cancellation-acknowledgement gaps listed above.
