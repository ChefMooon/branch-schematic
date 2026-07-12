# Codebase Context Snapshot

=========================================
📅 **Snapshot Updated:** Jul 12, 2026, 10:18 AM
📦 **Key Dependencies:**
  - `react`: ^19.1.0
  - `react-dom`: ^19.1.0
  - `@tauri-apps/api`: ^2
  - `@tauri-apps/plugin-sql`: ^2.4.0
=========================================


> 🔄 **To Regenerate This File:** If files or folders have changed, run:
> ```bash
> npm run docs:code
> ```

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
│   │   ├── button
│   │   │   ├── Button.css
│   │   │   └── Button.tsx
│   │   ├── color-picker
│   │   │   └── ColorPicker.tsx
│   │   ├── layout
│   │   │   ├── AppLayout.test.tsx
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── titlebar.css
│   │   │   └── WindowControls.tsx
│   │   ├── Modal
│   │   │   ├── ConfirmationModal.tsx
│   │   │   └── TextInputModal.tsx
│   │   ├── notifications
│   │   │   ├── NotificationDropdown.tsx
│   │   │   ├── NotificationProvider.tsx
│   │   │   └── toast.tsx
│   │   └── search-bar
│   │       ├── SearchBar.css
│   │       ├── SearchBar.test.tsx
│   │       └── SearchBar.tsx
│   ├── features
│   │   ├── auth-profile
│   │   │   ├── components
│   │   │   │   ├── OAuthConnectButton.tsx
│   │   │   │   ├── ProfileDropdown.test.tsx
│   │   │   │   ├── ProfileDropdown.tsx
│   │   │   │   ├── ProfileIndicator.tsx
│   │   │   │   ├── ProfileListItem.test.tsx
│   │   │   │   ├── ProfileListItem.tsx
│   │   │   │   ├── ProfileManagementModal.test.tsx
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
│   │   │   ├── BranchMap.tsx
│   │   │   └── components
│   │   │       ├── BranchCard.tsx
│   │   │       ├── CommitTimeline.tsx
│   │   │       ├── MapToolbar.tsx
│   │   │       ├── ViewActionsDropdown.test.tsx
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
│   │   ├── github-auth
│   │   │   ├── api
│   │   │   │   ├── fetchInstallations.test.ts
│   │   │   │   ├── fetchInstallations.ts
│   │   │   │   ├── fetchPublicCollaboratorRepositories.test.ts
│   │   │   │   ├── fetchPublicCollaboratorRepositories.ts
│   │   │   │   ├── fetchRepositories.test.ts
│   │   │   │   ├── fetchRepositories.ts
│   │   │   │   └── githubClient.ts
│   │   │   ├── hooks
│   │   │   │   ├── useGithubRepositories.test.tsx
│   │   │   │   └── useGithubRepositories.ts
│   │   │   └── types
│   │   │       └── index.ts
│   │   ├── icon
│   │   │   ├── components
│   │   │   │   └── IconSelector.tsx
│   │   │   └── utils
│   │   │       └── iconRegistry.ts
│   │   ├── index
│   │   │   ├── components
│   │   │   │   ├── BulkActionToolbar.tsx
│   │   │   │   ├── common
│   │   │   │   │   ├── FilterDropdown.module.css
│   │   │   │   │   ├── FilterDropdown.test.tsx
│   │   │   │   │   ├── FilterDropdown.tsx
│   │   │   │   │   └── useGroupOptions.ts
│   │   │   │   ├── Dashboard.css
│   │   │   │   ├── DashboardMain.test.tsx
│   │   │   │   ├── DashboardMain.tsx
│   │   │   │   ├── RepositoryCard
│   │   │   │   │   ├── AliasEditPopover.tsx
│   │   │   │   │   ├── menuPosition.test.ts
│   │   │   │   │   ├── menuPosition.ts
│   │   │   │   │   ├── RepoBranchDropdown.tsx
│   │   │   │   │   ├── RepoCardActionMenu.tsx
│   │   │   │   │   ├── RepoCardHeader.tsx
│   │   │   │   │   ├── RepoCardTags.tsx
│   │   │   │   │   ├── RepoGroupMenu.tsx
│   │   │   │   │   ├── RepoTagSelectionMenu.tsx
│   │   │   │   │   └── RepoThemeModal.tsx
│   │   │   │   ├── RepositoryCard.tsx
│   │   │   │   └── WorkspaceQuickFilters.tsx
│   │   │   └── hooks
│   │   │       └── useResolveRepoOrigin.ts
│   │   ├── management
│   │   │   └── components
│   │   │       └── SettingsManagementModal.tsx
│   │   └── repository
│   │       ├── components
│   │       │   ├── AddLocalRepositoryModal.tsx
│   │       │   ├── BulkImportLocalRepositryModal.tsx
│   │       │   ├── CloneRemoteRepositoryModal.css
│   │       │   ├── CloneRemoteRepositoryModal.test.tsx
│   │       │   ├── CloneRemoteRepositoryModal.tsx
│   │       │   ├── CreateRepositoryModal.tsx
│   │       │   ├── RepositoryDropdown.test.tsx
│   │       │   ├── RepositoryDropdown.tsx
│   │       │   └── RepositoryModalShell.tsx
│   │       ├── types
│   │       │   └── index.ts
│   │       └── utils
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
│   ├── test
│   │   └── setup.ts
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
├── vite.config.ts
├── vitest-results.json
└── vitest.config.ts
```
