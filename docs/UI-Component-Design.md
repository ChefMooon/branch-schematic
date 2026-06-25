# Document 5: UI Component & Layout Hierarchy Blueprint

**Module:** React 19 / TypeScript Spatial Canvas UI Layout System

**Framework Paradigm:** Component-Driven Architecture with High-Performance Spatial Isolation

To handle rendering multi-repository layouts, infinite panning, and Level of Detail (LoD) shifts smoothly at 60 FPS, the UI layout must isolate canvas mutations from standard sidebars and panels. This blueprint details the structural division of components, state management integration, and styling expectations.

---

## 1. Application Layout Architecture

The user interface is split into a **Fixed Frame Layer** (Sidebar, Toolbar, Modals) and a **Spatial Viewport Layer** (Canvas, Cards, Edges) to ensure that zooming or panning the workspace does not shift or lag the settings panels.

```
+-------------------------------------------------------------------------+
| [Top Window Bar]  Branch Map Client                                      |
+-------------------------------------------------------------------------+
| [Sidebar]       |  [Floating Toolbar: Zoom +, Zoom -, Fit]               |
|                 |                                                       |
| - Views List    |  +-------------------------------------------------+  |
| - Tracked Paths |  | [Infinite Canvas Workspace]                    |  |
|                 |  |                                                 |  |
| [Git Staging]   |  |   +-------------+       +-------------+         |  |
| - Modified Files|  |   | Branch Card |=====> | Branch Card |         |  |
| - Commit Form   |  |   +-------------+       +-------------+         |  |
|                 |  +-------------------------------------------------+  |
+-----------------+-------------------------------------------------------+
| [Status Bar]    | Sync State: Idle | Active Path: /code/app1             |
+-------------------------------------------------------------------------+

```

---

## 2. Component Hierarchy

### 2.1 System Level Wrapper

* `<AppLayout />` — Root application container handling the main window frame.
* `<GlobalStatusBar />` — Footer pinning background daemon status tickers, active indexing profiles, and database foot-printing.
* `<NotificationToastOverlay />` — Fixed panel catching background Tauri IPC event notifications (`git-sync::updates-available`), allowing manual non-disruptive workspace updates.



### 2.2 Navigation Controls Panel (Fixed Left Sidebar)

* `<SidebarContainer />` — Collapsible navigation shelf.
* `<ViewSelector />` — Dropdown or list component initiating `get_canvas_view` invoke actions.
* `<WorkspaceStagingPanel />` — Isolated component parsing modified files, showing staging checkboxes, and handling local `Commit` forms per tracked directory path.
* `<TrackedPathsManager />` — Mini-router jumping out to the standalone settings panel for onboarding/hibernating paths.



### 2.3 The Spatial Canvas Engine (Viewport Layer)

* `<WorkspaceCanvas />` — Primary viewport manager wrapping an HTML5 Canvas or an advanced SVG coordinate plane. It listens to right-click/middle-click pan mechanics and mouse-wheel zoom hooks.
* `<DotGridBackground />` — Scalable accent layer dynamically controlling background pattern densities using CSS transitions mapped to the zoom coefficient.
* `<CanvasFloatingToolbar />` — Visual utility cluster overlay (Zoom In, Zoom Out, Reset, Fit to Viewport bounding calculations).
* `<EdgeRenderer />` — SVG layer plotting connections.
* `<TopologyEdgeLine />` — Maps programmatic curves derived from topological structures or explicit `canvas_manual_edges` coordinates stored in SQLite.


* `<CardLayer />` — Dom-node container hosting branch coordinates.
* `<BranchCardNode />` — Individual item module handling translation, focus highlight borders, and click-and-drag mouse drop loops.
* `<SyncPillBadge />` — Visual 2-part split array (`Ahead` and `Behind` deltas) applying tint alarms based on state thresholds.
* `<CommitStreamTimeline />` — Virtualized rendering node wrapper mapping visible histories based on cutoff constraints (3, 5, 10, 15, or scrolling All).
* `<CommitRowItem />` — High-density list row containing message strings, hashes, author avatars, and cryptographic signature labels.









---

## 3. Level of Detail (LoD) Render Mappings

To avoid bottlenecking React's render loop when hundreds of branch elements exist, components use the zoom coefficient to toggle underlying layout sub-components conditionally:

| Zoom Range | Mode Profile | Component Internal Render Rule |
| --- | --- | --- |
| **10% – 49%** | *Bird's-Eye View* | Hide `<CommitStreamTimeline />`, hide text metadata fields. Force `<BranchCardNode />` to display only titles, sync metrics, and the custom accent color. |
| **50% – 99%** | *Mid-Range* | Swap detailed `<CommitRowItem />` strings for simplified abstract geometric tracking node dots to avoid text layout recalculation passes. |
| **100% – 200%** | *Close-Up Mode* | Fully mount and render all rich sub-components, timestamps, commit descriptions, hashes, and profile fields. |

---

## 4. State Management Integration Blueprint (Zustand + React 19)

To decouple lightning-fast visual updates from background database persistence, your client state strategy should follow an **Optimistic UI Update + Throttled Persistence** pattern.

```typescript
import { create } from 'zustand';

interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  cards: Record<string, CanvasCard>;
  updateViewport: (zoom: number, panX: number, panY: number) => void;
  updateCardPositionOptimistic: (branchId: string, x: number, y: number) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoom: 1.0,
  panX: 0,
  panY: 0,
  cards: {},
  updateViewport: (zoom, panX, panY) => set({ zoom, panX, panY }),
  updateCardPositionOptimistic: (branchId, x, y) => 
    set((state) => ({
      cards: {
        ...state.cards,
        [branchId]: { ...state.cards[branchId], pos_x: x, pos_y: y }
      }
    }))
}));

```

### Architectural Core Concepts:

1. **Viewport Changes:** Panning and zooming modify the Zustand state at 60 FPS. A throttled utility (e.g., every 500ms) calls the Tauri invoke handler `update_canvas_viewport` to prevent spamming SQLite writes.
2. **Card Drags:** Moving a card updates the position optimistically in Zustand for immediate responsiveness. The actual Tauri invoke handler `update_card_position` is fired **only on mouse up (drop)**, making database cycles clean and lightweight.