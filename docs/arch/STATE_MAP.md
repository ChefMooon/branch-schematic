# State Management Map

## Feature: auth-profile

### useProfileStore

- **Location:** `src/features/auth-profile/stores/profileStore.ts`
- **Exported Hook:** `useProfileStore`

#### State Keys & Types

| State Key | Type |
| --- | --- |
| `profiles` | `UserProfile[]` |
| `activeProfileId` | `string \| null` |
| `tokenHealthMap` | `Record<string, TokenHealthStatus>` |
| `isHydrated` | `boolean` |
| `isLoading` | `boolean` |
| `error` | `string \| null` |

#### Actions / Reducers

- `hydrateProfiles`: `() => Promise<void>`
- `selectProfile`: `(profileId: string | null) => void`
- `addProfile`: `(profile: Partial<UserProfile>) => Promise<UserProfile>`
- `updateProfile`: `(profileId: string, changes: Partial<UserProfile>) => Promise<UserProfile | null>`
- `deleteProfile`: `(profileId: string) => Promise<void>`
- `setTokenHealth`: `(profileId: string, status: TokenHealthStatus) => void`
- `refreshTokenHealth`: `() => Promise<void>`

## Feature: repository

### useImportStore

- **Location:** `src/features/repository/stores/import-store.ts`
- **Exported Hook:** `useImportStore`

#### State Keys & Types

| State Key | Type |
| --- | --- |
| `job` | `ImportJob \| null` |

#### Actions / Reducers

- `startImport`: `(items: Array<{ path: string; displayName: string }>) => Promise<ImportJob>`
- `cancelImport`: `() => void`
- `retryFailed`: `() => Promise<ImportJob | null>`
- `clearJob`: `() => void`

## Global / Common Stores

### useCanvasStore

- **Location:** `src/stores/canvas-store.ts`
- **Exported Hook:** `useCanvasStore`

#### State Keys & Types

| State Key | Type |
| --- | --- |
| `views` | `CanvasViewRecord[]` |
| `archivedViews` | `CanvasViewRecord[]` |
| `activeViewId` | `string \| null` |
| `isBranchMapActive` | `boolean` |
| `isViewHydrating` | `boolean` |
| `sessionViewportByViewId` | `Record<string, ViewportState>` |
| `openedViewIds` | `Record<string, boolean>` |
| `nodes` | `BranchCardNode[]` |
| `edges` | `Edge[]` |
| `activeTagFilters` | `string[]` |
| `onNodesChange` | `OnNodesChange<BranchCardNode>` |
| `onEdgesChange` | `OnEdgesChange` |
| `onConnect` | `OnConnect` |
| `onEdgeClick` | `EdgeMouseHandler` |
| `canUndoSavedCardLocationRestore` | `boolean` |
| `savedCardLocationUndo` | `{ viewId: string; locations: SavedCardLocation[] } \| null` |

#### Actions / Reducers

- `setNodes`: `(nodes: BranchCardNode[]) => void`
- `setEdges`: `(edges: Edge[]) => void`
- `toggleTagFilter`: `(tagId: string) => void`
- `clearTagFilters`: `() => void`
- `setActiveView`: `(viewId: string) => Promise<void>`
- `createNewView`: `(options: { name: string; isFavorite?: boolean; viewportDefaults?: { zoomLevel: number; panX: number; panY: number }; scope?: { visiblePathIds?: string[]; branchVisibility?: Record<string, string[]> } }) => Promise<void>`
- `duplicateView`: `(sourceId: string, newName: string) => Promise<void>`
- `deleteView`: `(viewId: string) => Promise<void>`
- `hydrateArchivedViews`: `() => Promise<void>`
- `restoreView`: `(viewId: string) => Promise<void>`
- `purgeView`: `(viewId: string) => Promise<void>`
- `renameView`: `(viewId: string, name: string) => Promise<void>`
- `setViewFavorite`: `(viewId: string, favorite: boolean) => Promise<void>`
- `moveViewOrder`: `(viewId: string, direction: -1 | 1) => Promise<void>`
- `togglePathVisibility`: `(viewId: string, repoPathId: string, visible: boolean) => Promise<CanvasViewScopeState | null>`
- `toggleBranchVisibility`: `(viewId: string, branchId: string, visible: boolean) => Promise<CanvasViewScopeState | null>`
- `setCanvasViewScope`: `(viewId: string, pathVisibility: Record<string, boolean>, branchVisibility: Record<string, boolean>, options?: { hydrate?: boolean }) => Promise<CanvasViewScopeState | null>`
- `setRepositoryScope`: `(viewId: string, repoPathId: string, visible: boolean, branchVisibility: Record<string, boolean>) => Promise<CanvasViewScopeState | null>`
- `snapshotBaselineViewport`: `(viewId: string, zoom: number, x: number, y: number) => Promise<void>`
- `saveCardState`: `(viewId: string, cardStateJson: string) => Promise<void>`
- `getSavedCardLocationSnapshot`: `(viewId: string) => SavedCardLocationSnapshot | null`
- `restoreSavedCardLocations`: `(viewId: string) => Promise<boolean>`
- `undoSavedCardLocationRestore`: `() => Promise<boolean>`
- `invalidateSavedCardLocationUndo`: `() => void`
- `initializeBranchMapSession`: `() => Promise<void>`
- `hydrateViewsList`: `() => Promise<void>`
- `hydrateWorkspaceNodes`: `(options?: { preserveInMemoryPositions?: boolean }) => Promise<void>`
- `setBranchMapActive`: `(active: boolean) => Promise<void>`
- `clearActiveViewVisibility`: `() => Promise<void>`
- `updateNodeConfig`: `(repoPathId: string, viewMode: 'COMPACT' | 'EXPANDED', density: number, hex: string, explodeBranches: boolean) => Promise<void>`
- `removeManualEdge`: `(edgeId: string) => Promise<void>`
- `saveViewport`: `(zoom: number, x: number, y: number) => Promise<void>`

