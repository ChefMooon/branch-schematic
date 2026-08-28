# Codebase Context Snapshot

## Key Dependencies

- `@tauri-apps/api`: ^2
- `@tauri-apps/cli`: ^2
- `react`: ^19.1.0
- `react-dom`: ^19.1.0
- `vite`: ^7.0.4
- `vitest`: ^2.1.4

## Project Structure

```text
branch-schematic/
├── .env
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── deploy-docs.yml
├── .gitignore
├── .tanstack/
│   └── tmp/
├── .tmp/
│   └── stage-9-benchmark-2000.json
├── .vscode/
│   ├── extensions.json
│   └── tasks.json
├── arch-report.config.json
├── arch-snap.json
├── img/
│   └── dashboard.png
├── index.html
├── package-lock.json
├── package.json
├── public/
│   └── logo.svg
├── README.md
├── scripts/
│   ├── analyze-bundle.js
│   ├── benchmark-repository-update.js
│   └── evaluate-rollout.js
├── src/
│   ├── App.css
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── app-logo/
│   │   │   └── AppLogo.tsx
│   │   ├── button/
│   │   │   ├── Button.css
│   │   │   └── Button.tsx
│   │   ├── collapsible-panel/
│   │   │   └── CollapsiblePanel.tsx
│   │   ├── color-picker/
│   │   │   └── ColorPicker.tsx
│   │   ├── database-recovery/
│   │   │   ├── DatabaseRecoveryGate.css
│   │   │   └── DatabaseRecoveryGate.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.test.tsx
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── titlebar.css
│   │   │   └── WindowControls.tsx
│   │   ├── Modal/
│   │   │   ├── ConfirmationModal.test.tsx
│   │   │   ├── ConfirmationModal.tsx
│   │   │   ├── TextInputModal.test.tsx
│   │   │   └── TextInputModal.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationDropdown.tsx
│   │   │   ├── NotificationProvider.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toastLifecycle.test.ts
│   │   │   └── toastLifecycle.ts
│   │   ├── push-status-indicator/
│   │   │   ├── PushStatusIndicator.css
│   │   │   └── PushStatusIndicator.tsx
│   │   ├── resize-divider/
│   │   │   ├── ResizeDivider.css
│   │   │   ├── ResizeDivider.test.tsx
│   │   │   └── ResizeDivider.tsx
│   │   ├── search-bar/
│   │   │   ├── SearchBar.css
│   │   │   ├── SearchBar.test.tsx
│   │   │   └── SearchBar.tsx
│   │   └── tabs/
│   │       ├── Tabs.css
│   │       ├── Tabs.test.tsx
│   │       └── Tabs.tsx
│   ├── features/
│   │   ├── auth-profile/
│   │   │   ├── components/
│   │   │   │   ├── OAuthConnectButton.tsx
│   │   │   │   ├── ProfileDropdown.test.tsx
│   │   │   │   ├── ProfileDropdown.tsx
│   │   │   │   ├── ProfileIndicator.tsx
│   │   │   │   ├── ProfileListItem.test.tsx
│   │   │   │   ├── ProfileListItem.tsx
│   │   │   │   ├── ProfileManagementModal.test.tsx
│   │   │   │   └── ProfileManagementModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOAuthFlow.ts
│   │   │   │   └── useProfileContext.ts
│   │   │   ├── stores/
│   │   │   │   ├── profileStore.test.ts
│   │   │   │   └── profileStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       └── profileAvatar.ts
│   │   ├── branch-map/
│   │   │   ├── BranchMap.tsx
│   │   │   ├── components/
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
│   │   ├── canvas-views/
│   │   │   └── components/
│   │   │       ├── canvasViews.css
│   │   │       ├── CreateViewModal.tsx
│   │   │       ├── RepositoryScopeSelector.test.tsx
│   │   │       ├── RepositoryScopeSelector.tsx
│   │   │       ├── scopeSelection.test.ts
│   │   │       ├── scopeSelection.ts
│   │   │       ├── Tabs/
│   │   │       │   ├── TabMetadataSettings.tsx
│   │   │       │   └── TabScopeSettings.tsx
│   │   │       ├── ViewDetailsConfigurator.tsx
│   │   │       ├── ViewManagerModal.tsx
│   │   │       ├── ViewManagerSidebar.test.tsx
│   │   │       └── ViewManagerSidebar.tsx
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── BulkActionToolbar.tsx
│   │   │   │   ├── common/
│   │   │   │   │   ├── FilterDropdown.module.css
│   │   │   │   │   ├── FilterDropdown.test.tsx
│   │   │   │   │   ├── FilterDropdown.tsx
│   │   │   │   │   └── useGroupOptions.ts
│   │   │   │   ├── Dashboard.css
│   │   │   │   ├── DashboardMain.test.tsx
│   │   │   │   ├── DashboardMain.tsx
│   │   │   │   ├── RepositoryCard/
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
│   │   │   │   │   ├── RepoThemeModal.test.tsx
│   │   │   │   │   └── RepoThemeModal.tsx
│   │   │   │   ├── RepositoryCard.test.tsx
│   │   │   │   ├── RepositoryCard.tsx
│   │   │   │   ├── RepositoryCardSkeleton.tsx
│   │   │   │   └── WorkspaceQuickFilters.tsx
│   │   │   └── hooks/
│   │   │       ├── useResolveRepoOrigin.ts
│   │   │       └── useVerifyRepositories.ts
│   │   ├── github-auth/
│   │   │   ├── api/
│   │   │   ├── hooks/
│   │   │   │   ├── useGithubRepositories.test.tsx
│   │   │   │   └── useGithubRepositories.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── icon/
│   │   │   ├── components/
│   │   │   │   └── IconSelector.tsx
│   │   │   └── utils/
│   │   │       └── iconRegistry.ts
│   │   ├── management/
│   │   │   └── components/
│   │   │       ├── SettingsManagementModal.test.tsx
│   │   │       └── SettingsManagementModal.tsx
│   │   ├── onboarding/
│   │   │   ├── components/
│   │   │   │   ├── OnboardingPresentation.css
│   │   │   │   ├── OnboardingPresentation.test.tsx
│   │   │   │   └── OnboardingPresentation.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useOnboarding.test.tsx
│   │   │   │   └── useOnboarding.tsx
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── repository/
│   │   │   ├── components/
│   │   │   │   ├── AddLocalRepositoryModal.test.tsx
│   │   │   │   ├── AddLocalRepositoryModal.tsx
│   │   │   │   ├── ApplicationImportRecoveryModal.tsx
│   │   │   │   ├── BulkImportLocalRepositoryModal.test.tsx
│   │   │   │   ├── BulkImportLocalRepositryModal.tsx
│   │   │   │   ├── CloneRemoteRepositoryModal.css
│   │   │   │   ├── CloneRemoteRepositoryModal.test.tsx
│   │   │   │   ├── CloneRemoteRepositoryModal.tsx
│   │   │   │   ├── CreateRepositoryModal.tsx
│   │   │   │   ├── ImportStatusOverlay.tsx
│   │   │   │   ├── RepositoryDropdown.test.tsx
│   │   │   │   ├── RepositoryDropdown.tsx
│   │   │   │   └── RepositoryModalShell.tsx
│   │   │   ├── stores/
│   │   │   │   ├── import-store.test.ts
│   │   │   │   └── import-store.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   ├── repository-detail/
│   │   │   ├── components/
│   │   │   │   ├── RepositoryChangeGroup.tsx
│   │   │   │   ├── RepositoryChangesListPanel.tsx
│   │   │   │   ├── RepositoryChangesPreviewPanel.tsx
│   │   │   │   ├── RepositoryCommitComposer.tsx
│   │   │   │   ├── RepositoryCommitDiffPanel.tsx
│   │   │   │   ├── RepositoryCommitFilesPanel.tsx
│   │   │   │   ├── RepositoryDetail.css
│   │   │   │   ├── RepositoryDetail.test.tsx
│   │   │   │   ├── RepositoryDetail.tsx
│   │   │   │   ├── RepositoryDetailActionsMenu.test.tsx
│   │   │   │   ├── RepositoryDetailActionsMenu.tsx
│   │   │   │   ├── RepositoryDetailBody.test.tsx
│   │   │   │   ├── RepositoryDetailBody.tsx
│   │   │   │   ├── RepositoryDetailChangesTab.test.tsx
│   │   │   │   ├── RepositoryDetailChangesTab.tsx
│   │   │   │   ├── RepositoryDetailCommitsTab.test.tsx
│   │   │   │   ├── RepositoryDetailCommitsTab.tsx
│   │   │   │   ├── RepositoryDetailHeader.test.tsx
│   │   │   │   ├── RepositoryDetailHeader.tsx
│   │   │   │   └── RepositoryDiffPreview.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCommitChangedFiles.test.ts
│   │   │   │   ├── useCommitChangedFiles.ts
│   │   │   │   ├── useCommitFileDiff.test.ts
│   │   │   │   ├── useCommitFileDiff.ts
│   │   │   │   ├── useRepositoryChanges.ts
│   │   │   │   └── useRepositoryFileDiff.ts
│   │   │   └── types/
│   │   │       └── repositoryChanges.ts
│   │   ├── repository-open/
│   │   │   ├── components/
│   │   │   │   └── OpenWithModal.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useRepositoryOpenActions.ts
│   │   │   ├── repositoryOpenApi.ts
│   │   │   └── types.ts
│   │   └── repository-update-diagnostics/
│   │       ├── components/
│   │       │   ├── RepositoryUpdateDiagnosticsModal.css
│   │       │   ├── RepositoryUpdateDiagnosticsModal.test.tsx
│   │       │   └── RepositoryUpdateDiagnosticsModal.tsx
│   │       ├── hooks/
│   │       │   └── useRepositoryUpdateDiagnostics.ts
│   │       └── types/
│   │           └── repositoryUpdateDiagnostics.ts
│   ├── hooks/
│   │   ├── useBackdropDismiss.ts
│   │   ├── useClickOutside.ts
│   │   ├── useNotificationListener.ts
│   │   ├── useOS.ts
│   │   ├── useResizablePanels.test.ts
│   │   └── useResizablePanels.ts
│   ├── lib/
│   │   └── db.ts
│   ├── main.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── about.tsx
│   │   ├── branch-map.tsx
│   │   ├── database.tsx
│   │   ├── index.tsx
│   │   └── settings.tsx
│   ├── routeTree.gen.ts
│   ├── stores/
│   │   ├── canvas-store.ts
│   │   ├── workspace-store.test.ts
│   │   ├── workspace-store.ts
│   │   └── workspace-update-sync.test.ts
│   ├── test/
│   │   └── setup.ts
│   ├── theme.ts
│   ├── types/
│   │   └── git.ts
│   └── vite-env.d.ts
├── src-tauri/
│   ├── .cargo/
│   │   └── config.toml
│   ├── .gitignore
│   ├── 2
│   ├── build.rs
│   ├── capabilities/
│   │   ├── default.json
│   │   └── desktop.json
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── examples/
│   ├── gen/
│   │   └── schemas/
│   │       ├── acl-manifests.json
│   │       ├── capabilities.json
│   │       ├── desktop-schema.json
│   │       └── windows-schema.json
│   ├── icons/
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── 32x32.png
│   │   ├── 64x64.png
│   │   ├── android/
│   │   │   ├── mipmap-anydpi-v26/
│   │   │   │   └── ic_launcher.xml
│   │   │   ├── mipmap-hdpi/
│   │   │   │   ├── ic_launcher.png
│   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   └── ic_launcher_round.png
│   │   │   ├── mipmap-mdpi/
│   │   │   │   ├── ic_launcher.png
│   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   └── ic_launcher_round.png
│   │   │   ├── mipmap-xhdpi/
│   │   │   │   ├── ic_launcher.png
│   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   └── ic_launcher_round.png
│   │   │   ├── mipmap-xxhdpi/
│   │   │   │   ├── ic_launcher.png
│   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   └── ic_launcher_round.png
│   │   │   ├── mipmap-xxxhdpi/
│   │   │   │   ├── ic_launcher.png
│   │   │   │   ├── ic_launcher_foreground.png
│   │   │   │   └── ic_launcher_round.png
│   │   │   └── values/
│   │   │       └── ic_launcher_background.xml
│   │   ├── icon.icns
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   ├── ios/
│   │   │   ├── AppIcon-20x20@1x.png
│   │   │   ├── AppIcon-20x20@2x-1.png
│   │   │   ├── AppIcon-20x20@2x.png
│   │   │   ├── AppIcon-20x20@3x.png
│   │   │   ├── AppIcon-29x29@1x.png
│   │   │   ├── AppIcon-29x29@2x-1.png
│   │   │   ├── AppIcon-29x29@2x.png
│   │   │   ├── AppIcon-29x29@3x.png
│   │   │   ├── AppIcon-40x40@1x.png
│   │   │   ├── AppIcon-40x40@2x-1.png
│   │   │   ├── AppIcon-40x40@2x.png
│   │   │   ├── AppIcon-40x40@3x.png
│   │   │   ├── AppIcon-512@2x.png
│   │   │   ├── AppIcon-60x60@2x.png
│   │   │   ├── AppIcon-60x60@3x.png
│   │   │   ├── AppIcon-76x76@1x.png
│   │   │   ├── AppIcon-76x76@2x.png
│   │   │   └── AppIcon-83.5x83.5@2x.png
│   │   ├── Square107x107Logo.png
│   │   ├── Square142x142Logo.png
│   │   ├── Square150x150Logo.png
│   │   ├── Square284x284Logo.png
│   │   ├── Square30x30Logo.png
│   │   ├── Square310x310Logo.png
│   │   ├── Square44x44Logo.png
│   │   ├── Square71x71Logo.png
│   │   ├── Square89x89Logo.png
│   │   └── StoreLogo.png
│   ├── src/
│   │   ├── auth.rs
│   │   ├── db.rs
│   │   ├── git.rs
│   │   ├── health.rs
│   │   ├── layout.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── manager.rs
│   │   ├── refresh.rs
│   │   └── repository_open.rs
│   ├── tauri.conf.json
│   ├── tauri.linux.conf.json
│   └── tauri.windows.conf.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest-results.json
├── vitest.config.ts
└── website/
    ├── .vitepress/
    │   ├── cache/
    │   │   └── deps/
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
    │   └── theme/
    │       ├── index.ts
    │       └── style.css
    ├── docs/
    │   ├── branch-map.md
    │   ├── dashboard.md
    │   ├── index.md
    │   └── releases.md
    ├── index.md
    ├── package-lock.json
    ├── package.json
    ├── public/
    │   ├── favicon.ico
    │   └── favicon.svg
    └── vite-env.d.ts
```

