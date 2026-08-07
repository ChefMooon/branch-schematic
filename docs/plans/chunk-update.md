# Production Chunk Reduction

## Outcome

The production large-chunk warning is resolved without changing the Vite warning threshold or adding manual vendor chunking. React Flow and closed root modals are now loaded outside the initial entry, while branch-map behavior and workspace synchronization remain intact.

## Baseline

The clean build before implementation emitted the following largest JavaScript assets:

| Stage | Largest shared JavaScript | Branch-map JavaScript | Vite warning |
| --- | ---: | ---: | --- |
| Before changes | 764.34 kB | 51.22 kB | Present |
| After shared-boundary changes | 571.37 kB | 51.30 kB | Present |
| Final | 441.68 kB | 51.57 kB | Resolved |

The initial build also included React Flow CSS in shared output. The final browser entry links `index-DRtr8C3o.css` at `15.78 kB`; branch-map CSS is emitted separately at `16.02 kB`.

## Changes

- Removed the root React Flow stylesheet import. `BranchMap.tsx` remains the stylesheet owner.
- Rendered `TanStackRouterDevtools` only in development builds.
- Removed AppLayout's static canvas-store import. Global create-view now loads the store only when the form is submitted and calls the existing Zustand action through `getState()`.
- Removed the workspace-store to canvas-store module dependency.
- Added `registerBranchMapSynchronization()` beside the shared workspace listener. `MapWorkspace` registers `hydrateWorkspaceNodes()` while active and releases it during cleanup.
- Preserved revision deduplication, workspace metadata hydration, active-map cleanup, and the canvas store's existing hydration guards.
- Lazy-loaded closed root modals for repository creation, cloning, bulk import, diagnostics, profile management, settings management, and global canvas-view creation.
- Mounted lazy modals only while open, so closed modal chunks are not requested during application startup. The Suspense fallback is empty because these overlays are fixed-position surfaces and do not affect layout flow.
- Added `npm run analyze:bundle`, which rebuilds the app and checks deterministic initial and branch-map asset budgets without affecting normal builds.

## Bundle Budgets

The analyzer enforces raw-byte budgets defined in `scripts/analyze-bundle.js`:

| Asset | Final size | Budget |
| --- | ---: | ---: |
| Initial JavaScript | 441.68 kB | 480.00 kB |
| Initial linked CSS | 15.78 kB | 55.00 kB |
| Branch-map JavaScript | 51.57 kB | 80.00 kB |
| Branch-map CSS | 16.02 kB | 25.00 kB |

The final report also records gzip sizes: `132.87 kB` initial JavaScript, `3.19 kB` initial CSS, `14.65 kB` branch-map JavaScript, and `2.71 kB` branch-map CSS.

## Regression Coverage

- `AppLayout.test.tsx` now covers global create-view success and failure. A failed create action does not navigate to `/branch-map`.
- `workspace-update-sync.test.ts` now covers explicit active-map registration, duplicate revision suppression, listener sharing, registration cleanup, and metadata refresh without canvas hydration when no map is registered.
- The full frontend suite passes with 37 test files and 154 tests.

## Validation

| Command | Result |
| --- | --- |
| `npx vitest run src/components/layout/AppLayout.test.tsx` | Passed: 8 tests |
| `npx vitest run src/components/layout/AppLayout.test.tsx src/stores/workspace-update-sync.test.ts` | Passed: 9 tests |
| `npm test -- --run` | Passed: 37 files, 154 tests |
| `npm run build` | Passed; no Vite large-chunk warning |
| `npm run analyze:bundle` | Passed; all four budgets met |
| `git diff --check` | Passed |
| Frontend workspace diagnostics | No new errors |

The emitted-asset inspection found React Flow markers only in `canvas-store-Ceqw8ejZ.js`, not in the initial entry. No production router-devtools marker was emitted.

## Remaining Manual Check

The Tauri desktop smoke matrix was not run in this implementation pass. Dashboard, branch map, database, settings, repository details, global create-view, branch-map create-view, profile management, cloning, and diagnostics should still be exercised in `npm run tauri dev`, with particular attention to first-open lazy modal behavior and branch-map navigation after global view creation.

TanStack Router dependency version alignment remains a separate maintenance task and was intentionally excluded from this change.