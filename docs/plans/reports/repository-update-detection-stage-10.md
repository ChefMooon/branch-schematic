# Repository Update Detection: Stage 10 Independent Final Evaluation

## Evaluation Scope

This is an evaluation of the implementation and Stage 0 through Stage 9 evidence against `repository-update-detection-plan.md` and `repository-update-detection-implementation-plan.md`. The B1 remediation was applied after the original read-only review; the B2 scope decision is recorded separately in [B2 verification](repository-update-detection-b2-verification.md).

Environment: Windows `win32`, `x64`, Node `v22.23.1`, 16 logical CPUs, 2026-08-05.

## 1. Blocking Discrepancies

### B1. Shutdown and diagnostics lock-order inversion: resolved

**Original severity:** Blocking. **Current status:** Resolved and compile-validated.

The original review identified that `stop_all` held `watcher_tasks` while awaiting telemetry, while diagnostics could await that mutex after taking other locks. `stop_all` now drains watcher and polling task maps inside short lock scopes, releases those locks, and only then awaits telemetry in [manager.rs](../../../src-tauri/src/manager.rs#L280-L310). The lock-order inversion identified by the review is removed.

**Owner:** Managed watcher implementation owner. Runtime concurrency execution remains unverified because the Windows Rust test binary cannot launch; retain a desktop shutdown/diagnostics check.

### B2. Required live acceptance and scale evidence: current scope accepted

**Original severity:** Blocking for broad rollout. **Current status:** Accepted for the current scope with residual runtime-evidence risk.

The Stage 9 harness measures synthetic fixture preparation and metadata probing, not Rust `WatcherManager` registration, initial verification, refresh latency, OS watcher allocations, memory, or idle CPU. Per the current scope decision, the completed 2,000-repository Windows fixture run is sufficient for this benchmark gate; the 5,000-repository soak and live desktop measurements are deferred. The decision and residual risk are recorded in [B2 verification](repository-update-detection-b2-verification.md).

**Owner:** Product/development owner for current-scope acceptance; release/QA owner for deferred desktop evidence.

## 2. Non-Blocking Discrepancies and Residual Risks

### R1. Polling fallback jitter: implementation added, runtime validation pending

The managed fallback now assigns each repository a deterministic initial offset within the 30-second polling interval in [manager.rs](../../../src-tauri/src/manager.rs). This removes synchronized first polls while preserving the existing cadence. Runtime distribution and 5,000-repository behavior remain unmeasured.

**Owner:** Managed watcher implementation owner.

### R2. Startup registration concurrency: implementation added, target validation pending

`register_active_paths` now uses an eight-permit bounded registration scheduler in [manager.rs](../../../src-tauri/src/manager.rs). The 15-second 2,000-repository target still requires a live desktop measurement; synthetic fixture preparation does not prove it.

**Owner:** Scheduler/managed watcher implementation owner; validate during the Stage 9 desktop run.

### R3. Stale-state rate: durable observation implementation added

The diagnostic now records `tracked_paths.is_cache_stale` after refresh attempts and calculates `stale_state_rate_15m` from durable observations over the 15-minute window in [manager.rs](../../../src-tauri/src/manager.rs). Refresh failure counters remain separate. Live denominator behavior and rollout captures still require validation.

**Owner:** Observability owner. Define the durable-state denominator and align the exported metric before automatic rollback is trusted.

### R4. Tauri shutdown barrier: implementation added, runtime validation pending

An app-level `RunEvent::ExitRequested` barrier now prevents process exit until `WatcherManager::stop_all` completes in [lib.rs](../../../src-tauri/src/lib.rs). The existing close callback remains responsible for hide-to-tray and window-state behavior. Process-exit and tray/platform behavior still require desktop validation.

**Owner:** Tauri lifecycle owner; validate and, if needed, add an app-level exit barrier after resolving the B1 lock-order issue.

### R5. Event batching: manager aggregation implementation added, integration validation pending

Managed refresh completions now aggregate for a short bounded window, deduplicate repository IDs, and emit through the existing 250-ID chunker in [manager.rs](../../../src-tauri/src/manager.rs). Multi-repository manager output and frontend reconciliation still need live or runtime integration coverage.

**Owner:** IPC/frontend integration owner; cover with a live or manager-level multi-ID integration test.

### R6. Runtime Rust tests remain unavailable

Rust tests compile with `--no-run`, but runtime execution remains unverified because the Windows test executable previously failed with `STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139)`. This leaves manager concurrency, database reset, layout, and refresh integration behavior without runtime evidence.

**Owner:** Environment/QA owner. Resolve the Windows test runner/toolchain issue or run the same suite in a supported CI environment; do not bypass the failure.

## 3. Validation Coverage

### Passing automated checks

- `npm test -- --run`: 30 files, 107 tests passed.
- `npm run build`: passed; existing Vite large-chunk warning remains.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`: passed; existing Rust warnings remain.
- `git diff --check`: passed; existing line-ending warnings remain.
- Stage 9 fixture harness: 2,000 conventional fixtures generated on Windows; fixture preparation `5,750.21 ms`, metadata probe `356.90 ms`; live manager target explicitly unevaluated.
- Stage 9 rollout evaluator: below-threshold and rollback-threshold decisions both exercised successfully.

### Missing or unverified evidence

- Fresh database reset, migration defaults, malformed/newer-schema recovery, and restart idempotence.
- Single-instance process/window ownership under second launch.
- Missing/moved/path-reuse and all supported repository layout acceptance fixtures.
- Watcher overflow, task termination, wake/focus recovery, shutdown completion, and fallback polling behavior in a running Tauri build.
- Foreground/visible/background/detail-active latency targets and dashboard interactivity timing.
- 2,000-repository live registration/verification and 5,000-repository responsiveness/soak workload.
- Memory and idle CPU with the documented watcher allocation exclusions.
- Live remote unavailability/backoff and local-only diagnostics redaction checks.
- Runtime Rust tests due to the documented Windows loader failure.

## 4. Stage-by-Stage Disposition

| Stage | Disposition | Evaluation |
| --- | --- | --- |
| 0: Contract freeze and baseline | pass with risk | Decisions and baseline report exist; live database version and several platform checks remain unverified. |
| 1: Schema, recovery, and single instance | pass with risk | Schema/startup code and report exist; reset/recovery and second-launch evidence remain unverified. |
| 2: Refresh core, layout, identity, and health | pass with risk | Core implementation and tests exist; Windows identity/layout edge cases lack runtime evidence. |
| 3: Manager and scheduler ownership | pass with risk | Central ownership and coalescing exist; lifecycle/runtime shutdown evidence is incomplete. |
| 4: Watcher scope and trigger policy | pass with risk | Layout-aware scope exists; overflow/task termination/live watcher checks remain unverified. |
| 5: IPC invalidation and frontend synchronization | pass with risk | Frontend suite passes; live event/reconciliation evidence remains absent. |
| 6: Cache-first UI and detail-active | pass with risk | Frontend suite/build pass; desktop interaction and persistence checks remain unverified. |
| 7: Wake recovery and scale fallback | pass with risk | B1 is resolved; polling jitter, bounded startup concurrency, and live scale checks remain residual risks. |
| 8: Git execution, remote separation, observability | pass with risk | Local/remote boundary and aggregate diagnostics exist; stale metric semantics and live redaction/remote checks remain. |
| 9: Load validation and rollout | pass with risk | The 2,000-repository fixture gate is accepted for current scope; live manager/resource evidence is deferred. |
| 10: Independent final evaluation | pass with risk | B1 is remediated; B2 is accepted for current scope with documented residual runtime risk. |

## 5. Release Recommendation

**Keep the managed watcher path behind the feature flag. The current 2,000-repository benchmark scope is accepted, but broad unconditional rollout is not recommended until the deferred desktop evidence is collected.**

Before the next rollout gate:

1. Add and run a concurrency regression test for shutdown versus diagnostics when the Windows Rust test environment is available.
2. Capture live Tauri evidence for the deferred registration, verification, latency, resource, wake, shutdown, recovery, and rollback checks.
3. Resolve the stale-state metric semantics and validate the rollout evaluator against real workspace diagnostics.
4. Reassess R1, R2, R4, and R5 if the deferred 5,000-repository workload is later enabled.

The legacy flag-off path should remain the rollback path. No final cleanup of the legacy watcher, fallback, or stale branch-map polling is authorized until the release/QA owner signs off on the deferred evidence.
