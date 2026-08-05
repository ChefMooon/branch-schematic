# B2 Scale Verification Record

## Scope

This document separately records the current B2 scale decision requested after the Stage 10 review. For the current rollout scope, the completed 2,000-repository Windows fixture run is sufficient evidence for the benchmark harness and no 5,000-repository run is required at this time.

This is a scope decision, not a claim that synthetic fixture preparation equals live Tauri watcher registration.

## Accepted Evidence

| Field | Result |
| --- | --- |
| Machine | Windows `win32`, `x64`, Node `v22.23.1`, 16 logical CPUs |
| Workload | 2,000 conventional repository fixtures |
| Fixture preparation | `5,750.21 ms` |
| Metadata probe | `356.90 ms` |
| Artifact | `.tmp/stage-9-benchmark-2000.json` |
| 5,000-repository soak | Deferred by current scope decision |

The harness records live manager registration, initial verification, refresh latency, OS watcher allocations, memory, and CPU as unmeasured. Those exclusions are intentional and remain visible in the artifact.

## Verification Result

**B2 is accepted for the current scope with a residual runtime-evidence risk.** The 2,000-repository fixture test is enough for the present benchmark gate. The 5,000-repository soak and live Tauri manager measurements are deferred rather than treated as passed.

The managed watcher path remains feature-flagged and the legacy path remains available for rollback. No final cleanup or unconditional rollout is implied by this record.

## Deferred Checks

- Live `WatcherManager` registration and initial verification timing for 2,000 repositories.
- Foreground, visible, background, and detail-active refresh latency.
- Steady-state memory, idle CPU, and OS-managed watcher allocation measurements.
- 5,000-repository responsiveness/soak workload.
- Database recovery, second-launch, wake recovery, shutdown, and rollback preservation checks.

## Ownership

- Current-scope acceptance: product/development owner.
- Deferred desktop and resource measurements: release/QA owner.
- Managed-path performance risks and any future 5,000-repository run: watcher/scheduler implementation owner.

## Related Evidence

- [Stage 9 evidence](repository-update-detection-stage-9.md)
- [Stage 10 independent evaluation](repository-update-detection-stage-10.md)
