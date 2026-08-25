# Changes Tab Resize Adoption Spec

## Goal
Migrate the Changes tab onto the shared resize primitives introduced by the git diff viewer work — the `useResizablePanels` hook (`src/hooks/useResizablePanels.ts`) and the `ResizeDivider` component (`src/components/resize-divider/ResizeDivider.tsx`) — so both resizable layouts run one implementation, and the Changes tab inherits the accessibility upgrades (aria value attributes + arrow-key resizing) for free.

## Current State
- `src/features/repository-detail/hooks/useResizableChangesPanels.ts` owns all drag-resize behavior for the Changes tab:
  - single `splitRatio`, initialized to `0.28`, clamped to `[0.28, 0.72]` of shell width;
  - window-level `mousemove`/`mouseup` listeners while dragging;
  - global `col-resize` cursor and body/documentElement `user-select` lock during drags, restored on release and unmount.
- `RepositoryDetailChangesTab.tsx` duplicates the divider markup inline (`role="separator"`, `aria-orientation="vertical"`, label "Resize changes panels", `onMouseDown` + `onDragStart` prevention).
- Base divider styles live in `RepositoryDetail.css` under `.repository-view-changes-divider` (8 px width, `col-resize`, `user-select`, `touch-action: none`).
- Behavior is pinned by tests: `RepositoryDetailChangesTab.test.tsx` and `RepositoryDetailBody.test.tsx` both assert "prevents text selection while resizing the changes layout" via the separator's role and accessible name.
- No other consumers exist for `useResizableChangesPanels`.

## Scope

In scope:
- Replace `useResizableChangesPanels` usage with `useResizablePanels` (single-divider config).
- Replace the inline divider element with `ResizeDivider`.
- Retire the old hook file once unreferenced.
- Move base divider visuals into `ResizeDivider.css`; keep the tab-specific class name working.

Out of scope:
- Persisting ratios across sessions or syncing them with the Commits tab (still deferred per the git-diff spec).
- Any layout or visual redesign of the Changes tab.
- Touch-gesture tuning beyond what the shared hook already provides.

## Migration Plan

1. **Hook swap**: in `RepositoryDetailChangesTab.tsx`, replace `useResizableChangesPanels()` with:
   - `useResizablePanels([{ id: 'changes', defaultRatio: 0.28, minRatio: 0.28, maxRatio: 0.72 }])`;
   - attach `registerContainer('changes')` where `containerRef` was used on `.repository-view-changes-shell`;
   - read `ratios.changes` where `splitRatio` is passed to `RepositoryChangesListPanel`;
   - pass `startResize('changes')` to the divider's start handler.
   - No `minPx`/`maxPx` needed here — this layout's constraints are ratio-only; pixel floors are a Commits-tab concern.
2. **Divider swap**: render `<ResizeDivider>` with:
   - `label="Resize changes panels"` — accessible name unchanged, so existing test selectors keep matching;
   - `value`/`min`/`max` from the hook's ratio and effective bounds;
   - `onResizeStart={() => startResize('changes')}`;
   - `className="repository-view-changes-divider"` preserved so layout CSS still applies.
3. **CSS consolidation**: base rules (hit-target width, `cursor: col-resize`, `user-select`, `touch-action: none`) move to `.resize-divider` in `ResizeDivider.css`; `.repository-view-changes-divider` keeps only layout-specific bits (e.g., `flex-shrink: 0`). Rendered output must remain visually identical.
4. **Retire the old hook**: delete `src/features/repository-detail/hooks/useResizableChangesPanels.ts` in the same change. No deprecated wrapper is kept — this spec is its only consumer's migration.

## Behavior Contract (must hold after adoption)
- Initial split ratio: `0.28`.
- Drag clamping: `[0.28, 0.72]` of shell width.
- During drag: global `col-resize` cursor, text selection suppressed everywhere; restored on mouseup and on unmount mid-drag.
- Divider keeps `role="separator"`, `aria-orientation="vertical"`, accessible name "Resize changes panels".
- Net-new (inherited from the shared component): `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, ArrowLeft/ArrowRight nudging within clamps while focused.

## Testing
- Regression (must pass unchanged): `RepositoryDetailChangesTab.test.tsx` and `RepositoryDetailBody.test.tsx` — both locate the divider by role/name, which the migration preserves.
- Guard assertion: extend one Changes-tab test to check the rendered separator exposes `aria-valuenow`, proving the a11y upgrade survived adoption.
- Clamp math, drag lifecycle, keyboard nudging, and aria semantics are covered by the shared primitive tests added in the git-diff work; do not duplicate those suites here.
- Remove any now-orphaned references to `useResizableChangesPanels` from tests/mocks.

## Rollout & Dependencies
- Depends on: shared primitives merged (git-diff spec → Architecture Plan).
- Ordering vs. the three-column Commits tab work: independent; can land before or after. Landing first means the Commits tab builds against an API that already has a second consumer.
- No backend changes and no IPC docs impact. Update `COMPONENT_TREE.md` if it enumerates the divider/hook.
