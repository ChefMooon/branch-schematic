# UI Component Tree

*Generated from components under `src/features/*/components` and `src/components`.*

## Component Index

## Shared

### ConfirmationModal

- **Path:** `src/components/Modal/ConfirmationModal.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 113
- **Child component imports:** Button
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`

### TextInputModal

- **Path:** `src/components/Modal/TextInputModal.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 129
- **Child component imports:** Button
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`, `useState`

### AppLogo

- **Path:** `src/components/app-logo/AppLogo.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 21
- **Child component imports:** None
- **Hooks consumed:** None

### Button

- **Path:** `src/components/button/Button.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 27
- **Child component imports:** None
- **Hooks consumed:** None

### CollapsiblePanel

- **Path:** `src/components/collapsible-panel/CollapsiblePanel.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 63
- **Child component imports:** None
- **Hooks consumed:** `useState`

### ColorPicker

- **Path:** `src/components/color-picker/ColorPicker.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 72
- **Child component imports:** None
- **Hooks consumed:** `useEffect`, `useMemo`, `useState`

### DatabaseRecoveryGate

- **Path:** `src/components/database-recovery/DatabaseRecoveryGate.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 150
- **Child component imports:** Button, ConfirmationModal
- **Hooks consumed:** `useEffect`, `useState`

### AppLayout

- **Path:** `src/components/layout/AppLayout.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 702
- **Child component imports:** AppSidebar, Button, ImportStatusOverlay, NotificationDropdown, NotificationProvider, ProfileDropdown, ProfileIndicator, RepositoryDropdown, WindowControls, useOnboarding
- **Hooks consumed:** `useCanvasStore`, `useEffect`, `useLayoutThemeMode`, `useLocation`, `useNavigate`, `useNotifications`, `useOS`, `useOnboarding`, `useProfileContext`, `useState`, `useWorkspaceStore`

### AppSidebar

- **Path:** `src/components/layout/AppSidebar.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 162
- **Child component imports:** AppLogo, Button
- **Hooks consumed:** `useLocation`, `useNavigate`

### WindowControls

- **Path:** `src/components/layout/WindowControls.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 84
- **Child component imports:** Button
- **Hooks consumed:** `useOS`

### NotificationDropdown

- **Path:** `src/components/notifications/NotificationDropdown.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 163
- **Child component imports:** Button, NotificationProvider
- **Hooks consumed:** `useEffect`

### NotificationProvider

- **Path:** `src/components/notifications/NotificationProvider.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 318
- **Child component imports:** toast
- **Hooks consumed:** `useAppThemeMode`, `useCallback`, `useContext`, `useEffect`, `useMemo`, `useNotificationListener`, `useNotifications`, `useReducer`, `useRef`, `useState`

### toast

- **Path:** `src/components/notifications/toast.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 99
- **Child component imports:** NotificationProvider
- **Hooks consumed:** None

### PushStatusIndicator

- **Path:** `src/components/push-status-indicator/PushStatusIndicator.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 20
- **Child component imports:** None
- **Hooks consumed:** None

### SearchBar

- **Path:** `src/components/search-bar/SearchBar.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 148
- **Child component imports:** None
- **Hooks consumed:** `useState`

### Tabs

- **Path:** `src/components/tabs/Tabs.tsx`
- **Architecture:** Shared component (Compliant)
- **Lines:** 81
- **Child component imports:** None
- **Hooks consumed:** `useId`, `useRef`

## auth-profile

### OAuthConnectButton

- **Path:** `src/features/auth-profile/components/OAuthConnectButton.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 104
- **Child component imports:** Button
- **Hooks consumed:** `useOAuthFlow`

### ProfileDropdown

- **Path:** `src/features/auth-profile/components/ProfileDropdown.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 407
- **Child component imports:** None
- **Hooks consumed:** `useEffect`, `useState`

### ProfileIndicator

- **Path:** `src/features/auth-profile/components/ProfileIndicator.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 94
- **Child component imports:** None
- **Hooks consumed:** None

### ProfileListItem

- **Path:** `src/features/auth-profile/components/ProfileListItem.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 267
- **Child component imports:** Button
- **Hooks consumed:** `useState`

### ProfileManagementModal

- **Path:** `src/features/auth-profile/components/ProfileManagementModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 904
- **Child component imports:** Button, CollapsiblePanel, ConfirmationModal, OAuthConnectButton, ProfileListItem
- **Hooks consumed:** `useEffect`, `useMemo`, `useProfileStore`, `useState`

## branch-map

