# Repository Update Detection Stage 0 Report

## Decision Record

- **Stage:** 0, Contract Freeze and Baseline
- **Date:** 2026-08-05
- **Source revision:** `6d6e350ef2b34d22223ace1528bc42abcffef995` (`chore: update docs, plan repository update detection`)
- **Machine:** Windows 11 Home, PowerShell on `C:\Users\justi\Documents\Git\general-dev\branch-schematic\branch-schematic`
- **Worktree at inspection:** clean; branch `main` is one commit ahead of `origin/main`.

### Migration and Reset Policy

Migration 2 is the approved reset-era target for the repository-update detection schema. This repository is in alpha development, and existing development databases are not treated as a compatibility target for the new health, pin, and detail-interval fields. Stage 1 must preserve migration 3 for the commit-to-branch mapping table and apply the approved migration-2 changes only through the documented database reset/re-import workflow. Stage 1 must not silently rewrite an already-applied database or add a compatibility `ALTER TABLE` fallback.

Existing databases observed on this machine:

- Debug: `%APPDATA%\com.justi.branch-schematic\branch-schematic-dev.db` exists.
- Release: `%APPDATA%\com.justi.branch-schematic\branch-schematic.db` exists.

The current source defines migrations 1, 2, and 3; migration 3 is the highest defined version. The observed databases were not opened or modified during Stage 0. Stage 1 owns backup, reset, migration, restart, and recovery verification.

### Moved-Repository Identity Policy

Use the conservative policy from the implementation plan. Repository identity is based on normalized absolute path, with remote metadata used only as corroboration. A missing path means `missing`; `moved` requires explicit relink evidence or a verified Git-directory identity match. A path reused by an independent clone must not reattach the old row, and a shared remote URL must never prove identity.

### Feature Flag and Rollout Policy

- The new watcher path is disabled by default.
- The flag is evaluated once at application startup and is process/workspace scoped.
- The source is a documented local configuration value, with a deterministic local emergency-disable override taking precedence; no network service is required for evaluation.
- Flag-off behavior remains the current legacy watcher path until rollout gates pass.
- Flag-on behavior is manager-owned and must not register a second watcher for the same repository.
- Rollout ownership is the application maintainer/release owner. Enablement proceeds only through the staged internal, beta, 10%, 50%, and 100% gates defined in the implementation plan. Rollback disables the new path for the affected workspace at the documented restart or synchronized manager transition boundary while preserving cache and health rows.
- The active mode and flag state must be exposed through diagnostics once the manager exists.

### Frozen Defaults and Bounds

- Detail-active status interval: default 5 seconds, clamped to 2 through 5 seconds.
- Event batch size: maximum 250 repository IDs.
- Unreachable threshold: 8 consecutive applicable failures.
- Retry cap: 15 minutes.
- Feature flag default: disabled.
- `.git/objects/**`: no recursive live watch; object-only activity is a verification hint.
- `workspace-updated`: version 1, post-cache-commit, idempotent invalidation event.

These decisions adopt the resolved sections of the original design and supersede earlier conflicting recommendations, especially the earlier suggestion to recursively watch the object store.

## Baseline Results

### Commands and Results

Environment: Windows 11 Home; Node `v22.23.1`; npm `10.9.8`; Rust `rustc 1.94.1 (e408947bf 2026-03-25)`; Cargo `1.94.1 (29ea6fb6a 2026-03-24)`; Git `2.47.1.windows.1`.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | Passed: 29 test files, 105 tests | Vitest completed in 23.69s. Existing stderr included React `act(...)` warnings and expected Tauri invoke fallback logging; no test failures. |
| `npm run build` | Passed | TypeScript and Vite build completed in 8.13s. Existing warnings included a large chunk warning. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 28 library tests, 0 binary tests, 0 doc tests failed | Rust test profile completed successfully. Existing warnings include unused functions/constants and one useless comparison. |
| `git status --short` | Passed | No changes were present before this report edit. |
| Migration inspection | Passed at source level; live database version unverified | `src-tauri/src/db.rs` defines versions 1, 2, and 3; version 3 is highest. The direct `PRAGMA user_version` check could not run because the `sqlite3` CLI is unavailable on this machine. |

