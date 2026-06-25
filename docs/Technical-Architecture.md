# Technical Architecture – SQLite Database Schema Spec

**Module:** Local Data Persistence & Caching Model

**Target Engine:** Tauri SQLite Local Storage (`rusqlite` / `tauri-plugin-sql`)

## 1. Entity Relationship Overview

To prevent heavy disk execution loops on the frontend, SQLite acts as both a **Spatial Layout Registry** and a **Git Metadata Cache**.

```

+------------------+         +--------------------------+
|  tracked_paths   |-------->|   cached_git_branches    |
+------------------+         +--------------------------+
|                                 |
| 1:N                             | 1:N
▼                                 ▼
+------------------+         +--------------------------+
|   canvas_views   |         |    canvas_view_cards     |
+------------------+         +--------------------------+
|                                 ^
| 1:N                             | 1:N
+---------------------------------+

```

---

## 2. Table Schemas & DDL Specifications

### 2.1 Core Tracking Configuration Tables

#### `tracked_paths`

Maps the individual workspace folders registered on the host file system. This table handles the multi-directory parallelism requirement and tracks enhanced homepage classification analytics (e.g., origin provenance types, uncommitted change states, and usage history metrics).

```sql
CREATE TABLE tracked_paths (
    id TEXT PRIMARY KEY NOT NULL,              -- UUID string
    display_name TEXT NOT NULL,                -- e.g., "BranchMap (Main Core)"
    absolute_path TEXT NOT NULL UNIQUE,        -- System path: /Users/user/code/branch-map
    remote_url TEXT,                           -- Remote origin up-stream URL (cached)
    
    -- Enhanced Homepage Analytics & Provenance
    repo_origin_type TEXT NOT NULL DEFAULT 'LOCAL_ONLY', -- 'OWNED', 'FORK', 'LOCAL_ONLY'
    uncommitted_changes_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at DATETIME DEFAULT NULL,                -- Chronological track for Recent Repositories row
    
    is_active INTEGER NOT NULL DEFAULT 1,      -- 1 = Polled by Rust daemon, 0 = Hibernated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME DEFAULT NULL          -- Soft-delete flag
);

CREATE INDEX idx_tracked_paths_active ON tracked_paths(is_active) WHERE archived_at IS NULL;
CREATE INDEX idx_tracked_paths_recent ON tracked_paths(last_viewed_at) WHERE last_viewed_at IS NOT NULL;

```

#### `canvas_views`

Saves independent canvas states. A user can toggle layouts seamlessly without reloading application processes.

```sql
CREATE TABLE canvas_views (
    id TEXT PRIMARY KEY NOT NULL,          -- UUID string
    view_name TEXT NOT NULL,               -- Custom name e.g., "Sprint 3 Feature Map"
    zoom_level REAL NOT NULL DEFAULT 1.0,  -- Clamped between 0.10 and 2.00
    pan_x REAL NOT NULL DEFAULT 0.0,       -- Panning coordinate metrics
    pan_y REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME DEFAULT NULL      -- Soft-delete flag
);

```

---

### 2.2 Git Metadata Cache Layer (Rust Daemon Ingestion)

*Note: The frontend queries these cache layers instantly for 60 FPS performance, while a background Rust process refreshes them asynchronously.*

#### `cached_git_branches`

Tracks unique branches mapped across your file system directories.

```sql
CREATE TABLE cached_git_branches (
    id TEXT PRIMARY KEY NOT NULL,          -- Composite Key or Unique ID
    path_id TEXT NOT NULL,                 -- Relates to tracked_paths
    branch_name TEXT NOT NULL,             -- e.g., "feature/auth"
    is_head INTEGER NOT NULL DEFAULT 0,    -- Is this the actively checked-out branch in that folder?
    ahead_count INTEGER NOT NULL DEFAULT 0,-- Sync Pill Metrics
    behind_count INTEGER NOT NULL DEFAULT 0,
    last_commit_hash TEXT NOT NULL,        -- Pointer to top-of-stream
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(path_id) REFERENCES tracked_paths(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_unique_path_branch ON cached_git_branches(path_id, branch_name);

```

#### `cached_git_commits`

Stores high-density timelines displayed inside Expanded views.

```sql
CREATE TABLE cached_git_commits (
    commit_hash TEXT PRIMARY KEY NOT NULL,
    branch_id TEXT NOT NULL,               -- Parent cache link
    author_name TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    committed_at DATETIME NOT NULL,
    signature_status TEXT DEFAULT 'NONE',  -- GPG/Cryptographic status indicators
    FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
);

```

---

### 2.3 Spatial Layout Mapping Tables (The Canvas Glue)

#### `canvas_view_cards`

Maps decoupled spatial states. This satisfies the requirement that **one branch can live on multiple views simultaneously** with entirely independent coordinates.

```sql
CREATE TABLE canvas_view_cards (
    view_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    pos_x REAL NOT NULL DEFAULT 0.0,
    pos_y REAL NOT NULL DEFAULT 0.0,
    view_mode TEXT NOT NULL DEFAULT 'EXPANDED', -- COMPACT vs EXPANDED
    commit_density INTEGER NOT NULL DEFAULT 5,  -- 3, 5, 10, 15, or -1 (All)
    theme_color_hex TEXT DEFAULT '#4F46E5',    -- Custom Node Color
    PRIMARY KEY (view_id, branch_id),
    FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
);

```

#### `canvas_manual_edges`

Stores user-drawn connections if the underlying Git topology baseline is ambiguous or detached.

```sql
CREATE TABLE canvas_manual_edges (
    id TEXT PRIMARY KEY NOT NULL,
    view_id TEXT NOT NULL,
    source_branch_id TEXT NOT NULL,
    target_branch_id TEXT NOT NULL,
    edge_style TEXT NOT NULL DEFAULT 'BEZIER', -- STRAIGHT vs BEZIER
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(view_id) REFERENCES canvas_views(id) ON DELETE CASCADE,
    FOREIGN KEY(source_branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE,
    FOREIGN KEY(target_branch_id) REFERENCES cached_git_branches(id) ON DELETE CASCADE
);

```

---

## 3. Phase 2.0 Runway (Future Extensibility Plan)

To prevent destructive structural migrations when Phase 2.0 introduces web connectivity, we include a flexible extension design pattern. You can either cleanly append nullable columns or create lean auxiliary mapping engines:

* **Pull Request Tracking:** We can simply append `pr_number INT NULL` and `pr_status TEXT NULL` directly onto the `cached_git_branches` table.
* **CI/CD Build States:** Add a nullable `build_status TEXT` field on the `cached_git_commits` record row.
* **Ecosystem Task Sticky Notes:** Phase 2.0 can implement a distinct `canvas_view_sticky_notes` table to save your dragged GitHub Issue titles, referencing coordinates to track spatial alignments alongside your core code blocks.

---

This schema layout ensures your Rust core (`git2-rs`) and your React 19 UI layers are looking at extremely deterministic, ultra-fast local tables.