### useWorkspaceStore

- **Location:** `src/stores/workspace-store.ts`
- **Exported Hook:** `useWorkspaceStore`

#### State Keys & Types

| State Key | Type |
| --- | --- |
| `repos` | `TrackedPath[]` |
| `archivedRepos` | `ArchivedTrackedRepository[]` |
| `activeRepoId` | `string \| null` |
| `isHydrated` | `boolean` |
| `isLoading` | `boolean` |
| `error` | `string \| null` |
| `quickFilterMetadata` | `QuickFilterMetadata \| null` |
| `groupDirectory` | `GroupSummary[]` |
| `tagDirectory` | `TagFilterSummary[]` |

#### Actions / Reducers

- `hydrateFromBackend`: `() => Promise<void>`
- `hydrateArchivedRepositories`: `() => Promise<void>`
- `repairHiddenRepositories`: `() => Promise<number>`
- `subscribeToWorkspaceUpdates`: `() => Promise<() => void>`
- `hydrateQuickFilterMetadata`: `() => Promise<void>`
- `hydrateManagementDirectory`: `() => Promise<void>`
- `selectRepo`: `(repo: TrackedPath | null) => void`
- `setRepos`: `(repos: TrackedPath[]) => void`
- `addRepo`: `(repo: TrackedPath) => void`
- `reconcileImportedRepository`: `(result: RepositoryTrackResult) => void`
- `removeRepo`: `(repoId: string) => void`
- `restoreRepository`: `(repoId: string) => Promise<void>`
- `purgeRepository`: `(repoId: string) => Promise<void>`
- `setRepositoryFavorite`: `(repoId: string, favorite: boolean) => Promise<void>`
- `setRepositoryPinned`: `(repoId: string, pinned: boolean) => Promise<void>`
- `setRepositoryGroup`: `(repoId: string, groupId: string | null) => Promise<void>`
- `updateRepositoryTheme`: `(id: string, colorHex: string | null, iconName: string | null) => Promise<void>`
- `applyThemeToRepositories`: `(ids: string[], colorHex: string | null, iconName: string | null) => Promise<BulkThemeUpdateResult>`
- `refreshRepositoryGitStatus`: `(repoId: string, absolutePath: string) => Promise<void>`
- `relinkRepositoryPath`: `(repoId: string, absolutePath: string) => Promise<void>`
- `setRepositoriesStatus`: `(repoIds: string[], status: TrackedPath['status']) => void`
- `markRepositoriesMissing`: `(missingPaths: string[]) => void`
- `markRepositoryResolved`: `(repoId: string, nextAbsolutePath?: string) => void`
- `addTag`: `(repoId: string, tagName: string, colorHex?: string) => Promise<void>`
- `removeTag`: `(repoId: string, tagName: string) => Promise<void>`
- `touchLastAccessed`: `(repoId: string) => Promise<void>`
- `createCustomGroup`: `(groupName: string, colorHex?: string) => Promise<string | null>`
- `createGlobalTag`: `(tagName: string, colorHex?: string) => Promise<string | null>`
- `updateCustomGroup`: `(id: string, groupName: string, colorHex: string) => Promise<void>`
- `deleteCustomGroup`: `(id: string) => Promise<void>`
- `updateGlobalTag`: `(id: string, tagName: string, colorHex: string) => Promise<void>`
- `deleteGlobalTag`: `(id: string) => Promise<void>`
- `cleanupDanglingTags`: `() => Promise<number>`
- `getUniqueTags`: `() => RepoTag[]`
- `getCustomGroups`: `() => GroupSummary[]`