### BranchMap

- **Path:** `src/features/branch-map/BranchMap.tsx`
- **Architecture:** Feature (misplaced) component (Violation)
- **Lines:** 314
- **Child component imports:** BranchCard, MapToolbar, ViewSelectorTabs
- **Hooks consumed:** `useAppThemeMode`, `useCanvasStore`, `useEffect`, `useMemo`, `useReactFlow`, `useRef`, `useState`

### BranchCard

- **Path:** `src/features/branch-map/components/BranchCard.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 322
- **Child component imports:** Button, CommitTimeline, RepositoryDetail
- **Hooks consumed:** `useAppThemeMode`, `useCanvasStore`, `useEffect`, `useLocation`, `useRef`, `useResolveCardColor`, `useState`, `useViewport`, `useWorkspaceStore`

### CommitTimeline

- **Path:** `src/features/branch-map/components/CommitTimeline.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 169
- **Child component imports:** None
- **Hooks consumed:** `useEffect`, `useRef`, `useState`

### MapToolbar

- **Path:** `src/features/branch-map/components/MapToolbar.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 190
- **Child component imports:** Button, TagFiltersPopover
- **Hooks consumed:** `useCanvasStore`, `useEffect`, `useMemo`, `useState`, `useViewport`, `useWorkspaceStore`

### TagFiltersPopover

- **Path:** `src/features/branch-map/components/TagFiltersPopover.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 176
- **Child component imports:** Button
- **Hooks consumed:** `useClickOutside`, `useEffect`, `useId`, `useMemo`, `useRef`, `useState`

### ViewActionsDropdown

- **Path:** `src/features/branch-map/components/ViewActionsDropdown.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 615
- **Child component imports:** Button, ConfirmationModal, NotificationProvider, TextInputModal
- **Hooks consumed:** `useCanvasStore`, `useClickOutside`, `useEffect`, `useMemo`, `useNotifications`, `useRef`, `useState`

### ViewSelectorTabs

- **Path:** `src/features/branch-map/components/ViewSelectorTabs.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 279
- **Child component imports:** Button, CreateViewModal, ViewActionsDropdown, ViewManagerModal
- **Hooks consumed:** `useCanvasStore`, `useClickOutside`, `useEffect`, `useMemo`, `useRef`, `useState`, `useViewport`

## canvas-views

### CreateViewModal

- **Path:** `src/features/canvas-views/components/CreateViewModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 307
- **Child component imports:** Button, RepositoryScopeSelector
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`, `useState`

### RepositoryScopeSelector

- **Path:** `src/features/canvas-views/components/RepositoryScopeSelector.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 288
- **Child component imports:** Button, SearchBar
- **Hooks consumed:** `useEffect`, `useMemo`, `useRef`, `useState`

### TabMetadataSettings

- **Path:** `src/features/canvas-views/components/Tabs/TabMetadataSettings.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 128
- **Child component imports:** Button
- **Hooks consumed:** `useCanvasStore`, `useEffect`, `useMemo`, `useState`, `useViewport`

### TabScopeSettings

- **Path:** `src/features/canvas-views/components/Tabs/TabScopeSettings.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 300
- **Child component imports:** RepositoryScopeSelector
- **Hooks consumed:** `useCanvasStore`, `useEffect`, `useRef`, `useState`

### ViewDetailsConfigurator

- **Path:** `src/features/canvas-views/components/ViewDetailsConfigurator.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 71
- **Child component imports:** TabMetadataSettings, TabScopeSettings, Tabs
- **Hooks consumed:** `useState`

### ViewManagerModal

- **Path:** `src/features/canvas-views/components/ViewManagerModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 245
- **Child component imports:** Button, ConfirmationModal, TextInputModal, ViewDetailsConfigurator, ViewManagerSidebar
- **Hooks consumed:** `useBackdropDismiss`, `useCanvasStore`, `useEffect`, `useMemo`, `useRef`, `useState`

### ViewManagerSidebar

- **Path:** `src/features/canvas-views/components/ViewManagerSidebar.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 216
- **Child component imports:** Button
- **Hooks consumed:** `useState`

## dashboard

### BulkActionToolbar

- **Path:** `src/features/dashboard/components/BulkActionToolbar.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 80
- **Child component imports:** Button, ConfirmationModal
- **Hooks consumed:** `useState`

### DashboardMain

- **Path:** `src/features/dashboard/components/DashboardMain.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 377
- **Child component imports:** BulkActionToolbar, FilterDropdown, NotificationProvider, RepoThemeModal, RepositoryCard, RepositoryCardSkeleton, SearchBar, WorkspaceQuickFilters
- **Hooks consumed:** `useEffect`, `useMemo`, `useNotifications`, `useProfileStore`, `useRef`, `useResolveRepoOrigin`, `useState`, `useVerifyRepositories`, `useWorkspaceStore`

