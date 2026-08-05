# Repository Update Detection Stage 1 Report

## Decision Record

- **Stage:** 1, Schema, Recovery, and Single-Instance Foundation
- **Date:** 2026-08-05
- **Machine:** Windows 11 Home
- **Database reset state:** The debug and release database files were absent at both `%APPDATA%\com.justi.branch-schematic\` and `%LOCALAPPDATA%\com.justi.branch-schematic\` when checked. The fresh-reset path was therefore validated through the migration SQL in an in-memory SQLite test; no existing database was modified.
- **Decision:** Continue the alpha reset-era migration strategy from Stage 0. Migration 1 owns the new settings column, migration 2 owns the pin and health fields, and migration 3 remains the commit-to-branch mapping migration.

## Changed Files

- `src-tauri/Cargo.toml`: added `tauri-plugin-single-instance 2.4.3` and enabled Tokio macros for async migration tests.
- `src-tauri/Cargo.lock`: locked the new single-instance dependency graph.
- `src-tauri/src/db.rs`: added the detail interval, pin, and durable health schema fields; added schema version pragmas; added typed interval helpers; added fail-fast readiness validation; removed the compatibility `ALTER TABLE` helper; added fresh-migration tests.
- `src-tauri/src/lib.rs`: configured runtime WAL, foreign keys, and five-second SQLite busy timeout; added startup/recovery state; validated schema before managing `DbState`; registered the single-instance plugin before setup; queued and forwarded activation payloads; handled database preparation/connection failures without panicking.
- `src/components/database-recovery/DatabaseRecoveryGate.tsx`: added the startup gate and recovery actions for backup, confirmed reset, and exit.
- `src/components/database-recovery/DatabaseRecoveryGate.css`: added the responsive recovery surface styling.
- `docs/Database.md`: regenerated schema documentation with the new columns.
- `docs/CODEBASE_MAP.md`: regenerated to include the recovery component.
- `docs/plans/reports/repository-update-detection-stage-1.md`: this report.

No unrelated production files were retained from the formatter run. Formatter-only changes to untouched `auth.rs`, `daemon.rs`, and `git.rs` were removed.

## Schema Contract Implemented

- `settings.detail_status_refresh_interval INTEGER NOT NULL DEFAULT 5` (created in migration 1 so the settings table is complete when first created).
- `tracked_paths.is_pinned INTEGER NOT NULL DEFAULT 0`.
- `tracked_paths.health_state TEXT NOT NULL DEFAULT 'unverified'`.
- `tracked_paths.is_cache_stale INTEGER NOT NULL DEFAULT 1`.
- `tracked_paths.last_verified_at DATETIME DEFAULT NULL`.
- `tracked_paths.last_successful_verification_at DATETIME DEFAULT NULL`.
- `tracked_paths.verification_failure_count INTEGER NOT NULL DEFAULT 0`.
- `tracked_paths.last_verification_error TEXT DEFAULT NULL`.
- Fresh migration SQL sets `PRAGMA user_version` to 1, 2, and 3 at the end of the corresponding migration blocks.
- Read values are clamped to 2 through 5 seconds; writes are clamped before persistence.
- Readiness validates `PRAGMA user_version = 3`, the highest successful `_sqlx_migrations` version is 3, required columns exist, and required cache indexes exist.
- The old runtime `ALTER TABLE tracked_paths` compatibility helper was removed, so unsupported schemas fail readiness instead of being mutated implicitly.

## Startup and Process Foundation

- The runtime SQLx pool and Tauri SQL migration plugin use the same canonical absolute database path.
- Runtime SQLx connections use `SqliteConnectOptions::filename(path)`, `create_if_missing(true)`, WAL journal mode, foreign-key enforcement, and a five-second busy timeout.
- `DbState` is managed only after migrations are expected to have completed and `db::validate_schema` succeeds.
- Connection, file-preparation, and schema-validation errors set a queryable `recovery_required` startup state rather than panicking.
- `get_database_startup_state` is available without `DbState`, allowing a recovery surface to distinguish `starting`, `ready`, and `recovery_required`.
- `tauri-plugin-single-instance 2.4.3` is registered before `.setup(...)`. Secondary launch arguments and working directory are queued, the main window is restored/shown/focused, and activation payloads are emitted after startup when necessary.
- Typed `get_detail_status_refresh_interval` and `set_detail_status_refresh_interval` commands provide the backend boundary for the future settings surface.
- Recovery commands provide guarded backup, reset, and exit actions. Reset backs up the current database, removes SQLite sidecar files, creates a blank database file, and requires an app restart for migrations to run.
- The root route is gated on startup state so normal layout hydration and database queries do not run while recovery is required.
- Single-instance activation is queued before startup readiness and emitted once after readiness; later activations are emitted immediately without being queued a second time.

## Commands and Results

Environment: Node `v22.23.1`; npm `10.9.8`; Rust `rustc 1.94.1 (e408947bf 2026-03-25)`; Cargo `1.94.1 (29ea6fb6a 2026-03-24)`.

| Command | Result | Evidence |
| --- | --- | --- |
| `cargo test --manifest-path src-tauri/Cargo.toml db::tests` | Passed: 2 focused tests | Fresh migration SQL, schema readiness, defaults, and interval clamping passed. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed | Stage 1 dependency, schema, readiness, and startup wiring compiled successfully. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 30 tests; 0 failed | All library, binary, and doc-test targets passed. |
| `npm test` | Passed: 29 test files, 105 tests | Vitest completed successfully. Existing test stderr warnings remain unrelated. |
| `npm run build` | Passed | TypeScript and Vite production build completed. Existing large-chunk warning remains. |
| `npm run docs:db` | Passed | `docs/Database.md` regenerated and contains the interval, pin, and health fields. |
| `npm run docs:code` | Passed | `docs/CODEBASE_MAP.md` regenerated with the recovery component. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml` | Applied to Stage 1 touched files | Unrelated formatter churn was removed from untouched files afterward. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Not clean | Existing formatting differences remain in untouched `auth.rs`, `daemon.rs`, and `git.rs`; the Stage 1 touched files were formatted. |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Failed | 17 warnings-as-errors include pre-existing issues in `git.rs` and existing style/lint findings in `lib.rs`; these were not changed because they are outside Stage 1 scope. |
| `git diff --check` | Passed | No whitespace errors in the final changed files. |

