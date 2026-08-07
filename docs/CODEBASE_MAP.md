# Codebase Context Snapshot

=========================================
📅 **Snapshot Updated:** Aug 7, 2026, 1:07 AM
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
├── .tmp
│   └── stage-9-benchmark-2000.json
├── img
│   └── dashboard.png
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
│   │   ├── collapsible-panel
│   │   │   └── CollapsiblePanel.tsx
│   │   ├── color-picker
│   │   │   └── ColorPicker.tsx
│   │   ├── database-recovery
│   │   │   ├── DatabaseRecoveryGate.css
│   │   │   └── DatabaseRecoveryGate.tsx
│   │   ├── layout
│   │   │   ├── AppLayout.test.tsx
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── titlebar.css
│   │   │   └── WindowControls.tsx
│   │   ├── Modal
│   │   │   ├── ConfirmationModal.test.tsx
│   │   │   ├── ConfirmationModal.tsx
│   │   │   └── TextInputModal.tsx
│   │   ├── notifications
│   │   │   ├── NotificationDropdown.tsx
│   │   │   ├── NotificationProvider.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toastLifecycle.test.ts
│   │   │   └── toastLifecycle.ts
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
│   │   │   ├── components
│   │   │   │   ├── BranchCard.tsx
│   │   │   │   ├── CommitTimeline.tsx
│   │   │   │   ├── MapToolbar.test.tsx
│   │   │   │   ├── MapToolbar.tsx
│   │   │   │   ├── TagFiltersPopover.tsx
│   │   │   │   ├── ViewActionsDropdown.test.tsx
│   │   │   │   ├── ViewActionsDropdown.tsx
│   │   │   │   ├── ViewSelectorTabs.css
│   │   │   │   ├── ViewSelectorTabs.test.tsx
│   │   │   │   └── ViewSelectorTabs.tsx
│   │   │   ├── viewportSync.test.ts
│   │   │   └── viewportSync.ts
│   │   ├── canvas-views
│   │   │   └── components
│   │   │       ├── canvasViews.css
│   │   │       ├── CreateViewModal.tsx
│   │   │       ├── RepositoryScopeSelector.test.tsx
│   │   │       ├── RepositoryScopeSelector.tsx
│   │   │       ├── scopeSelection.test.ts
│   │   │       ├── scopeSelection.ts
│   │   │       ├── Tabs
│   │   │       │   ├── TabMetadataSettings.tsx
│   │   │       │   └── TabScopeSettings.tsx
│   │   │       ├── ViewDetailsConfigurator.tsx
│   │   │       ├── ViewManagerModal.tsx
│   │   │       ├── ViewManagerSidebar.test.tsx
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
│   │   │   │   │   ├── RepoCardHeader.test.tsx
│   │   │   │   │   ├── RepoCardHeader.tsx
│   │   │   │   │   ├── RepoCardTags.test.tsx
│   │   │   │   │   ├── RepoCardTags.tsx
│   │   │   │   │   ├── RepoGroupMenu.test.tsx
│   │   │   │   │   ├── RepoGroupMenu.tsx
│   │   │   │   │   ├── RepoTagSelectionMenu.test.tsx
│   │   │   │   │   ├── RepoTagSelectionMenu.tsx
│   │   │   │   │   └── RepoThemeModal.tsx
│   │   │   │   ├── RepositoryCard.test.tsx
│   │   │   │   ├── RepositoryCard.tsx
│   │   │   │   └── WorkspaceQuickFilters.tsx
│   │   │   └── hooks
│   │   │       ├── useResolveRepoOrigin.ts
│   │   │       └── useVerifyRepositories.ts
│   │   ├── management
│   │   │   └── components
│   │   │       ├── SettingsManagementModal.test.tsx
│   │   │       └── SettingsManagementModal.tsx
│   │   ├── repository
│   │   │   ├── components
│   │   │   │   ├── AddLocalRepositoryModal.tsx
│   │   │   │   ├── BulkImportLocalRepositryModal.tsx
│   │   │   │   ├── CloneRemoteRepositoryModal.css
│   │   │   │   ├── CloneRemoteRepositoryModal.test.tsx
│   │   │   │   ├── CloneRemoteRepositoryModal.tsx
│   │   │   │   ├── CreateRepositoryModal.tsx
│   │   │   │   ├── RepositoryDropdown.test.tsx
│   │   │   │   ├── RepositoryDropdown.tsx
│   │   │   │   └── RepositoryModalShell.tsx
│   │   │   ├── types
│   │   │   │   └── index.ts
│   │   │   └── utils
│   │   ├── repository-detail
│   │   │   ├── components
│   │   │   │   ├── RepositoryChangeGroup.tsx
│   │   │   │   ├── RepositoryChangesListPanel.tsx
│   │   │   │   ├── RepositoryChangesPreviewPanel.tsx
│   │   │   │   ├── RepositoryCommitComposer.tsx
│   │   │   │   ├── RepositoryDetail.css
│   │   │   │   ├── RepositoryDetail.test.tsx
│   │   │   │   ├── RepositoryDetail.tsx
│   │   │   │   ├── RepositoryDetailBody.test.tsx
│   │   │   │   ├── RepositoryDetailBody.tsx
│   │   │   │   ├── RepositoryDetailChangesTab.test.tsx
│   │   │   │   ├── RepositoryDetailChangesTab.tsx
│   │   │   │   ├── RepositoryDetailCommitsTab.tsx
│   │   │   │   ├── RepositoryDetailHeader.test.tsx
│   │   │   │   ├── RepositoryDetailHeader.tsx
│   │   │   │   └── RepositoryDiffPreview.tsx
│   │   │   ├── hooks
│   │   │   │   ├── useRepositoryChanges.ts
│   │   │   │   ├── useRepositoryFileDiff.ts
│   │   │   │   └── useResizableChangesPanels.ts
│   │   │   └── types
│   │   │       └── repositoryChanges.ts
│   │   └── repository-update-diagnostics
│   │       ├── components
│   │       │   ├── RepositoryUpdateDiagnosticsModal.css
│   │       │   ├── RepositoryUpdateDiagnosticsModal.test.tsx
│   │       │   └── RepositoryUpdateDiagnosticsModal.tsx
│   │       ├── hooks
│   │       │   └── useRepositoryUpdateDiagnostics.ts
│   │       └── types
│   │           └── repositoryUpdateDiagnostics.ts
│   ├── hooks
│   │   ├── useBackdropDismiss.ts
│   │   ├── useClickOutside.ts
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
│   │   ├── workspace-store.test.ts
│   │   ├── workspace-store.ts
│   │   └── workspace-update-sync.test.ts
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
│   │   ├── db.rs
│   │   ├── git.rs
│   │   ├── health.rs
│   │   ├── layout.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── manager.rs
│   │   └── refresh.rs
│   ├── tauri.conf.json
│   ├── tauri.linux.conf.json
│   └── tauri.windows.conf.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest-results.json
├── vitest.config.ts
└── website
    ├── .vitepress
    │   ├── cache
    │   │   └── deps
    │   │       ├── _metadata.json
    │   │       ├── chunk-3ZOBRW44.js
    │   │       ├── chunk-3ZOBRW44.js.map
    │   │       ├── package.json
    │   │       ├── vitepress___@vue_devtools-api.js
    │   │       ├── vitepress___@vue_devtools-api.js.map
    │   │       ├── vitepress___@vueuse_core.js
    │   │       ├── vitepress___@vueuse_core.js.map
    │   │       ├── vue.js
    │   │       └── vue.js.map
    │   ├── config.mts
    │   └── theme
    │       ├── index.ts
    │       └── style.css
    ├── index.md
    ├── package-lock.json
    ├── package.json
    └── vite-env.d.ts
```
