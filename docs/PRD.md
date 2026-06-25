# Product Requirements Document (PRD)

## Project Name: Branch Map
**Author:** Branch Schematic
**Version:** 1.0 (Finalized MVP Specification)
**Stack:** Tauri (Rust), React 19, Tauri SQLite (Local-First Storage)
## 1. Product Overview & Objectives
Branch Map is a local-first desktop application that transforms complex Git repositories, multi-directory workspaces, and cross-project dependencies into an interactive, visual blueprint. Unlike traditional linear Git clients, Branch Map provides an infinite canvas environment where developers can visualize branch lineages across multiple repositories and isolated working directories simultaneously, track commit streams, measure sync deltas against remotes, and execute write-level Git commands directly from a spatial node interface.

### Core Value Propositions

- **Multi-Directory Spatial Architecture:** Track and visualize multiple parallel instances of the same repository checked out to separate local paths (Worktrees/isolated clones) seamlessly on a single workspace.
    
- **Bi-Directional Canvas Operations:** Interact with Git visually. Trigger checkouts, clone actions, branches, merges, stashes, and remote updates by manipulating nodes.
    
- **Hybrid Lineage Rendering:** Automatically compute genealogical graphs via Git topology matching while giving users the freedom to draw manual visual connections.
    
- **Local-First Safety Net:** Completely telemetry-free application featuring local OS credential passthroughs and database-backed soft-delete restoration protection.
    

## 2. Functional Requirements: Phase 1.0 (MVP)

### Module 1: Infinite Canvas & Environment

- **Spatial Navigation:**
    
    - Omnidirectional panning via Right-Click/Middle-Click drag or two-finger trackpad swipe.
        
    - Zooming anchored precisely to the user's cursor position, clamped between $10\%$ and $200\%$.
        
- **Visual Helpers:**
    
    - A scalable background dot-grid that dynamically adjusts density or fades out depending on the zoom depth.
        
    - Floating Canvas Utility Toolbar: Zoom In, Zoom Out, Reset ($100\%$), and Fit to Screen (bounds all active canvas elements).
        

### Module 2: Visual Git Cards (Branch Nodes)

- **Metadata Profile:** Each card represents an actual Git branch tracking `id`, underlying target `directory_path_id`, `position (X, Y)`, `title`, `status` badge (including a structural pointer showing which card represents the live active `HEAD` of that folder instance), and localized configurations.
    
- **Internal Commits Viewport:** * Cards enforce uniform structural widths to guarantee layout predictability.
    
    - Long commit streams are scrolled internally via a virtualized viewport.
        
    - **Density Toggles:** Users can cap visible commit rows to 3, 5, 10, 15, or "All".
        
- **Level of Detail (LoD) Rendering:**
    
    - **Bird's-Eye ($10\% - 49\%$):** Hides text metadata, rendering only Card Titles, Working Directory Tags, Sync Pill Badges, and Custom Hex Themes.
        
    - **Mid-Range ($50\% - 99\%$):** Commits collapse into high-density abstract graphical shapes without text rendering.
        
    - **Close-Up ($100\% - 200\%$):** Full detail rendering including complete commit messages, timestamps, author names, hashes, and cryptographic signing states.
        

### Module 3: Relational Pipelines (Hybrid Edge Engine) & Local Milestones

- **Automated Topology Generation:** Relational edge pipelines default to programmatic graph generation. The Rust backend uses Git topology mapping (e.g., finding the closest common ancestor commit merge base) to render arrows from parent to child branches.
    
- **Manual Connection Overrides:** If the repository topology is ambiguous or detached, users can manually click-and-drag connection handles between cards to establish a custom structural dependency line on the canvas. These manual links are saved directly to SQLite.
    
- **Cross-Repo Visual Grouping:** Visual markers distinguish branch networks belonging to different projects or separate physical file system paths sharing the same canvas workspace.
    
- **Local Milestones (Tags):** Local Git tags are parsed and rendered as permanent vertical timeline flag markers slicing down across the infinite canvas, providing a visual baseline for code releases completely offline.
    

### Module 4: Canvas Execution Engine (Git Local & Drive Actions)

Branch Map is a live operational environment supporting multi-directory mutations:

- **Clone & Target Management:** Users can clone a new remote repository into a designated local folder, or establish an isolated parallel checkout folder (e.g., Git Worktree) directly from the application interface.
    
