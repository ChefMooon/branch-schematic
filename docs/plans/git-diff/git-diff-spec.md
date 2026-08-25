# Git Commit Diff Viewer Spec

## Goal
Bring commit-level diff viewing into the Commits tab of the repository detail view. When a user selects a commit, they should see the list of files changed by that commit and inspect any of those files as a text diff, switchable between unified and split rendering. All three columns (commit history, changed files, file diff) should be horizontally resizable so users can prioritize the information they care about, matching the interaction model already established by the Changes tab.

## Current State

### Frontend
- `src/features/repository-detail/components/RepositoryDetailCommitsTab.tsx` renders a fixed two-column CSS grid (`repository-view-history`):
  - Left: commit history list (`repository-view-history-list`), constrained to `minmax(280px, 380px)` in `.repository-view-history` (see `RepositoryDetail.css`).
  - Right: static detail panel showing author, committed date, hash, signature, branch pill, and three placeholder buttons ("View commit", disabled "Compare", disabled "Diff").
- Commit data is loaded in `RepositoryDetail.tsx` via the `get_branch_commits` Tauri command (limit 25) and passed down through `RepositoryDetailBody.tsx` as `commits: CommitRecord[]` plus `selectedCommit`. `RepositoryDetailCommitsTab` receives only `branchLabel`; it never receives the repository itself, so it cannot resolve an absolute path for new diff queries.
- The Changes tab already implements everything this feature should mimic:
  - `useResizableChangesPanels` hook (drag divider updates a `splitRatio` clamped to 0.28–0.72; sets global cursor/user-select during drag).
  - Divider markup pattern (`role="separator"`, `aria-orientation="vertical"`).
  - Unified/split view mode toggle in `RepositoryChangesPreviewPanel`.
  - Diff parsing/rendering in `RepositoryDiffPreview` (`parsePatch` builds typed lines from a raw unified patch; `buildSplitRows` pairs deletions/additions for split mode).

### Backend
- `git::get_repository_file_diff` (`src-tauri/src/git.rs`) diffs **working tree/index state only** (`diff_index_to_workdir`, `diff_tree_to_index`). It returns `RepositoryFileDiff { path, old_path, patch, is_binary, is_truncated, unavailable_reason }` and enforces a 512 KB patch cap via `bounded_diff_patch` / `MAX_FILE_DIFF_BYTES`.
- There is **no** command today that produces diffs or changed-file lists for a specific historical commit.
- `lib::get_branch_commits` resolves commits from the SQLite cache (`db::CachedCommitRow`) enriched with push state; it does not touch libgit2 trees.

## Desired User Experience

### Three-column layout
Replacing the current two-column history grid:

```
[ Commit history ] | [ Changed files ] | [ File diff ]
        ↕ divider 1          ↕ divider 2
```

1. **Column 1 — Commit history**: unchanged behavior (existing list, loading/empty states, push indicators, selection highlight).
2. **Column 2 — Changed files for the selected commit**:
   - A single-line collapsible summary strip sits above the file list: commit message (ellipsis-truncated) plus the short hash on one row, with an affordance (chevron) to expand a compact detail block revealing author, formatted date, signature status, branch pill, and push-status indicator when unpushed. Author/date/hash details are otherwise demoted to tooltips on the strip. This preserves vertical space for the file list and diff while keeping metadata reachable.
   - The strip defaults to collapsed; expansion is per-dialog session state and resets when the selected commit changes.
   - Body lists every file changed by the commit, sorted by path, each row showing the file path and a status badge (added / modified / deleted / renamed / copied), styled consistently with `repository-view-change-badge--*`.
   - Renamed rows display `oldPath → newPath`.
   - Selecting a file loads its diff into column 3. Selected row gets the same `is-selected` treatment as commit rows.
   - A per-commit file count appears in the panel header (e.g., "7 files").
3. **Column 3 — File diff**:
   - Header shows the selected file path (ellipsis-truncated, `title` attribute for full path) and a toggle button reading "Split view" / "Unified view", exactly mirroring the Changes tab preview header.
   - Body renders the diff via the existing `RepositoryDiffPreview` component in the chosen mode.
   - Empty/binary/truncated/error states reuse the established `repository-view-empty-state` and `repository-view-diff-notice` patterns.

### Removal of the old detail panel
- The dedicated detail panel (author/committed/hash/signature grid) is replaced by the collapsible summary strip described above; its metadata reappears in the strip's expanded block and tooltips.
- The placeholder buttons ("View commit", "Compare", "Diff") are dropped. Diff inspection is now implicit in selecting a changed file; external link-out and compare flows remain out of scope.

