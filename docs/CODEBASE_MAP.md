# Codebase Context Snapshot

=========================================
📅 **Snapshot Updated:** Jul 3, 2026, 11:42 AM
📦 **Key Dependencies:**
  - `react`: ^19.1.0
  - `react-dom`: ^19.1.0
  - `@tauri-apps/api`: ^2
  - `@tauri-apps/plugin-sql`: ^2.4.0
=========================================


## 📂 Project Structure
```text
branch-schematic/
├── .env
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
│   │   ├── app-logo
│   │   │   └── AppLogo.tsx
│   │   ├── color-picker
│   │   │   └── ColorPicker.tsx
│   │   ├── layout
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.css
│   │   │   └── AppSidebar.tsx
│   │   ├── Modal
│   │   │   ├── ConfirmationModal.tsx
│   │   │   └── TagSelectionModal.tsx
│   │   ├── notifications
│   │   │   ├── NotificationDropdown.tsx
│   │   │   ├── NotificationProvider.tsx
│   │   │   └── toast.tsx
│   │   └── titlebar
│   │       └── WindowControls.tsx
│   ├── features
│   │   ├── auth-profile
│   │   │   ├── components
│   │   │   │   ├── OAuthConnectButton.tsx
│   │   │   │   ├── ProfileDropdown.tsx
│   │   │   │   ├── ProfileIndicator.tsx
│   │   │   │   └── ProfileManagementModal.tsx
│   │   │   ├── hooks
│   │   │   │   ├── useOAuthFlow.ts
│   │   │   │   └── useProfileContext.ts
│   │   │   ├── stores
│   │   │   │   └── profileStore.ts
│   │   │   ├── types
│   │   │   │   └── index.ts
│   │   │   └── utils
│   │   │       └── profileAvatar.ts
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
│   │   ├── icon
│   │   │   ├── components
│   │   │   │   └── IconSelector.tsx
│   │   │   └── utils
│   │   │       └── iconRegistry.ts
│   │   ├── index
│   │   │   └── components
│   │   │       ├── BulkActionToolbar.tsx
│   │   │       ├── Dashboard.css
│   │   │       ├── DashboardMain.tsx
│   │   │       ├── RepositoryCard
│   │   │       │   ├── AliasEditPopover.tsx
│   │   │       │   ├── RepoCardActionMenu.tsx
│   │   │       │   ├── RepoCardHeader.tsx
│   │   │       │   ├── RepoCardTags.tsx
│   │   │       │   ├── RepoGroupMenu.tsx
│   │   │       │   └── RepoThemeModal.tsx
│   │   │       ├── RepositoryCard.tsx
│   │   │       └── WorkspaceQuickFilters.tsx
│   │   ├── management
│   │   │   └── components
│   │   │       └── SettingsManagementModal.tsx
│   │   └── repository
│   │       ├── components
│   │       │   ├── AddLocalRepositoryModal.tsx
│   │       │   ├── BulkImportLocalRepositryModal.tsx
│   │       │   ├── CreateRepositoryModal.tsx
│   │       │   ├── RepositoryDropdown.tsx
│   │       │   └── RepositoryModalShell.tsx
│   │       └── types
│   │           └── index.ts
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
│   ├── examples
│   ├── gen
│   │   └── schemas
│   │       ├── acl-manifests.json
│   │       ├── capabilities.json
│   │       ├── desktop-schema.json
│   │       └── windows-schema.json
│   ├── src
│   │   ├── auth.rs
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