### RepositoryCard

- **Path:** `src/features/dashboard/components/RepositoryCard.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 634
- **Child component imports:** Button, ConfirmationModal, NotificationProvider, PushStatusIndicator, RepoBranchDropdown, RepoCardHeader, RepoCardTags, RepoGroupMenu, RepoTagSelectionMenu, RepoThemeModal, RepositoryDetail
- **Hooks consumed:** `useEffect`, `useLocation`, `useMemo`, `useNotifications`, `useRepoOriginBadgeState`, `useResolveRepoOrigin`, `useState`, `useWorkspaceStore`

### AliasEditPopover

- **Path:** `src/features/dashboard/components/RepositoryCard/AliasEditPopover.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 105
- **Child component imports:** None
- **Hooks consumed:** `useEffect`, `useRef`

### RepoBranchDropdown

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoBranchDropdown.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 229
- **Child component imports:** None
- **Hooks consumed:** `useClickOutside`, `useEffect`, `useRef`, `useState`

### RepoCardActionMenu

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoCardActionMenu.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 416
- **Child component imports:** ConfirmationModal, NotificationProvider, OpenWithModal, RepoThemeModal
- **Hooks consumed:** `useLayoutEffect`, `useNotifications`, `useRef`, `useRepositoryOpenActions`, `useState`

### RepoCardHeader

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoCardHeader.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 148
- **Child component imports:** AliasEditPopover, RepoCardActionMenu
- **Hooks consumed:** None

### RepoCardTags

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoCardTags.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 226
- **Child component imports:** None
- **Hooks consumed:** `useEffect`, `useMemo`, `useRef`, `useState`

### RepoGroupMenu

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoGroupMenu.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 209
- **Child component imports:** Button, TextInputModal
- **Hooks consumed:** `useEffect`, `useRef`, `useState`

### RepoTagSelectionMenu

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoTagSelectionMenu.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 342
- **Child component imports:** Button, ConfirmationModal, NotificationProvider, SearchBar
- **Hooks consumed:** `useBackdropDismiss`, `useCallback`, `useEffect`, `useMemo`, `useNotifications`, `useRef`, `useState`

### RepoThemeModal

- **Path:** `src/features/dashboard/components/RepositoryCard/RepoThemeModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 141
- **Child component imports:** Button, ColorPicker, IconSelector
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`, `useState`

### RepositoryCardSkeleton

- **Path:** `src/features/dashboard/components/RepositoryCardSkeleton.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 27
- **Child component imports:** None
- **Hooks consumed:** None

### WorkspaceQuickFilters

- **Path:** `src/features/dashboard/components/WorkspaceQuickFilters.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 176
- **Child component imports:** ConfirmationModal, FilterDropdown, NotificationProvider
- **Hooks consumed:** `useGroupOptions`, `useMemo`, `useNotifications`, `useState`

### FilterDropdown

- **Path:** `src/features/dashboard/components/common/FilterDropdown.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 197
- **Child component imports:** None
- **Hooks consumed:** `useClickOutside`, `useEffect`, `useId`, `useMemo`, `useRef`, `useState`

## icon

### IconSelector

- **Path:** `src/features/icon/components/IconSelector.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 49
- **Child component imports:** None
- **Hooks consumed:** None

## management

### SettingsManagementModal

- **Path:** `src/features/management/components/SettingsManagementModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 747
- **Child component imports:** Button, ConfirmationModal, NotificationProvider
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useMemo`, `useNotifications`, `useRef`, `useState`

## onboarding

### OnboardingPresentation

- **Path:** `src/features/onboarding/components/OnboardingPresentation.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 164
- **Child component imports:** Button, useOnboarding
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useOnboarding`, `useRef`

### useOnboarding

- **Path:** `src/features/onboarding/hooks/useOnboarding.tsx`
- **Architecture:** Feature (misplaced) component (Violation)
- **Lines:** 120
- **Child component imports:** None
- **Hooks consumed:** `useContext`, `useEffect`, `useMemo`, `useOnboarding`, `useState`

## repository

### AddLocalRepositoryModal