## Manual and Platform-Specific Checks

These checks remain **unverified**, not passed:

- Present malformed and newer-than-supported databases and verify the recovery UI displays backup/reset/exit actions without changing the original file. The user cannot create an old database for this check; automated schema validation covers the supported fresh-migration path.
- Verify the second-launch process count, one pool owner, one service set, focus behavior, activation before the main window exists, repeated activation, invalid advisory paths, and shutdown with a queued activation.
- Verify the generated database path against the live Tauri `app_data_dir` at runtime; the source path remains synchronized by construction, but no GUI process was launched.

The user manually verified startup with no database present and startup with a valid database. Recovery actions are implemented, but their destructive Windows behavior and second-launch behavior still need manual evidence.

## Stage Disposition

**Pass with risk / handoff blocked for full Stage 1 gate.** The schema, startup foundation, recovery surface, and typed settings boundary compile and have executable coverage. User-confirmed fresh and valid database startup are recorded. The remaining gate is manual recovery-action behavior, malformed/newer-schema behavior, and single-instance Windows evidence before Stage 2 reads or writes the new health, pin, or interval fields in production paths.

## Known Gaps and Owners

- **Recovery UI and backup/reset/exit commands:** implemented; manual destructive-action validation remains.
- **Windows fresh-database launch and restart evidence:** no-database and valid-database startup manually verified by the user; reset/restart after using the recovery action remains.
- **Malformed/newer-schema recovery evidence:** application validation owner; required before Stage 1 handoff.
- **Second-launch process/window evidence:** application validation owner; required before Stage 1 handoff.
- **Repository-wide Clippy and formatting debt:** pre-existing backend maintenance owner; not a Stage 1 blocker unless the project adopts those gates as release blockers.