### Resizing
- Both dividers are built on new **shared resize primitives** created by this work (see Architecture Plan): a generalized `useResizablePanels` hook plus a `ResizeDivider` component, so the Commits and Changes tabs share one implementation instead of cloning logic.
- Two vertical drag dividers behave identically to `repository-view-changes-divider`:
  - Divider 1 resizes commit history vs. the combined files+diff region.
  - Divider 2 resizes changed files vs. file diff within the remaining space.
- Defaults: history starts at ~22% of the shell width (slimmer than today's ~30% grid weight so the diff pane keeps the majority, roughly 58%); the files column takes ~20% of its remaining region.
- Constraints (ratios of their respective containers):
  - History column: roughly 18%–45% of the shell width, with a hard pixel floor near the current 280 px minimum.
  - Files column: roughly 20%–60% of its remaining region, floored so file names stay readable (~200 px).
  - The diff pane always keeps the remaining space and can shrink but not collapse below a minimal usable sliver.
- Pixel-aware clamping: fixed ratio bounds alone cannot express "at least 280 px", so each divider config carries `{ minRatio, maxRatio, minPx?, maxPx? }`. At drag time the hook reads the live container rect and converts pixel bounds into effective ratios (`effectiveMin = max(minRatio, minPx / rect.width)`, mirrored for maxima). The hook already re-measures on every mousemove, so this holds at any dialog size without resize observers.
- Per-divider containers: each config binds to its own container ref via `registerContainer(id)` — divider 1 measures the outer shell, divider 2 measures the inner files+diff region. Because divider 2's ratio is relative to that inner region, dragging divider 1 preserves divider 2's local ratio (no drift).
- While dragging: global `col-resize` cursor, text selection suppressed, `user-select` locked — same mechanics as today, implemented once in the shared hook.
- Ratios are component state only (session-scoped, reset when the dialog closes) and are **independent per tab** — Commits tab ratios do not sync with Changes tab ratios. Persistence across sessions is deferred.

### Interaction flow
1. Dialog opens → commits load (existing behavior); first commit auto-selected.
2. Selected commit's changed-file list loads automatically (lazy, on selection change).
3. If the commit touches files, the first file auto-selects and its unified diff loads.
4. User can switch files freely; each selection swaps the diff pane content.
5. Switching commits clears the selected file and reloads the changed-file list.
6. Switching the preview branch (header dropdown) reloads commits and cascades a reset of file + diff panes.

## Architecture Plan

### New/changed frontend pieces

Shared primitives live at the app level (`src/hooks/`, `src/components/`); feature pieces remain under `src/features/repository-detail/`.

| Unit | Kind | Responsibility |
| --- | --- | --- |
| `src/hooks/useResizablePanels.ts` | hook (new, shared) | Generalized multi-divider resize engine extracted from the single-ratio pattern in `useResizableChangesPanels`. Accepts configs `{ id, defaultRatio, minRatio, maxRatio, minPx?, maxPx? }[]`, each bound to its own container ref via `registerContainer(id)`; returns per-id ratios, `startResize(id)`, and `isResizing`. Clamps dynamically (px bounds → effective ratios against the live rect at drag time), locks global cursor/`user-select` during drags, restores on release and unmount. |
| `src/components/resize-divider/ResizeDivider.tsx` (+ `.css`) | component (new, shared) | Presentational vertical separator owning the drag wiring and a11y: `role="separator"`, `aria-orientation="vertical"`, accessible label, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` from effective clamp bounds, ArrowLeft/ArrowRight nudging while focused, mousedown/pointerdown + native-drag prevention. Base styles (`.resize-divider`: 8 px hit target, `col-resize` cursor, `touch-action: none`) move here from `RepositoryDetail.css`; tabs pass layout-specific classes via `className`. |
| `hooks/useCommitChangedFiles.ts` | hook | Given `absolutePath` + `commitHash`, invokes the new changed-files command. Follows the `isCurrent` cancellation pattern of `useRepositoryFileDiff`. Returns `{ files, isLoading, error, clearFiles }`. |
| `hooks/useCommitFileDiff.ts` | hook | Given `absolutePath` + `commitHash` + `path`, invokes the new commit file-diff command. Same shape as `useRepositoryFileDiff`: `{ fileDiff, isDiffLoading, diffError, clearFileDiff }`. |
| `components/RepositoryCommitFilesPanel.tsx` | component | Middle column: commit summary header + scrollable file list + badges + selection. |
| `components/RepositoryCommitDiffPanel.tsx` | component | Right column: header with path + view-mode toggle; delegates body to `RepositoryDiffPreview`. |
| `components/RepositoryDetailCommitsTab.tsx` | modify | Becomes a three-panel flex shell (mirroring `repository-view-changes-shell`) containing the existing history list, the two new panels, and two `ResizeDivider`s wired through `useResizablePanels`. Owns `viewMode` state and selected-file state. |
| `components/RepositoryDetailBody.tsx` / `RepositoryDetail.tsx` | modify | Thread `repo` (or minimally `absolutePath`) down to `RepositoryDetailCommitsTab`; reset selected file when `previewBranch`/commits refresh token changes. |
| `components/RepositoryDiffPreview.tsx` | reuse unchanged | Already consumes `RepositoryFileDiff` + `viewMode`; no changes required. |

### Data contracts

TypeScript additions (in `src/types/git.ts`, mirroring the Rust structs):

- `CommitChangeStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'copied'`
- `CommitChangedFile { path: string; oldPath?: string | null; status: CommitChangeStatus; isBinary?: boolean }`
- The diff response reuses the existing `RepositoryFileDiff` type verbatim.

### New backend commands (`src-tauri`)

Registered alongside the existing git commands in `lib.rs` invoke handler and documented in `docs/arch/IPC_COMMANDS.md`.

**`get_commit_changed_files(absolute_path, commit_hash) -> Vec<CommitChangedFile>`**
1. Open repo via `git2::Repository::open`, resolve the commit by hash (short hashes rejected; frontend always holds full hashes).
2. Determine parent tree: first parent if present, else the empty tree (root commit case).
3. Build `diff_tree_to_tree(old_tree, commit_tree, None)` with rename/copy detection enabled (`find_similar`).
4. Map each delta's `git2::Delta` variant to a `status` string; carry `old_file().path()` for renames/copies; flag binaries via `DiffFlags::BINARY` when already known.
5. Sort by path ascending.

**`get_commit_file_diff(absolute_path, commit_hash, path) -> RepositoryFileDiff`**
1. Same commit/parent-tree resolution as above, with `pathspec(path)` diff options.
2. Mirror the guard rails of `get_repository_file_diff`: no deltas → `unavailable_reason` payload; binary delta → `is_binary` payload; otherwise `bounded_diff_patch` for size-capped output with `is_truncated` flag.
3. Return the same `RepositoryFileDiff` struct so the frontend renderer stays generic.

Implementation notes:
- Extract a small shared helper for "resolve commit + parent tree" used by both commands rather than duplicating resolution logic.
- Add Rust unit tests adjacent to the existing `test_get_repository_file_diff_returns_changed_and_untracked_text`, covering: modified file, added file, deleted file, renamed file, root-commit diff, binary file, and truncation cap.

## State, Caching, and Edge Cases

- **Stale-response safety**: both hooks must ignore out-of-order resolutions (the `isCurrent` cleanup-flag pattern used by `useRepositoryFileDiff`).
- **Reset cascade**: changing commit, branch, or reopening the dialog clears selected file, cached diff, and errors. Clearing mirrors the `clearFileDiff` call made before actions in the Changes tab.
- **MVP caching**: none — each file selection issues a fresh query. Diffs are capped at 512 KB server-side and commits lists are capped at 25, so refetch cost is acceptable. A per-dialog memo map keyed by `commitHash:path` is a cheap follow-up if needed.
- **Merge commits**: diff against first parent only. Combined/against-all-parents views are deferred.
- **Root commits**: diffed against the empty tree; all files appear as `added`.
- **Empty commits** (e.g., merge commits with no tree delta): the files column stays in place (no layout shift between commits) and shows an explicit "No changed files in this commit." empty state; diff pane shows its idle prompt.
- **Deleted files**: render normally (patch contains only removals); no special casing beyond the badge.
- **Binary files**: surfaced from either the changed-files payload or the diff payload; show the established binary empty-state message.
- **Truncated patches**: show the existing `unavailableReason` notice above the partial diff.
- **Submodules/symlinks/mode-only changes**: treat as non-text entries with an appropriate `unavailableReason`; do not attempt content patches in v1.

## Styling Notes

- New shell class (e.g., `repository-view-history-shell`) modeled on `.repository-view-changes-shell` (bordered, rounded, flex, `overflow: hidden`), replacing the current `grid-template-columns` definition of `.repository-view-history`.
- Panels reuse `.repository-view-changes-panel` sizing primitives (flex column, `min-width: 0`, internal scroll regions) rather than inventing parallel rules; history column switches from grid child to `flexBasis: ratio%` inline style like `RepositoryChangesListPanel`.
- Dividers clone `.repository-view-changes-divider` (8px hit target, `cursor: col-resize`, `touch-action: none`).
- Responsive: below the existing 900px breakpoint, drop the flex ratios and stack the three panels vertically; hide dividers (they're meaningless in a stacked layout). This replaces the current single-column collapse of `.repository-view-history`.

## Accessibility

- Dividers keep `role="separator"`, `aria-orientation="vertical"`, and distinct labels ("Resize commit history panels", "Resize commit file panels").
- Keyboard and value semantics ship inside the shared `ResizeDivider` rather than as an optional backport: separators expose `aria-valuemin`/`aria-valuemax`/`aria-valuenow` derived from their effective clamp bounds and nudge on ArrowLeft/ArrowRight while focused. The Changes tab inherits all of this automatically once it adopts the primitives (see Follow-up Work).
- File rows are buttons (like commit rows) with visible focus rings; selected state conveyed via the `is-selected` class plus `aria-current` where sensible.
- View-mode toggle announces its resulting mode through its accessible label, consistent with the existing toggle button.

## Testing Plan

Frontend (Vitest + Testing Library, colocated `*.test.tsx`):
- `RepositoryDetailCommitsTab.test.tsx`:
  - renders loading/empty/loaded history states (existing coverage preserved);
  - selecting a commit triggers changed-files fetch and renders file rows with badges;
  - selecting a file triggers diff fetch and renders diff body;
  - toggling view mode flips the rendered diff container between unified and split;
  - dragging dividers (simulated mouse events) adjusts panel flex-basis within clamp bounds.
- Shared primitives: `useResizablePanels.test.ts` (clamp math including px-floor conversion at multiple container widths, per-divider independence when divider 1 moves, drag lifecycle sets/restores cursor + user-select) and `ResizeDivider.test.tsx` (aria values reflect ratio/bounds, arrow keys nudge within clamps, mousedown triggers start handler with default prevented).
- Hook tests: `useCommitChangedFiles` / `useCommitFileDiff` success, error, and stale-response suppression (mocked `invoke`).
- Regression: `RepositoryDetailChangesTab.test.tsx` passes unchanged — this work leaves `useResizableChangesPanels` and the Changes tab untouched; its migration to the shared primitives happens in the follow-up spec.

Backend (cargo tests in `git.rs`):
- As listed under the backend section: modified/added/deleted/renamed/root/binary/truncated cases against fixture repositories.

## MVP Scope

Included:
- Three-column commits tab with lazy loaded changed-file list per commit
- Lazy per-file commit diffs rendered through the existing unified/split `RepositoryDiffPreview`
- Unified/split toggle in the diff pane header
- Two draggable resize dividers with clamped ratios, built on shared resize primitives (`useResizablePanels` + `ResizeDivider`) created by this work
- Commit summary absorbed into the files-panel header; old detail panel and placeholder buttons removed
- Backend commands `get_commit_changed_files` + `get_commit_file_diff` with binary/truncation guards
- Responsive stacked fallback under 900px
- Frontend and backend tests per the plan above; IPC docs updated (`docs/arch/IPC_COMMANDS.md`, `COMPONENT_TREE.md` where applicable)

Deferred:
- Persisting panel ratios across sessions (and sharing ratios with the Changes tab)
- Per-file addition/deletion line counts in the file list (requires diff stats pass)
- Combined diffs for merge commits; compare-against-arbitrary-ref flows
- Diff syntax highlighting, word-level intra-line highlighting, hunk navigation, and expandable context
- Inline actions on commit files (checkout/revert single file)
- Caching layers beyond the request lifecycle

## Resolved Decisions

1. **Empty commits**: the changed-files column remains visible with an empty state; the diff pane never reclaims its width. Prevents jarring reflow when navigating between commits.
2. **Commit summary placement**: single-line collapsible strip above the file list — message + short hash always visible; author/date/signature/branch/push-state revealed in an expandable block and tooltips. Defaults collapsed; resets on commit change.
3. **Default widths**: history column starts at ~22% of the shell (down from ~30%), files column ~20% of its remaining region, diff pane keeps the majority (~58%).
4. **Ratio sharing**: panel ratios are independent per tab within a session; no sync with the Changes tab. Cross-session persistence remains deferred.
5. **Shared resize primitives**: the multi-divider hook and separator component are created here (first consumer: this feature) and the Changes tab adopts them afterward — no parallel implementations are kept long-term. Pixel floors are enforced by converting px bounds to effective ratios at drag time, not via resize observers.

## Follow-up Work

- **Changes-tab adoption**: migrate `RepositoryDetailChangesTab` off `useResizableChangesPanels` and its inline divider markup onto the shared primitives, inheriting the aria-value/keyboard upgrades. Tracked in `docs/plans/git-diff/changes-tab-resize-adoption-spec.md`.