- **Path:** `src/features/repository/components/AddLocalRepositoryModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 154
- **Child component imports:** Button, NotificationProvider, RepositoryModalShell
- **Hooks consumed:** `useEffect`, `useNotifications`, `useState`, `useWorkspaceStore`

### ApplicationImportRecoveryModal

- **Path:** `src/features/repository/components/ApplicationImportRecoveryModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 113
- **Child component imports:** Button, RepositoryModalShell
- **Hooks consumed:** `useState`, `useWorkspaceStore`

### BulkImportLocalRepositryModal

- **Path:** `src/features/repository/components/BulkImportLocalRepositryModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 296
- **Child component imports:** Button, NotificationProvider, RepositoryModalShell
- **Hooks consumed:** `useEffect`, `useImportStore`, `useNotifications`, `useState`, `useWorkspaceStore`

### CloneRemoteRepositoryModal

- **Path:** `src/features/repository/components/CloneRemoteRepositoryModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 1530
- **Child component imports:** Button, NotificationProvider, RepositoryModalShell, SearchBar
- **Hooks consumed:** `useCallback`, `useDebouncedValue`, `useEffect`, `useGithubRepositories`, `useMemo`, `useNotifications`, `useProfileContext`, `useRef`, `useState`, `useWorkspaceStore`

### CreateRepositoryModal

- **Path:** `src/features/repository/components/CreateRepositoryModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 201
- **Child component imports:** Button, RepositoryModalShell
- **Hooks consumed:** `useEffect`, `useState`, `useWorkspaceStore`

### ImportStatusOverlay

- **Path:** `src/features/repository/components/ImportStatusOverlay.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 95
- **Child component imports:** Button
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useImportStore`, `useRef`, `useState`

### RepositoryDropdown

- **Path:** `src/features/repository/components/RepositoryDropdown.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 147
- **Child component imports:** Button
- **Hooks consumed:** `useEffect`, `useRef`, `useState`

### RepositoryModalShell

- **Path:** `src/features/repository/components/RepositoryModalShell.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 157
- **Child component imports:** Button
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`

## repository-detail

### RepositoryChangeGroup

- **Path:** `src/features/repository-detail/components/RepositoryChangeGroup.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 107
- **Child component imports:** None
- **Hooks consumed:** None

### RepositoryChangesListPanel

- **Path:** `src/features/repository-detail/components/RepositoryChangesListPanel.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 119
- **Child component imports:** Button, RepositoryChangeGroup
- **Hooks consumed:** None

### RepositoryChangesPreviewPanel

- **Path:** `src/features/repository-detail/components/RepositoryChangesPreviewPanel.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 66
- **Child component imports:** RepositoryDiffPreview
- **Hooks consumed:** None

### RepositoryCommitComposer

- **Path:** `src/features/repository-detail/components/RepositoryCommitComposer.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 111
- **Child component imports:** Button
- **Hooks consumed:** None

### RepositoryDetail

- **Path:** `src/features/repository-detail/components/RepositoryDetail.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 216
- **Child component imports:** RepositoryDetailBody, RepositoryDetailHeader
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useMemo`, `useRef`, `useState`

### RepositoryDetailBody

- **Path:** `src/features/repository-detail/components/RepositoryDetailBody.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 52
- **Child component imports:** RepositoryDetail, RepositoryDetailChangesTab, RepositoryDetailCommitsTab
- **Hooks consumed:** None

### RepositoryDetailChangesTab

- **Path:** `src/features/repository-detail/components/RepositoryDetailChangesTab.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 129
- **Child component imports:** RepositoryChangesListPanel, RepositoryChangesPreviewPanel, RepositoryCommitComposer
- **Hooks consumed:** `useEffect`, `useMemo`, `useRepositoryChanges`, `useRepositoryFileDiff`, `useResizableChangesPanels`, `useState`

### RepositoryDetailCommitsTab

- **Path:** `src/features/repository-detail/components/RepositoryDetailCommitsTab.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 140
- **Child component imports:** Button, PushStatusIndicator, RepositoryDetail
- **Hooks consumed:** None

### RepositoryDetailHeader

- **Path:** `src/features/repository-detail/components/RepositoryDetailHeader.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 168
- **Child component imports:** Button, Tabs
- **Hooks consumed:** `useClickOutside`, `useEffect`, `useRef`, `useState`

### RepositoryDiffPreview

