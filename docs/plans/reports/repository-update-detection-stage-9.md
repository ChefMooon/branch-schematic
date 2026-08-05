# Repository Update Detection: Stage 9 Evidence

## Decision Record

Stage 9 keeps the managed watcher rollout restart-boundary based. The existing startup flag remains the mode contract: `BRANCH_SCHEMATIC_WATCHER_MODE=managed` enables managed mode, while `BRANCH_SCHEMATIC_DISABLE_NEW_WATCHER=1` (or `true`/`yes`) forces legacy mode. Rollback therefore does not create a dual watcher process or mutate cache rows; it changes the startup configuration and restarts the affected application.

Live Tauri registration, verification, latency, memory, CPU, and OS watcher allocation measurements are not fabricated by the Node harness. The harness explicitly records those fields as unmeasured until a desktop diagnostics capture is supplied.

## Implemented

- Added `npm run bench:repo-updates` through `scripts/benchmark-repository-update.js`.
- Added repeatable conventional-repository fixture generation with repository count, repository mix, machine metadata, fixture preparation time, metadata probe time, and measurement exclusions.
- Added a 2,000-repository Windows fixture run artifact at `.tmp/stage-9-benchmark-2000.json`.
- Added `npm run rollout:check` through `scripts/evaluate-rollout.js`.
- Added deterministic rollback evaluation for the Stage 9 thresholds: stale-state rate over 0.5 percent in 15 minutes or registration-failure rate over 2 percent in 10 minutes.
- Added support for both camelCase diagnostics payloads and snake_case report fixtures.
- Documented rollout, rollback, benchmark boundaries, and diagnostics capture requirements in `docs/Repository-Update-Detection.md`.
- Preserved the legacy path and the Stage 7 fallback while the managed path remains under evaluation.

## Fixture and Benchmark Data

| Field | Result |
| --- | --- |
| Machine | Windows `win32`, `x64`, Node `v22.23.1`, 16 logical CPUs |
| Workload | 2,000 conventional fixture repositories |
| Fixture preparation | 5,750.21 ms |
| Metadata probe | 356.90 ms |
| Metadata bytes probed | 42,000 |
| Live manager registration target | Unverified; harness does not claim fixture timing is app timing |
| 5,000-repository soak | Unverified; requires live Tauri workload |

The artifact records that OS-managed watcher allocations, live manager registration, initial verification, refresh latency, steady-state memory, and idle CPU are excluded from this fixture-only result.

## Validation

| Check | Result |
| --- | --- |
| Fixture harness, 10 repositories | Pass; generated and cleaned repeatable fixture metadata |
| Fixture harness, 2,000 repositories | Pass; Windows result archived at `.tmp/stage-9-benchmark-2000.json` |
| Rollout evaluator below thresholds | Pass; returned `rollback: false` |
| Rollout evaluator above stale-state threshold | Pass; returned `rollback: true` and `stale_state_rate_exceeded` |
| Frontend test suite (`npm test -- --run`) | Pass: 30 files, 107 tests |
| Frontend production build (`npm run build`) | Pass; existing Vite large-chunk warning remains |
| Rust runtime test suite | Unverified and not forced because Windows test executable launch previously failed with `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) |
| Rust compile-only test build | Not rerun for this documentation/tooling-only stage; previous Stage 8 compile passed |
| Desktop acceptance suite | Unverified; requires running Tauri application |

## Rollout Gates

The evaluator continues the current cohort when both rates are at or below their limits. When either threshold is exceeded, the prescribed action is to disable managed mode at the restart boundary, preserve cache and health rows, and retain the legacy watcher path.

The intended rollout order remains internal testing, beta cohort, 10 percent, 50 percent, and 100 percent. No cohort is marked passed by this report because live workspace metrics have not been captured.

## Known Gaps

- The fixture harness does not instantiate the Rust `WatcherManager`; live 2,000-repository registration and 5,000-repository soak measurements remain Stage 9 desktop checks.
- Foreground, visible, background, detail-active, dashboard interactivity, process ownership, memory, and idle CPU targets remain unverified.
- Database reset/recovery, second-launch activation, supported-layout, wake recovery, external-Git-client, remote failure/backoff, and rollback preservation checks remain unverified in a live desktop build.
- Existing React `act(...)` warnings and the Vite large-chunk warning remain non-failing.

## Handoff Status

Stage 9 implementation tooling, rollout threshold evaluation, and documentation are complete. The project is not declared fully rollout-approved: live desktop acceptance and scale evidence remain required, and Stage 10 must perform the independent final evaluation and discrepancy report.
