# Document 4: Technical Specification – IPC Bridge & API Protocol

**Module:** Tauri Inter-Process Communication (IPC) Specification

**Target Engine:** Tauri v2 Commands (`tauri::command`) & Event Emmission (`tauri::Emitter`)

**Frontend Contract:** React 19 / TypeScript

Because Tauri operates across an asynchronous process isolation boundary, this document establishes the precise TypeScript-to-Rust type definitions and API contracts. The API is divided into **Invokes** (Request/Response operations triggered by the frontend) and **Listen Events** (Asynchronous, non-blocking stream updates pushed from the Rust Core).

---

## 1. Type Definitions & Core Data Structs

To ensure type safety across the IPC bridge, these structures mirror your SQLite tables and must be exported by Rust (`#[derive(serde::Serialize, serde::Deserialize, TS)]`) and imported by React 19.

```typescript
export interface TrackedPath {
  id: string;
  display_name: string;
  absolute_path: string;
  remote_url: string | null;
  is_active: boolean;
}

export interface CanvasView {
  id: string;
  view_name: string;
  zoom_level: number;
  pan_x: number;
  pan_y: number;
}

export interface CanvasCard {
  branch_id: string;
  path_id: string;
  branch_name: string;
  is_head: boolean;
  ahead_count: number;
  behind_count: number;
  pos_x: number;
  pos_y: number;
  view_mode: 'COMPACT' | 'EXPANDED';
  commit_density: number; // 3, 5, 10, 15, or -1 (All)
  theme_color_hex: string;
}

export interface GitCommit {
  commit_hash: string;
  author_name: string;
  commit_message: string;
  committed_at: string; // ISO 8601 Timestamp
  signature_status: 'NONE' | 'VALID' | 'INVALID' | 'UNVERIFIED';
}

export interface TopologyEdge {
  id: string; // Generated on-the-fly for automatic, uuid for manual
  source_branch_id: string;
  target_branch_id: string;
  is_manual: boolean;
  edge_style: 'STRAIGHT' | 'BEZIER';
}

```

---

## 2. Tauri Invoke Commands (React $\rightarrow$ Rust)

### 2.1 Workspace & Canvas Layout Architecture

Used for initializing and panning the infinite canvas workspace.

#### `get_canvas_view`

* **Description:** Retrieves a viewport configuration and hydated branch cards matching a specified View ID.
* **Payload / Arguments:** `{ viewId: string }`
* **Response Type:** `{ view: CanvasView, cards: CanvasCard[], edges: TopologyEdge[] }`

#### `update_canvas_viewport`

* **Description:** Persists user panning/zooming metrics into the active view row in SQLite. Throttled on the frontend.
* **Payload / Arguments:** `{ viewId: string, zoomLevel: number, panX: number, panY: number }`
* **Response Type:** `void`

#### `update_card_position`

* **Description:** Commits explicit $(X,Y)$ coordinate shifts to SQLite. Executed **only on mouse drop** to protect database write cycles.
* **Payload / Arguments:** `{ viewId: string, branchId: string, posX: number, posY: number }`
* **Response Type:** `void`

#### `update_card_ui_config`

* **Description:** Updates rendering modes or display cutoffs for an individual branch block.
* **Payload / Arguments:** `{ viewId: string, branchId: string, viewMode: string, commitDensity: number, themeColorHex: string }`
* **Response Type:** `void`

---

### 2.2 Local Git Operations & Write Engine

Triggers native `git2-rs` processes inside the local file system.

#### `get_branch_commits`

* **Description:** Fetches historical commit timeline chunks for a specific branch node using internal virtualized scroll viewports.
* **Payload / Arguments:** `{ branchId: string, limit: number, offset: number }`
* **Response Type:** `GitCommit[]`

#### `execute_git_checkout`

* **Description:** Instructs the Rust backend to checkout a target branch inside its corresponding directory path on disk.
* **Payload / Arguments:** `{ pathId: string, branchName: string }`
* **Response Type:** `{ success: boolean, message: string }`

#### `execute_git_merge`

* **Description:** Executes a local Git merge sequence ($Source \rightarrow Target$). If a conflict strikes, returns metadata fields immediately.
* **Payload / Arguments:** `{ pathId: string, sourceBranch: string, targetBranch: string }`
* **Response Type:** `{ success: boolean, has_conflicts: boolean, conflicting_files: string[] | null }`

---

### 2.3 Repositories Onboarding Hub

Manages path indexing profiles.

#### `register_tracked_path`

* **Description:** Adds an isolated clone directory or worktree path via a native OS file picker.
* **Payload / Arguments:** `{ absolutePath: string, displayName: string }`
* **Response Type:** `TrackedPath`

---

## 3. Tauri Async Events (Rust $\rightarrow$ React)

These events bypass the traditional client invocation structure, pushing background indexing resolutions straight to the UI lifecycle loop without freezing or stuttering the UI thread.

```typescript
import { listen } from '@tauri-apps/api/event';

```

### 3.1 `git-sync::indexing-started`

* **Trigger Event:** Rust background sync worker loop initiates its scan cycle.
* **Payload Data:** `void`
* **Frontend Reaction:** Render a subtle, global loading ticker in the application corner.

### 3.2 `git-sync::updates-available`

* **Trigger Event:** Rust daemon finishes a delta comparison against remotes or detected filesystem edits and pushes data writes directly into SQLite.
* **Payload Data:** ```typescript
{
affected_paths: string[]; // List of tracked_path IDs with new deltas
total_branches_mutated: number;
}
```

```


* **Frontend Reaction:** Under React 19's non-blocking design strategy, the canvas avoids layout-shifting force refreshes. Instead, a custom action notification drops: `"Remote updates available for your working paths. [Refresh Workspace Layout]"` to hand layout stability control fully to the developer.

---

## 4. React 19 Integration Design Note

Because React 19 shifts heavily toward native promise resolution via the `use` hook and transitions via `useTransition`, you should abstract these Tauri invoke requests inside explicit asynchronous resource actions:

```typescript
// Hook example wrapper inside React 19
import { use, useTransition, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function BranchCanvasNode({ viewId, card }: { viewId: string, card: CanvasCard }) {
  const [isPending, startTransition] = useTransition();

  const handleCardDrop = (newX: number, newY: number) => {
    startTransition(async () => {
      // Async Rust update background operation
      await invoke('update_card_position', {
        viewId,
        branchId: card.branch_id,
        posX: newX,
        posY: newY
      });
    });
  };

  return (
    <div style={{ opacity: isPending ? 0.7 : 1 }}>
       {/* Card Node Layout */}
    </div>
  );
}

```

This ensures that canvas dragging, database writing, and async UI hydration operate completely detached from each other, guaranteeing consistent 60 FPS scrolling performance.