- **Path:** `src/features/repository-detail/components/RepositoryDiffPreview.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 121
- **Child component imports:** None
- **Hooks consumed:** None

## repository-open

### OpenWithModal

- **Path:** `src/features/repository-open/components/OpenWithModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 175
- **Child component imports:** Button
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useRef`, `useState`

## repository-update-diagnostics

### RepositoryUpdateDiagnosticsModal

- **Path:** `src/features/repository-update-diagnostics/components/RepositoryUpdateDiagnosticsModal.tsx`
- **Architecture:** Feature component (Compliant)
- **Lines:** 194
- **Child component imports:** Button, SearchBar
- **Hooks consumed:** `useBackdropDismiss`, `useEffect`, `useMemo`, `useRef`, `useRepositoryUpdateDiagnostics`, `useState`, `useWorkspaceStore`

## Architecture Rule Findings

Components violating feature-boundary or placement conventions:

- `src/features/branch-map/BranchMap.tsx`: Feature (misplaced)
- `src/features/onboarding/hooks/useOnboarding.tsx`: Feature (misplaced)

## Large/Complex Components

Components over 150 lines or with more than 5 internal sub-imports:

- `src/components/layout/AppLayout.tsx`: over 150 lines and over 5 internal sub-imports
- `src/components/layout/AppSidebar.tsx`: over 150 lines
- `src/components/notifications/NotificationDropdown.tsx`: over 150 lines
- `src/components/notifications/NotificationProvider.tsx`: over 150 lines
- `src/features/auth-profile/components/ProfileDropdown.tsx`: over 150 lines
- `src/features/auth-profile/components/ProfileListItem.tsx`: over 150 lines
- `src/features/auth-profile/components/ProfileManagementModal.tsx`: over 150 lines
- `src/features/branch-map/BranchMap.tsx`: over 150 lines
- `src/features/branch-map/components/BranchCard.tsx`: over 150 lines
- `src/features/branch-map/components/CommitTimeline.tsx`: over 150 lines
- `src/features/branch-map/components/MapToolbar.tsx`: over 150 lines
- `src/features/branch-map/components/TagFiltersPopover.tsx`: over 150 lines
- `src/features/branch-map/components/ViewActionsDropdown.tsx`: over 150 lines
- `src/features/branch-map/components/ViewSelectorTabs.tsx`: over 150 lines
- `src/features/canvas-views/components/CreateViewModal.tsx`: over 150 lines
- `src/features/canvas-views/components/RepositoryScopeSelector.tsx`: over 150 lines
- `src/features/canvas-views/components/Tabs/TabScopeSettings.tsx`: over 150 lines
- `src/features/canvas-views/components/ViewManagerModal.tsx`: over 150 lines
- `src/features/canvas-views/components/ViewManagerSidebar.tsx`: over 150 lines
- `src/features/dashboard/components/DashboardMain.tsx`: over 150 lines and over 5 internal sub-imports
- `src/features/dashboard/components/RepositoryCard.tsx`: over 150 lines and over 5 internal sub-imports
- `src/features/dashboard/components/RepositoryCard/RepoBranchDropdown.tsx`: over 150 lines
- `src/features/dashboard/components/RepositoryCard/RepoCardActionMenu.tsx`: over 150 lines
- `src/features/dashboard/components/RepositoryCard/RepoCardTags.tsx`: over 150 lines
- `src/features/dashboard/components/RepositoryCard/RepoGroupMenu.tsx`: over 150 lines
- `src/features/dashboard/components/RepositoryCard/RepoTagSelectionMenu.tsx`: over 150 lines
- `src/features/dashboard/components/WorkspaceQuickFilters.tsx`: over 150 lines
- `src/features/dashboard/components/common/FilterDropdown.tsx`: over 150 lines
- `src/features/management/components/SettingsManagementModal.tsx`: over 150 lines
- `src/features/onboarding/components/OnboardingPresentation.tsx`: over 150 lines
- `src/features/repository-detail/components/RepositoryDetail.tsx`: over 150 lines
- `src/features/repository-detail/components/RepositoryDetailHeader.tsx`: over 150 lines
- `src/features/repository-open/components/OpenWithModal.tsx`: over 150 lines
- `src/features/repository-update-diagnostics/components/RepositoryUpdateDiagnosticsModal.tsx`: over 150 lines
- `src/features/repository/components/AddLocalRepositoryModal.tsx`: over 150 lines
- `src/features/repository/components/BulkImportLocalRepositryModal.tsx`: over 150 lines
- `src/features/repository/components/CloneRemoteRepositoryModal.tsx`: over 150 lines
- `src/features/repository/components/CreateRepositoryModal.tsx`: over 150 lines
- `src/features/repository/components/RepositoryModalShell.tsx`: over 150 lines

