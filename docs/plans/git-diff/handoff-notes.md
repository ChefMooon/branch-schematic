# Git Diff Implementation — Phase Handoff Notes

Sequential notes left by each implementing agent. Read the latest entries before starting a phase.
Baseline date: 2026-08-25. Plan: [git-diff-implementation-plan.md](git-diff-implementation-plan.md). Spec: [git-diff-spec.md](git-diff-spec.md).

---

## Phase 0: Baseline and Contract Freeze — COMPLETE

### Baseline results (recorded)

| Gate | Result |
| --- | --- |
| `npm run test` | 43 files / 210 tests all passing (after baseline repair #1 below) |
| `cargo test` (in `src-tauri`) | 70 passed / 0 failed (after baseline repairs #2 and #3 below) |
| `npm run build` | clean |

### Baseline repairs made (pre-existing breakage, not caused by feature work)

1. **`RepositoryDetailBody.test.tsx` (frontend)** — test "loads the selected file diff and renders both preview modes" queued only two mocked invoke responses, but `useRepositoryChanges.loadChanges` fires both `get_repository_changes_if_changed` AND `get_latest_commit` before any diff call; the diff response was consumed by `get_latest_commit`. Fixed by inserting `.mockResolvedValueOnce(null)` between the existing mocks.

2. **Windows: `cargo test` could not start at all** (`STATUS_ENTRYPOINT_NOT_FOUND`, 0xc0000139). Root cause: unit-test exes have no embedded application manifest, so the loader bound comctl32 **v5**, which lacks `TaskDialogIndirect` — imported unconditionally via tauri → tray-icon → muda. The packaged app works because tauri-build embeds a Common-Controls v6 manifest into bins only (`cargo:rustc-link-arg-bins`). **Fix applied:** new file `src-tauri/.cargo/config.toml` adds `/DELAYLOAD:comctl32.dll` + `delayimp.lib` to rustflags for `cfg(windows)`. Tests never call comctl32 so they start; the real app still resolves v6 at runtime via its own manifest. Do not remove this config. Note: an alternative build.rs approach using `cargo:rustc-link-arg-tests` was tried and rejected — that directive only covers integration-test targets in `tests/`, not lib unit tests.

3. **Stale DB fixtures in `git.rs` tests** — `test_track_repository_path_reports_existing_repo_without_insert_duplicate` and `test_track_repository_path_reports_readded_inactive_repo_as_added` created minimal `tracked_paths` tables without `archived_at`, but `db::insert_tracked_path` unconditionally sets `archived_at = NULL`. Added `archived_at DATETIME DEFAULT NULL` to both fixture CREATE TABLE statements.

These failures were invisible until now because cargo test never ran successfully on this machine (no CI runs cargo test either).

### Fixture pattern confirmed for cargo tests

Reuse `create_test_repo(name)` + `create_initial_commit(&repo, &repo_path)` (git.rs ~lines 3469–3512): temp dir under `%TEMP%`, `Repository::init`, user.name/email config, README.md committed. Additional commits can be built with `index.add_path` → `write_tree` → `repo.commit(Some("HEAD"), ...)` with parent(s). Clean up with `fs::remove_dir_all(repo_path)`. See `test_get_repository_file_diff_returns_changed_and_untracked_text` (git.rs ~3746) for invocation style (`tauri::async_runtime::block_on`).

### Current state verified against spec

- `RepositoryDetailCommitsTab.tsx`: fixed two-column grid (`repository-view-history`), right panel has author/committed/hash/signature grid + three placeholder buttons ("View commit", disabled "Compare", disabled "Diff"). Matches spec Current State.
- `RepositoryDiffPreview.tsx` (`parsePatch`, `buildSplitRows`) is generic over `RepositoryFileDiff` + `viewMode`; no changes needed. Confirmed.
- Changes tab regression surface untouched so far: `useResizableChangesPanels.ts`, `RepositoryDetail.css`, `RepositoryDetailChangesTab.test.tsx`.
- Backend: `get_repository_file_diff` + `bounded_diff_patch` + `MAX_FILE_DIFF_BYTES = 512 * 1024` live in git.rs (~2577–2744). Commands registered in `lib.rs` `generate_handler!` (~1331).

No open questions. Safe to proceed to Phases 1 and 2.

---

## Phase 1: Shared Resize Primitives — COMPLETE

### Delivered

- `src/hooks/useResizablePanels.ts` — multi-divider engine. API: `useResizablePanels(configs: ResizablePanelConfig[])` where config = `{ id, defaultRatio, minRatio, maxRatio, minPx?, maxPx? }`. Returns `{ registerContainer(id) -> refCallback, ratios (Record<id, number>), isResizing, resizingId, startResize(id) -> mouseHandler, resizeBy(id, delta), getEffectiveBounds(id) }`.
  - Drag-time clamping per spec formula: `effectiveMin = max(minRatio, minPx / rect.width)`, `effectiveMax = min(maxRatio, maxPx / rect.width)` against the live container rect on every mousemove.
  - Global cursor (`col-resize`) + `user-select` lock on body/documentElement during drag; restored on release AND unmount.
  - Per-divider containers via `registerContainer(id)` ref callbacks → dragging divider 1 does not disturb divider 2's local ratio.
  - `resizeBy(id, delta)` exists for keyboard nudging (clamped); `getEffectiveBounds(id)` exposes live px-aware bounds for aria attributes.
- `src/components/resize-divider/ResizeDivider.tsx` + `ResizeDivider.css` — presentational separator: `role="separator"`, `aria-orientation="vertical"`, `aria-label`, `aria-valuemin/max/now` in percent derived from effective bounds, ArrowLeft/ArrowRight → `onNudge(-1 | 1)` (no-op if handler omitted), mousedown preventDefault + delegate to `onResizeStart`, native dragstart prevented, focusable (`tabIndex={0}`), extra layout class via `className` prop. CSS ports `.repository-view-changes-divider` base rules verbatim into `.resize-divider`; Changes-tab CSS untouched.
- Tests: `src/hooks/useResizablePanels.test.ts` (9 tests: defaults, ratio clamping, px-floor conversion at 1000px vs 2000px widths, maxPx cap, per-divider independence, cursor/user-select lifecycle incl. unmount mid-drag, nudge clamping) and `src/components/resize-divider/ResizeDivider.test.tsx` (6 tests).

### Gate results

- `npm run test`: 45 files / 225 tests passing (210 baseline + 15 new).
- `npm run build`: clean.

### Notes for Phase 5 wiring

- Wire as: `<div ref={registerContainer('history-shell')}>` on outer shell; divider props need current `ratios[id]` + `getEffectiveBounds(id)` re-read during render (bounds are cheap rect reads; they update on re-render after drags).
- Divider 2's container must be the inner files+diff region so its ratio stays relative there (no drift when divider 1 moves).
- jsdom lacks a `DragEvent` constructor — use `new Event('dragstart', ...)` in future divider tests.

---

## Phase 2: Backend Commit Diff Commands — COMPLETE

### Delivered (all in `src-tauri/src/git.rs` unless noted)

- `CommitChangedFile` struct (serde camelCase) after `RepositoryFileDiff`: `{ path, old_path: Option<String>, status: String, is_binary: bool }`.
- `resolve_commit_and_parent_trees(repo, commit_hash)` shared helper: `Oid::from_str` rejects short/non-hex hashes server-side; first parent tree when `parent_count() > 0`, else `None` (root → empty-tree diff).
- `commit_delta_status(git2::Delta)` → `"added" | "deleted" | "renamed" | "copied"`, default `"modified"` (covers Typechange/Conflicted).
- `diff_commit_against_parent_tree(...)`: `diff_tree_to_tree(parent, commit)` + `find_similar` with renames+copies enabled. NOTE the explicit `'repo` lifetime binding on repo/trees/diff return — required for git2 0.19.
- `get_commit_changed_files(absolute_path, commit_hash) -> Vec<CommitChangedFile>`: full-commit diff, `old_path` only for renamed/copied, binary flag from delta flags, **sorted by path ascending**.
- `get_commit_file_diff(absolute_path, commit_hash, path) -> RepositoryFileDiff`: deliberately does NOT use pathspec filtering — pathspec diffs cannot see the rename source, so `old_file()` degenerates to the new path. Instead: full diff + find_similar → select delta whose new/old path matches → per-delta `git2::Patch::from_diff` → bounded print against `MAX_FILE_DIFF_BYTES` (512 KB) with skip-style truncation identical to `bounded_diff_patch`. Binary guard rails: pre-print `DiffFlags::BINARY` check AND post-print fallback (`patch.contains("GIT binary patch") || contains("Binary files ")`) because libgit2 only sets BINARY flags once content has been printed. Deleted files match via old-path fallback in selection.
- Registered both commands in `lib.rs` generate_handler right after `git::get_repository_file_diff`.

### Cargo tests added (adjacent to the existing file-diff test)

Helper `commit_workdir_state(repo, message) -> String` (full-hash): add_all + update_all + write_tree + commit onto HEAD parent.
Tests: modified (+file diff content), added, deleted (+patch `-delete me`), renamed (old_path both payloads), root commit (= additions, `--- /dev/null` present), binary asset (is_binary via post-print fallback), truncation cap (12k-line file → is_truncated, bytes <= MAX), merge commit vs FIRST parent only (programmatic TreeBuilder merge commit; only feature-file appears).

### Gate results

- `cargo test`: 78 passed / 0 failed (70 baseline + 8 new).

### Notes

- libgit2 gotcha recorded above (pathspec kills rename pairing; BINARY flags set late) — do not "simplify" back to a pathspec diff.
- `git2::Patch::print` callback: returning `true` continues, `false` aborts with EUSER error; we mirror the existing skip-continue truncation style.
- IPC docs update intentionally deferred to Phase 6 per plan.

---

## Phase 3: TypeScript Contracts and Data Hooks — COMPLETE

### Delivered

- `src/types/git.ts`: added `CommitChangeStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'copied'` and `CommitChangedFile { path; oldPath?; status; isBinary? }` directly below the untouched `RepositoryFileDiff`.
- `src/features/repository-detail/hooks/useCommitChangedFiles.ts`: `{ files: CommitChangedFile[] | null, isLoading, error, clearFiles }`. `isCurrent` cleanup-flag cancellation; resets to null/no-load when `absolutePath` or `commitHash` missing.
- `src/features/repository-detail/hooks/useCommitFileDiff.ts`: `{ fileDiff, isDiffLoading, diffError, clearFileDiff }` for `get_commit_file_diff` (args `absolutePath`, `commitHash`, `path`). Same pattern; mirrors useRepositoryFileDiff shape exactly per spec.
- Hook test suites (mocked invoke): success, error passthrough, stale-response suppression via deferred first promise + rerender, no-fetch guard when inputs missing, manual clear methods. 10 tests.

### Gate results

- `npm run test`: 47 files / 235 tests passing. `npm run build`: clean.

---

## Phase 4: Three-Panel Commits Tab — COMPLETE

### Delivered

- `RepositoryCommitFilesPanel.tsx` (new): per-commit count header ("N files"), collapsible summary strip — collapsed default showing message + short-hash + chevron ONLY (author/date/hash demoted to strip `title` tooltips per spec), expanded block reveals author/committed/signature/branch-pill + push indicator; expansion state resets when `commit_hash` changes; sorted file rows as buttons with `repository-view-change-badge--*` badges (`copied` reuses the renamed badge class), `oldPath → newPath` rendering via row text + title, `.is-selected` + `aria-current`, loading/error/`No changed files in this commit.` empty states.
- `RepositoryCommitDiffPanel.tsx` (new): header with ellipsized path (`title` attr) + "Split view"/"Unified view" toggle mirroring the Changes preview header; body delegates to untouched `RepositoryDiffPreview`; binary → established FileText empty-state; truncation notice above partial diff; idle prompt "Select a file to preview its diff.".
- `RepositoryDetailCommitsTab.tsx` (rewritten): three-panel flex shell `.repository-view-history-shell` (history panel inline `flexBasis: 22%`; inner `.repository-view-commit-region` holds files panel CSS-basis 20% + diff panel flex:1). Owns `selectedFilePath` + `viewMode`. Reset cascade: effect clears selectedFilePath whenever selected commit hash changes; auto-select effect picks first file once files arrive (no-op if already selected). No dividers rendered yet.
- `RepositoryDetailBody.tsx`: now passes `repo` into the commits tab. `RepositoryDetail.tsx` needed NO changes (repo already flowed to Body). Old detail panel + placeholder buttons ("View commit"/"Compare"/"Diff") fully removed.
- CSS (RepositoryDetail.css additions only — zero changes to existing rules): `.repository-view-history-tab/-shell`, `-history-panel`, `-commit-region`, `-files-panel` (border-right separators until real dividers land), `-diff-panel`, summary strip/details styles, file-row styles modeled on change-row. Existing `@media (max-width: 900px)` block EXTENDED (not modified) with stacking rules: shell+region become columns, direct children get `flex-basis: auto !important` + `min-height: 220px`, `.resize-divider` hidden inside this shell (future-proofs Phase 5).

### Test updates required by the removals (regression surface untouched)

- `RepositoryDetailBody.test.tsx`: dropped assertions on removed detail grid/buttons; history-button queries disambiguated from the new summary strip (both contain the message text); date asserted once; added assertion that changed-files fetch fires for the selected commit.
- `RepositoryDetail.test.tsx`: three tests updated — same button-disambiguation via local `findHistoryItem` helper (class-scoped); end of test 1 now asserts `get_commit_changed_files` call instead of the removed heading.

### Gate results

- `npm run test`: 48 files / 243 tests passing. `npm run build`: clean. `tsc --noEmit`: clean. Changes-tab suite green and unmodified.
- MANUAL VALIDATION STILL PENDING (cannot run the GUI here): open dialog on a real repo, verify streaming selection flow + narrow-window stacking before calling Phase 4 fully done. Fold into Phase 6's manual pass.

---

## Phase 5: Divider Wiring — COMPLETE

### Delivered

- `RepositoryDetailCommitsTab.tsx` now instantiates `useResizablePanels(COMMIT_PANEL_CONFIGS)` with the normative bounds: history `{ defaultRatio: 0.22, minRatio: 0.18, maxRatio: 0.45, minPx: 280 }`, files `{ defaultRatio: 0.20, minRatio: 0.20, maxRatio: 0.60, minPx: 200 }`.
- `registerContainer('history')` on the outer shell; `registerContainer('files')` on the inner files+diff region (divider-2 ratio stays relative to its own container → no drift when divider 1 moves).
- Two `ResizeDivider`s: labels "Resize commit history panels" / "Resize commit file panels", classes `repository-view-history-divider` / `-commit-files-divider`; aria values come from `getEffectiveBounds(id)` re-read per render; ArrowLeft/Right nudge ±1% via `resizeBy` (KEYBOARD_NUDGE_STEP = 0.01).
- Static bases replaced with hook ratios through `formatFlexBasis()` helper (rounds to 2dp of percent — keeps float noise out of inline styles and tests). Files panel gained optional `style` prop.
- CSS cleanup: removed phase-4 temporary `flex-shrink: 0` on history panel and static `flex: 0 0 20%` on files panel (inline basis now authoritative); responsive hiding below 900px was already in place from Phase 4 (`.resize-divider { display: none }` inside this shell).
- Tests added to `RepositoryDetailCommitsTab.test.tsx`: drag simulation asserts flex-basis updates + clamping (px floor 280/1000 → 28% at width 1000; maxRatio caps), divider independence across regions, and keyboard nudging. Helper `rect(width)` stubs getBoundingClientRect.

### Gate results

- `npm run test`: 48 files / 245 tests passing. `npm run build`: clean. `cargo test`: 78 passed.
- MANUAL VALIDATION STILL PENDING (fold into Phase 6): physically dragging each divider in the running app, px floors at narrow dialog widths, divider-2 no-drift behavior.

---

## Phase 6: Documentation and Full Validation — COMPLETE (manual pass outstanding)

### Delivered

- `docs/arch/IPC_COMMANDS.md`: hand-inserted `get_commit_changed_files` + `get_commit_file_diff` rows in alphabetical position, matching generator format exactly. NOTE: arch-snap is NOT installed globally on this machine (`npm run docs:*` fails with "Cannot find module ...\node_modules\arch-snap"), so regeneration was impossible; to keep future regens consistent, matching `///` doc comments were added to both Rust commands in git.rs.
- `docs/arch/COMPONENT_TREE.md`: added ResizeDivider entry (Shared section, after PushStatusIndicator), added RepositoryCommitDiffPanel + RepositoryCommitFilesPanel entries, refreshed RepositoryDetailCommitsTab entry (lines/imports/hooks).
- TEST_MAP not regenerated (same arch-snap limitation) — run `npm run docs:all` on a machine with arch-snap installed to normalize all three docs.

### Final automated gate results

| Gate | Result |
| --- | --- |
| `npm run test` | 48 files / 245 tests passing |
| `npm run build` | clean |
| `cargo test` (src-tauri) | 78 passed / 0 failed |

### MVP checklist vs spec

- [x] Three-column commits tab with lazy per-commit changed-file list
- [x] Lazy per-file commit diffs through untouched `RepositoryDiffPreview`
- [x] Unified/split toggle in diff pane header
- [x] Two draggable dividers with clamped ratios on shared primitives (normative configs verbatim)
- [x] Commit summary absorbed into files-panel header; old detail panel + placeholder buttons removed
- [x] Backend commands with binary/truncation guards (+ merge→first-parent, root→empty-tree)
- [x] Responsive stacked fallback under 900px (dividers hidden)
- [x] Frontend/backend tests per plan
- [x] IPC docs updated
- Deferred list verified — nothing from it was implemented (no ratio persistence, no line counts, no combined merge views, no highlighting/hunk nav, no per-file actions, no extra caching).

### OUTSTANDING: manual validation (requires running app)

1. Open dialog on a real repo containing: root commit, merge commit, empty commit, a rename, a binary file, and a >512 KB text change; walk Interaction Flow steps 1–6 from the spec.
2. Drag each divider at normal and narrow widths; verify px floors (280px history / 200px files) hold when the dialog is small.
3. Verify divider-2 ratio does not drift when divider 1 moves.
4. Verify sub-900px stacking and that dividers disappear.

---
## END OF HANDOFF — all six phases implemented. Remaining work: manual pass above + optional Changes-tab adoption per changes-tab-resize-adoption-spec.md (separate effort).

---

## Changes Tab Resize Adoption — COMPLETE

Per [changes-tab-resize-adoption-spec.md](changes-tab-resize-adoption-spec.md).

### Delivered

- `RepositoryDetailChangesTab.tsx`: swapped `useResizableChangesPanels()` for `useResizablePanels([{ id: 'changes', defaultRatio: 0.28, minRatio: 0.28, maxRatio: 0.72 }])`. `registerContainer('changes')` on `.repository-view-changes-shell`; `ratios.changes` feeds `RepositoryChangesListPanel`; inline divider markup replaced with `<ResizeDivider label="Resize changes panels" className="repository-view-changes-divider">` using `getEffectiveBounds('changes')` for aria bounds and ArrowLeft/Right nudging via `resizeBy` (KEYBOARD_NUDGE_STEP = 0.01), mirroring the Commits-tab wiring. NOTE: the spec snippet `onResizeStart={() => startResize('changes')}` would create-but-never-invoke the handler; used the correct Commits-tab idiom `onResizeStart={startResize('changes')}` instead.
- CSS: `.repository-view-changes-divider` reduced to `flex-shrink: 0` only; base visuals (8px width, cursor, background, user-select, touch-action) now come from `.resize-divider` in ResizeDivider.css (already ported verbatim in Phase 1). Rendered output visually identical.
- Deleted `src/features/repository-detail/hooks/useResizableChangesPanels.ts` (no remaining references outside docs/plans).
- Test guard: extended "prevents text selection while resizing the changes layout" to assert `aria-valuenow="28"`, `aria-valuemin="28"`, `aria-valuemax="72"` on the separator.
- Docs (manual edits, arch-snap still not installed): COMPONENT_TREE.md RepositoryDetailChangesTab entry refreshed (143 lines, ResizeDivider import, useResizablePanels hook); CODEBASE_MAP.md hooks listing updated.

### Gate results

| Gate | Result |
| --- | --- |
| `npm run test` | 48 files / 245 tests passing (regression suites unchanged + guard assertions) |
| `npm run build` | clean |

### Behavior contract verification

- Initial ratio 0.28, clamp [0.28, 0.72] via config verbatim. ✓
- Global col-resize cursor + text-selection lock during drag, restored on release/unmount — inherited from shared hook (covered by its suite). ✓
- Divider keeps role/aria-orientation/accessible name "Resize changes panels"; Body + Changes-tab regression tests pass unmodified. ✓
- Net-new: aria-valuemin/max/now + arrow-key nudging within clamps. ✓
