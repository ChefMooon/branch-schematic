# Repository Update Detection: Stage 7 Evidence

## Scope

Stage 7 adds manager-owned lifecycle recovery for managed watchers, explicit watcher and degraded polling diagnostics, and shutdown cancellation for recovery work.

## Implemented

- Added `WatcherManager::recover_after_wake`, gated to managed mode and disabled after shutdown.
- Wired main-window focus regain to wake recovery so returning from sleep, minimize-to-tray, or background usage re-registers active watchers and requests background verification.
- Wake recovery replaces existing watcher tasks before re-registration, preventing duplicate watcher ownership.
- Watcher registration now reports failure and creates one bounded 30-second polling fallback task for the affected repository.
- Polling fallback tasks are cancelled when a repository is stopped or the manager shuts down.
- Extended manager diagnostics with watcher count, polling count, degraded-entry count, and wake-recovery count.
- Window close handling now requests manager shutdown cleanup when the application is actually closing; hide-to-tray continues to preserve the running manager.

## Validation

| Check | Result |
| --- | --- |
| Rust formatting (`cargo fmt --manifest-path src-tauri/Cargo.toml`) | Pass |
| Rust test compilation (`cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`) | Pass; existing warnings only |
| Workspace/editor diagnostics for touched Rust files | Pass; no errors reported |
| Rust test execution | Not forced. Existing Windows `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) prevents reliable test executable launch |

## Known Limitations

- The polling fallback is intentionally per degraded repository and runs at a conservative 30-second interval; it is not a substitute for filesystem events when registration succeeds.
- Focus regain is the available portable Tauri window lifecycle signal in the current application. A separate OS-level resume callback was not present in the existing run path.
- Recovery registration is sequential. The manager avoids unbounded task creation, but a future scale pass should measure startup and wake recovery with thousands of repositories.
- Existing Rust dead-code and unused-comparison warnings remain unrelated to Stage 7.

## Manual Validation Required

1. Run managed mode with a local repository, minimize or hide the app, edit files externally, restore/focus the window, and verify watcher recovery plus one background verification update.
2. Force watcher registration failure with an unavailable or unsupported repository path and inspect manager diagnostics for one polling fallback entry.
3. Verify fallback polling stops when monitoring is stopped and when the application exits rather than continuing after shutdown.
4. Exercise repeated focus regain and confirm watcher count does not grow beyond active repository count and no duplicate updates appear.
5. Measure startup and wake recovery with a representative large workspace, including the intended 2,000-to-5,000 repository scale target.

## Handoff Status

The Stage 7 resilience slice is implemented and compile-validated. Desktop lifecycle, degraded fallback, shutdown, and scale measurements remain manual checks. Rust runtime tests remain unrun because the known Windows test-binary launch failure was not bypassed.
