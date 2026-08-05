# Repository Update Detection: Stage 8 Evidence

## Decision Record

Stage 8 keeps local repository refreshes independent from remote operations. The managed refresh path continues to use local `git2` discovery and cache reconciliation; GitHub/API, clone, fetch, and push code remains in the explicit remote-operation surface in `src-tauri/src/git.rs`. No remote operation is introduced into filesystem-triggered or scheduled local refreshes.

Telemetry is aggregate and local by default. Diagnostics do not include repository paths, display names, remote URLs, credentials, command arguments, or arbitrary Git output.

## Implemented

- Added aggregate refresh attempts, successes, failures, and total refresh duration metrics.
- Added watcher registration attempts/failures, watcher starts/stops, and emitted event-batch counters.
- Added rolling 15-minute refresh-failure/stale-state rate and rolling 10-minute watcher-registration-failure rate.
- Exposed the metrics through the existing `get_watcher_manager_diagnostics` command and `ManagerDiagnostics` payload.
- Preserved bounded retry and cache-preserving failure behavior from earlier stages.
- Added focused coverage that exercises aggregate rates and verifies the diagnostics shape contains only aggregate values.
- Kept wake recovery and degraded polling metrics from Stage 7 in the same diagnostics contract.

## Validation

| Check | Result |
| --- | --- |
| Rust formatting (`cargo fmt --manifest-path src-tauri/Cargo.toml`) | Pass |
| Rust test compilation (`cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`) | Pass; existing warnings only |
| Editor diagnostics for touched Rust files | Pending final post-edit check |
| Runtime Rust tests | Unverified and not forced because Windows test executable launch previously failed with `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) |
| Remote/local separation acceptance test | Unverified in a live remote environment; implementation inspection confirms local refresh calls `scan_local_repository`/`git2` and does not invoke fetch/push APIs |
| 2,000/5,000 repository process and latency comparison | Unverified; owned by Stage 9 load validation |

## Known Gaps

- The rolling rates use refresh failures as the stale-state proxy and registration attempts as the registration denominator. Stage 9 must validate the interpretation against the rollout thresholds with real workspace samples.
- No raw Git error is persisted or exported through manager diagnostics. Detailed user-facing errors remain in the existing explicit operation paths and are outside this aggregate diagnostics contract.
- Live remote-unavailability backoff and process-count comparison still require desktop fixtures and belong in the Stage 9 benchmark/acceptance pass.

## Manual Validation Required

1. Trigger local file, branch, and packed-ref changes while managed mode is active; confirm local refreshes do not initiate network activity.
2. Simulate an unavailable remote during an explicit remote operation and verify local cache remains available while the remote operation follows bounded retry/backoff behavior.
3. Inspect diagnostics after successful refreshes, failed refreshes, watcher registration failure, wake recovery, and event batching; verify only aggregate counters and rates are exposed.
4. Exercise diagnostics with repository paths, remote URLs, usernames, access tokens, and Git stderr containing sensitive-looking text; confirm none appears in the diagnostics response or logs.
5. Capture representative Git process counts and refresh latency before/after the optimized managed path for Stage 9.

## Handoff Status

Stage 8 production observability and local/remote execution separation are implemented and compile-validated. Runtime Rust tests, live remote failure behavior, redaction inspection, and scale measurements remain unverified because they require desktop/runtime fixtures; the known Windows Rust test launcher failure was not bypassed.