- **Branch Mechanics:** Right-clicking a commit node or branch card provides context menus to `Create Branch`, `Checkout` (updating the specific file state of that node's folder instance on disk), `Rename`, or `Delete`.
    
- **Visual Lineage Operations:** Context menus and visual interactions allow users to run local `Merge`, `Rebase`, or `Cherry-Pick` sequences via the backend.
    
- **Workspace Staging Sidebar:** A unified control panel allows users to view current file modifications, stage changes, commit updates locally, and track/pop `Stash` stacks per repository/directory path.
    

### Module 5: Canvas "Views" Management

- **Data Model Isolation:** SQLite schemas decouple physical Git data from visual layout mappings. A single branch can exist across multiple views concurrently with independent spatial coordinates.
    
- **View Manifests:** Each View saves:
    
    - Assigned active directory instances and branch selections.
        
    - Exact zoom coefficient and panning center values.
        
    - Layout states (Custom Theme Accent Colors, View Modes, and Commit Density configurations).
        
- **Lifecycle:** Features to initialize a blank workspace, "Duplicate View As", or **Soft-Delete** a View. Soft-deleted items map to an `archived_at` timestamp state, allowing immediate canvas recovery/undo functionality.
    

### Module 6: Tracked Projects Hub

- **Repository Registration:** Onboard specific development environments via local OS file pickers or execute an automated directory crawl (e.g., scan `~/Code/` to a configurable directory depth) to register target `.git` locations.
    
- **Multi-Path Instances:** System supports tracking multiple separate folder paths associated with the same target codebase.
    
- **Resource Optimization ("Active" Flag):** A Boolean switch marks paths as inactive. Inactive configurations are skipped by automated background indexers, freeing processing loops on massive development environments.
    
- **Soft-Delete Safe Purging:** Dropping a project/path from the dashboard sets an inactive state flag. Layout metadata is retained safely in SQLite until a user explicitly triggers a "Hard Purge Cache" option. The host machine's physical file system directories are never touched.
    

## 3. Technical & Native Architecture

### 3.1 Data Flow & IPC Bridge Diagram

```
+-------------------------------------------------------------------------+
|                            REACT 19 FRONTEND                            |
|  - Infinite Canvas (Zustand / HTML5 Canvas or React Flow)              |
|  - Async State & Mutators (React 19 Hooks, use Transition)              |
+-------------------------------------------------------------------------+
                                  │
             Tauri IPC Bridge (invoke / tauri::command)
                                  ▼
+-------------------------------------------------------------------------+
|                           TAURI RUST BACKEND                            |
|  - Multi-Threaded Sync Executor Engine                                  |
|  - Core Git Operations Layer (git2-rs / Libgit2 bindings)               |
+-------------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------------+
|                          LOCAL STORAGE SCHEMA                           |
|  - SQLite (Spatial views, custom overrides, path mappings, metadata)    |
+-------------------------------------------------------------------------+
```

### 3.2 Background Sync & UI Hydration

- **Rust Daemon Indexer:** Runs concurrent background threads checking registered active paths for local/remote alterations at user-defined cadences (5m, 15m, 1h, or manual).
    
- **Non-Intrusive Mutation Hydration:** Background synchronization drops updates directly into SQLite and sends a global Tauri event payload to the frontend. If the user is on the active workspace, changes do not force-reload the layout. Instead, a clean notification banner alerts the user: `"Remote updates detected for 3 branches. [Refresh View]"`, preserving canvas stability during deep workflows.
    

### 3.3 Security, Authentication & Credential Pipeline

- **Native Hooking Architecture:** Bypasses custom external OAuth redirection loops or plaintext password storage. The application layer depends entirely on the executing host machine's configurations.
    
- **SSH Agent Routing:** Remote networking commands (such as `git fetch` or `push`) route signature processing requests directly through active system SSH profiles (`id_ed25519`, `id_rsa`) via local socket handshakes.
    
- **OS Keychain Integration:** HTTPS remote credentials use global Git helper wrappers via `auth-git2`, communicating with macOS Keychain Access, Windows Credential Manager, or Linux Secret Service API blocks securely.
    
- **Subprocess Sidecar Fallback:** For enterprise VPN structures, hardware keys (YubiKeys), or advanced Multi-Factor Authentication (MFA), the engine drops safely into a native terminal subprocess call. This forces the OS to manage authentication prompts in a secure system dialogue before handing resolution states back to Tauri cleanly.
    

## 4. Non-Functional Requirements & Performance Targets

- **Database Query Performance:** Visual layout indexes, manual edges, and spatial table lookups must compile 5,000+ branch layout nodes inside $< 30\text{ms}$.
    
- **Canvas Execution Rendering:** Canvas rendering loops must scale efficiently, leveraging Level of Detail optimizations to maintain a smooth 60 FPS profile during rapid pan/zoom interactions.
    
- **Absolute Isolation:** Application remains completely local-first. No cloud telemetries, metrics collection, or remote analytical tracking lines are permitted. All data belongs exclusively to the end-user.
    

## 5. Future Scope & Runway: Phase 2.0 Features (External Platforms Engine)

- **PR Status Indicators:** Query the GitHub/GitLab APIs asynchronously to identify if an active branch has an associated open Pull Request.
    
- **Extended Sync Pill Badge:** Upgrade the 2-part Sync Pill (`⇡ 2 | ⇣ 0`) into an integrated 3-part spatial pill containing the interactive PR link (e.g., `[ ⇡ 2 | ⇣ 0 | PR #42 ]`).
    
- **Visual Conflict Warnings:** Fetch GitHub's pre-calculated mergeability state. If a PR contains an active conflict with its target base, the relational edge pipeline connecting the two cards will illuminate in a distinct warning state (e.g., dashed red stroke).
    
- **Ecosystem Task & Issue Integrations:** Regex branch text parsing matches issue identifiers to dynamically generate sticky task cards that can be arranged on the infinite canvas.
    
- **CI/CD Pipeline Tracking:** Enrich close-up commit viewport nodes with live GitHub Actions or GitLab CI statuses.