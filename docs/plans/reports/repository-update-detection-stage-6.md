# Repository Update Detection: Stage 6 Evidence

## Scope

Stage 6 adds cache-first repository state mapping, managed detail promotion, pin persistence, health presentation, and detail-active working-tree status reconciliation. Stage 5 remains the source for shared `workspace-updated` invalidation behavior.

## Implemented

- Workspace hydration now maps durable pin and repository-health fields from `tracked_paths` without treating health as transient watcher state.
- Added the typed `set_repository_pinned` command and workspace-store mutation.
- Added repository-card pin/unpin action and durable health warning presentation.
- Opening repository details ensures monitoring, enters `detail-active`, requests a foreground refresh, and leaves the tier on close or repository switch.
- Detail changes status remains cache-first, records a view-local verification timestamp, coalesces overlapping status requests, rejects stale repository generations, and starts the clamped 2-to-5 second safety poll after initial content has rendered.
- Detail status failures preserve the last successful snapshot and expose the error state.
- Added the General settings slider using the typed detail interval commands, with frontend clamping and reset handling.
- Made detail command adapters tolerant of legacy/test implementations that return `undefined` rather than a Promise.

## Validation

| Check | Result |
| --- | --- |
| Focused Stage 6 and Stage 5 frontend tests | Pass: 20 tests across 5 files |
| Focused detail body tests | Pass: 6 tests |
| Full frontend suite (`npm test -- --run`) | Pass: 30 files, 107 tests |
| Frontend production build (`npm run build`) | Pass; existing Vite large-chunk warning remains |
| Workspace/editor diagnostics | No new frontend errors; existing Rust dead-code and warning diagnostics remain |
| Rust formatting (`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`) | Pass |
| Rust test compilation (`cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`) | Pass; existing warnings only |
| Rust test execution | Not forced. Stage 5 records Windows `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) when launching the test executable |

## Known Test Warnings

The frontend suite still reports existing React `act(...)` warnings in detail-related tests. They do not fail the suite. The Vite build reports the existing large-chunk warning.

## Manual Validation Required

The following checks remain unverified and should be completed on a running Tauri desktop build:

1. Open the dashboard with cached repositories while managed watcher registration is delayed; verify cached cards render before registration completes and then update incrementally.
2. Open a repository detail view, verify one immediate targeted status request, one foreground refresh promotion, detail-active registration, and cleanup on close, repository switch, and navigation away.
3. Edit, stage, commit, and externally modify files while the detail view is open; verify status updates at the configured 2-to-5 second interval and that late responses cannot update a different repository.
4. Change the General detail interval to 2, 3, 4, and 5 seconds, restart the app, and verify persistence and backend clamping for out-of-range stored values.
5. Pin and unpin a repository, restart the app, and verify the pin survives restart and only affects the bounded startup boost.
6. Exercise healthy, monitoring failure, unreachable, missing, and moved repository states; verify card warnings, stale cache preservation, aggregate health behavior, and Retry/selection/detail recovery.
7. Confirm managed mode does not also start the legacy `BranchMap` watcher or four-second polling path; confirm flag-off behavior remains unchanged.
8. Run the existing Windows second-launch, database reset/recovery, and managed-mode local Git change checks from the Stage 5 handoff.

## Handoff Status

Frontend and compile-time validation are complete. Desktop runtime validation and the Rust test executable remain outstanding because of the documented Windows runner failure; no attempt was made to force or bypass that failure.
