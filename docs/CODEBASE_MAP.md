# Codebase Context Snapshot

=========================================
📅 **Snapshot Updated:** Jun 29, 2026, 9:54 PM
📦 **Key Dependencies:**
  - `react`: ^19.1.0
  - `react-dom`: ^19.1.0
  - `@tauri-apps/api`: ^2
  - `@tauri-apps/plugin-sql`: ^2.4.0
=========================================


## 📂 Project Structure
```text
branch-schematic/
├── .gitignore
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── src
│   ├── App.css
│   ├── assets
│   │   └── react.svg
│   ├── components
│   │   ├── layout
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.css
│   │   │   └── AppSidebar.tsx
│   │   ├── Modal
│   │   │   └── TagSelectionModal.tsx
│   │   ├── notifications
│   │   │   ├── NotificationProvider.tsx
│   │   │   └── Toast.tsx
│   │   └── titlebar
│   │       └── WindowControls.tsx
│   ├── features
│   │   ├── branch-map
│   │   │   ├── branch-map.tsx
│   │   │   └── components
│   │   │       ├── BranchCard.tsx
│   │   │       ├── CommitTimeline.tsx
│   │   │       ├── MapToolbar.tsx
│   │   │       ├── ViewActionsDropdown.tsx
│   │   │       └── ViewSelectorTabs.tsx
│   │   ├── canvas-views
│   │   │   └── components
│   │   │       ├── CreateViewModal.tsx
│   │   │       ├── RepositoryScopeRow.tsx
│   │   │       ├── Tabs
│   │   │       │   ├── TabMetadataSettings.tsx
│   │   │       │   └── TabScopeSettings.tsx
│   │   │       ├── ViewDetailsConfigurator.tsx
│   │   │       ├── ViewManagerModal.tsx
│   │   │       └── ViewManagerSidebar.tsx
│   │   ├── index
│   │   │   └── components
│   │   │       ├── Dashboard.css
│   │   │       ├── DashboardMain.tsx
│   │   │       ├── RepositoryCard
│   │   │       │   ├── AliasEditPopover.tsx
│   │   │       │   ├── RepoCardHeader.tsx
│   │   │       │   └── RepoCardTags.tsx
│   │   │       ├── RepositoryCard.tsx
│   │   │       └── WorkspaceQuickFilters.tsx
│   │   └── management
│   │       └── components
│   │           └── SettingsManagementModal.tsx
│   ├── hooks
│   │   ├── useNotificationListener.ts
│   │   └── useOS.ts
│   ├── lib
│   │   └── db.ts
│   ├── main.tsx
│   ├── routes
│   │   ├── __root.tsx
│   │   ├── about.tsx
│   │   ├── branch-map.tsx
│   │   ├── database.tsx
│   │   ├── index.tsx
│   │   └── settings.tsx
│   ├── routeTree.gen.ts
│   ├── stores
│   │   ├── canvas-store.ts
│   │   └── workspace-store.ts
│   ├── theme.ts
│   ├── types
│   │   └── git.ts
│   └── vite-env.d.ts
├── src-tauri
│   ├── .gitignore
│   ├── 2
│   ├── build.rs
│   ├── capabilities
│   │   ├── default.json
│   │   └── desktop.json
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── gen
│   │   └── schemas
│   │       ├── acl-manifests.json
│   │       ├── capabilities.json
│   │       ├── desktop-schema.json
│   │       └── windows-schema.json
│   ├── src
│   │   ├── daemon.rs
│   │   ├── db.rs
│   │   ├── git.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── tauri.conf.json
│   ├── tauri.linux.conf.json
│   └── tauri.windows.conf.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
