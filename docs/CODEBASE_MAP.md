# Codebase Context Snapshot

=========================================
📅 **Snapshot Updated:** Jun 26, 2026, 4:22 PM
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
│   │   │   ├── app-layout.tsx
│   │   │   ├── app-sidebar.css
│   │   │   └── app-sidebar.tsx
│   │   └── notifications
│   │       ├── notification-provider.tsx
│   │       └── toast.tsx
│   ├── features
│   │   ├── branch-map
│   │   │   ├── branch-map.tsx
│   │   │   └── components
│   │   │       ├── branch-card.tsx
│   │   │       ├── commit-timeline.tsx
│   │   │       ├── map-toolbar.tsx
│   │   │       └── view-selector-tabs.tsx
│   │   ├── canvas-views
│   │   │   └── components
│   │   │       ├── Tabs
│   │   │       │   ├── TabMetadataSettings.tsx
│   │   │       │   └── TabScopeSettings.tsx
│   │   │       ├── ViewDetailsConfigurator.tsx
│   │   │       ├── ViewManagerModal.tsx
│   │   │       └── ViewManagerSidebar.tsx
│   │   └── index
│   │       └── components
│   │           ├── Dashboard.css
│   │           ├── DashboardMain.tsx
│   │           └── RepositoryCard.tsx
│   ├── hooks
│   │   └── use-notification-listener.ts
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
│   └── tauri.conf.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```