No Stage 0 production source, migration, generated schema, or configuration file was changed. The only change is this evidence report and its parent `reports/` directory.

## Current Refresh Ownership Map

- **Watcher implementation:** `src-tauri/src/daemon.rs` owns `IndexerDaemon`, creates a recursive `notify` watcher, debounces for approximately 600 ms, and runs the index pass.
- **Rust command boundary:** `src-tauri/src/lib.rs` exposes `watch_project_directory`; each invocation constructs a new `IndexerDaemon` and starts a watcher.
- **Branch-map startup:** `src/features/branch-map/BranchMap.tsx` enumerates active paths and invokes `watch_project_directory` when the view initializes.
- **Branch-map polling:** `BranchMap.tsx` independently calls `hydrateWorkspaceNodes` every 4 seconds while a view is active.
- **Database management onboarding:** `src/routes/database.tsx` inserts a tracked path and invokes `watch_project_directory` directly.
- **Database/runtime setup:** `src-tauri/src/lib.rs` prepares the database file, creates the SQLx pool during `setup`, reads runtime settings, and registers the Tauri SQL migration plugin. A single schema-readiness barrier is not yet established; Stage 1 owns that change.
- **Compatibility schema mutation:** `src-tauri/src/db.rs` contains `ensure_tracked_paths_theme_columns`, which conditionally issues `ALTER TABLE` statements. Stage 1 must remove or quarantine this path under the approved fail-fast schema policy.

This confirms the implementation plan's stated competing refresh paths and establishes the ownership surfaces for Stage 1 onward.

## Fixture Specification

The following repeatable fixtures are required for later stages. Stage 0 specifies them but does not build the load harness.

### Repository Layouts

- Conventional repository with a normal `.git` directory, branches, HEAD changes, packed refs, index creation, and working-tree edits.
- Gitfile worktree where `.git` is a file pointing at administrative metadata.
- Linked worktree with `commondir` and per-worktree administrative files.
- Submodule with its own worktree and resolved Git metadata.
- Bare repository with no working tree.
- Repository with missing or malformed Git metadata.
- Large object store to verify no recursive `.git/objects/**` watch is registered.

### Path and Identity Cases

- `refs`, `index`, and `packed-refs` absent at registration and created later.
- Symlinked and case-variant Windows paths that normalize to the same identity.
- Path reuse by an independent clone, including a shared remote URL.
- Explicit relink of a moved repository.
- Missing, non-Git, invalid, and inaccessible paths.

### Reliability and Security Cases

- Watcher callback/channel overflow and watcher task termination.
- SQLite lock contention during a cache write.
- External Git-client activity from CLI or another desktop client.
- Git output containing a sensitive path, username, remote URL, token-like value, or arbitrary stderr to verify diagnostic sanitization.

### Scale Cases

- 2,000 tracked repositories for registration and initial-verification timing.
- 5,000 tracked repositories for responsiveness and soak behavior.
- Measurements must report watcher allocations separately from application memory, and watcher count and polling count separately from refresh throughput.

## Validation Coverage and Gaps

- **Completed:** frontend tests, frontend production build, Rust tests, source migration-version inspection, database-path derivation, current watcher ownership inspection, and clean-worktree check.
- **Unverified and intentionally deferred to Stage 1:** deleting/resetting the existing development database, migration application and default-column inspection, restart/idempotence, malformed/newer-schema recovery, single-instance behavior, and startup readiness ordering.
- **Unverified in Stage 0:** the existing database's live `PRAGMA user_version`; the available `sqlite3` CLI check exited with code 2 because the CLI is not installed. Stage 1 must verify the live version through its database validation tooling before migration work proceeds.
- **Unverified and deferred to later stages:** moved/relink behavior, layout fixtures, watcher overflow, refresh atomicity, IPC revisions and batching, wake recovery, scale benchmarks, and staged rollout/rollback.

The Stage 0 handoff gate is satisfied: migration numbering, moved-identity policy, feature-flag policy, baseline results, and fixture requirements are recorded. No implementation stage should read or write the new health, pin, or detail-interval fields until Stage 1 establishes schema readiness and completes reset/recovery validation.
