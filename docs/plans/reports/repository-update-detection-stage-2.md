# Repository Update Detection Stage 2 Report

## Decision Record

- **Stage:** 2, Refresh Core, Layout Resolution, Identity, and Health
- **Date:** 2026-08-05
- **Machine:** Windows 11 Home
- **Decision:** Add deterministic layout, path classification, health/retry, and transactional refresh primitives behind a typed Rust command boundary. Preserve the legacy watcher and daemon ownership until Stage 3.
- **Handoff disposition:** Pass with risk. The refresh core is executable and tested, but lifecycle ownership, watcher routing, and platform acceptance remain Stage 3+ work.

## Changed Files

- `src-tauri/src/layout.rs`: added canonical path normalization, repository layout resolution for conventional, gitfile, linked-worktree, submodule, and bare classifications, path-state classification, and logical metadata path categories.
- `src-tauri/src/health.rs`: added constrained health states, eight-failure unreachable threshold, bounded retry delay, sanitized verification errors, and transition helpers.
- `src-tauri/src/refresh.rs`: added the reusable full-refresh engine, serialized repository cache writer with bounded SQLite busy retries, authoritative branch reconciliation, shared-commit-safe mapping cleanup, and stale-cache-preserving failure handling.
- `src-tauri/src/lib.rs`: registered the Stage 2 modules, managed one cache writer after schema readiness, and exposed `refresh_repository_full_command`.
- `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`: added temporary-fixture test support through `tempfile`.
- `docs/CODEBASE_MAP.md`: regenerated.
- `docs/plans/reports/repository-update-detection-stage-2.md`: this report.

## Implemented Contracts

- Full refreshes are authoritative for a repository branch snapshot.
- Absent branches are removed transactionally.
- Branch-to-commit mappings are removed before branch rows.
- Shared commits remain when a surviving mapping exists.
- Legacy `cached_git_commits.branch_id` references are reassigned to a surviving mapped branch before deleting a removed branch.
- Failed or missing Git verification does not delete cached branch data; it marks the repository stale and persists a sanitized health state/error.
- Health states implemented: `unverified`, `monitoring`, `monitoring_failed`, `healthy`, `unreachable`, `missing`, and `moved`.
- Verification failure reaches `unreachable` at eight consecutive applicable failures.
- Retry delay is exponential with caller-supplied jitter and a 15-minute cap.
- Repository paths are canonicalized before layout resolution and identity use.
- Logical path classification uses path components and resolved metadata/worktree roots; `.git/objects` is represented as a verification hint category rather than a watcher policy.
- The cache writer serializes refresh transactions through one managed `tokio::Mutex` and retries SQLite busy/locked failures with bounded delays.
- The refresh command is available only with schema-ready `DbState` and the shared writer state.

## Validation Results

Environment: Windows 11 Home; Node `v22.23.1`; npm `10.9.8`; Rust `rustc 1.94.1 (e408947bf 2026-03-25)`; Cargo `1.94.1 (29ea6fb6a 2026-03-24)`.

| Command | Result | Evidence |
| --- | --- | --- |
| `cargo test --manifest-path src-tauri/Cargo.toml refresh::tests` | Passed: 3 tests | Writer serialization, authoritative absent-branch deletion/shared-commit retention, and missing-repository stale-cache preservation. |
| `cargo test --manifest-path src-tauri/Cargo.toml layout::tests` | Passed: 2 tests | Component-based metadata classification and missing/non-Git path classification. |
| `cargo test --manifest-path src-tauri/Cargo.toml health::tests` | Passed: 4 tests | Health threshold, success reset, sanitization bounds, and retry cap. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed | Tauri command boundary and `Send`-safe owned Git snapshot handoff compiled. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 39 tests; 0 failed | Complete Rust library, binary, and doc-test targets. |
| `npm test` | Passed: 29 files, 105 tests | Existing React `act(...)` stderr warnings remain, with no failures. |
| `npm run build` | Passed | TypeScript and Vite production build completed; existing large-chunk warning remains. |
| `npm run docs:code` | Passed | Codebase map regenerated with Stage 2 modules. |
| `git diff --check` | Passed | No whitespace errors. |

Existing warnings remain in unrelated or intentionally not-yet-routed code, including dead legacy helpers, a pre-existing Git comparison warning, and Stage 2 helpers reserved for later manager integration. No warning was promoted to a failure.

## Manual and Platform-Specific Checks

These checks remain **unverified** and are handed to the user/reviewer or later stages:

- Conventional, gitfile, linked-worktree, submodule, and bare repository fixtures were not all exercised through live Git directories on Windows. The resolver is unit-tested at the path-category level, but layout-specific filesystem acceptance remains open.
- Symlink, junction, Windows case-variant, long-path, and path-reuse identity behavior remains unverified.
- Explicit moved/relink evidence is not yet connected to a persisted repository lifecycle command; Stage 3 owns relink and manager lifecycle routing.
- SQLite lock contention with a live competing writer was not manually injected. The writer retry policy is implemented, but the automated test covers serialization rather than OS-level lock contention.
- The legacy `daemon.rs` still owns its existing direct indexing path. Stage 3 must route watcher-triggered work through this refresh engine under the feature-flag contract and prevent dual ownership.
- No frontend surface invokes the new refresh command yet; cache-first UI synchronization belongs to Stages 5 and 6.

## Known Discrepancies and Risks

- `cached_git_commits` retains a legacy single `branch_id` column alongside migration-3 mappings. The refresh engine explicitly reassigns that legacy reference before deleting a removed branch; broader cache readers should be reviewed in Stage 3/5 for assumptions that one branch owns a commit.
- Git2 work is completed before the async writer queue and passed as owned snapshots because `git2::Repository` is not `Send`. This is intentional and prevents a Tauri command future from crossing the non-`Send` repository handle.
- The layout resolver reports all `Repository::open` failures as `not_git` at the current pure-classification boundary. More granular unreadable versus malformed metadata reporting should be added when Stage 3 lifecycle health consumes the resolver.
- The new command is a foundation boundary, not a replacement for `watch_project_directory`; switching the watcher path now would violate the Stage 3 ownership gate.

## Handoff

Stage 3 may begin manager and scheduler ownership. It must use `refresh_repository_full_command`/the refresh engine rather than adding another cache-writing implementation, preserve the legacy path behind the disabled feature flag, and add lifecycle routing for onboarding, archive/untrack, missing/moved recovery, detail priority, shutdown, and cancellation acknowledgement.
