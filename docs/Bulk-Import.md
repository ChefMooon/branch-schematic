# Bulk Import Crawler

This note captures the ProjectCrawler flow that was added for bulk repository import so it can be reintroduced later as an additional import path.

## Goal

Allow a user to:
1. pick a root folder,
2. scan that tree for Git repositories,
3. preview discovered repositories,
4. select which ones to import,
5. add the selected repositories into the current workspace.

## Current implementation shape

The flow spans three layers:
- React UI in [src/features/tracked-projects/components/ProjectCrawler.tsx](../src/features/tracked-projects/components/ProjectCrawler.tsx)
- State orchestration in [src/features/tracked-projects/hooks/useTrackedPaths.ts](../src/features/tracked-projects/hooks/useTrackedPaths.ts)
- Tauri/Rust commands in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) and [src-tauri/src/git.rs](../src-tauri/src/git.rs)

## UI contract

The component expects the following props:

```ts
type ProjectCrawlerProps = {
  isRunning: boolean;
  error: string | null;
  items: DiscoveredRepo[];
  selectedPaths: Record<string, boolean>;
  isWorkspaceReady: boolean;
  workspaceHelperText?: string | null;
  onRunPreview: (rootPath: string, maxDepth: number) => void;
  onSelectionChange: (path: string, selected: boolean) => void;
  onClearSelection: () => void;
  onCommit: () => void;
};
```

The UI behavior is:
- root path input + folder picker,
- max depth input,
- Preview button to trigger scanning,
- Clear button to reset selection,
- Import selected button to add chosen repositories to the workspace.

## Minimal component skeleton

```tsx
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from '@phosphor-icons/react';
import type { DiscoveredRepo } from '../types';

export function ProjectCrawler({
  isRunning,
  error,
  items,
  selectedPaths,
  isWorkspaceReady,
  workspaceHelperText,
  onRunPreview,
  onSelectionChange,
  onClearSelection,
  onCommit,
}: ProjectCrawlerProps) {
  const [rootPath, setRootPath] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);

  const handlePickDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Folder to Scan',
      });

      if (typeof selectedPath === 'string') {
        setRootPath(selectedPath);
      }
    } catch (err) {
      console.error('Failed to select crawler folder:', err);
    }
  };

  return (
    <section>
      <h2>Bulk import crawler</h2>
      <p>Scan a folder tree for Git repositories and import the ones you want.</p>

      <label>
        Root path
        <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} />
        <button type="button" onClick={handlePickDirectory}>Pick folder</button>
      </label>

      <label>
        Max depth
        <input type="number" min={1} max={6} value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} />
      </label>

      <div>
        <button type="button" onClick={() => onRunPreview(rootPath, maxDepth)} disabled={isRunning || !rootPath || !isWorkspaceReady}>
          Preview
        </button>
        <button type="button" onClick={onClearSelection} disabled={items.length === 0}>
          Clear
        </button>
        <button type="button" onClick={onCommit} disabled={items.length === 0 || !isWorkspaceReady}>
          Import selected
        </button>
      </div>

      {!isWorkspaceReady ? <p>{workspaceHelperText ?? 'Select or create a workspace before importing repositories.'}</p> : null}
      {error ? <p>{error}</p> : null}

      {items.length === 0 ? (
        <p>No preview results yet. Run a scan to populate this list.</p>
      ) : (
        <div>
          {items.map((item) => (
            <label key={item.absolute_path}>
              <input
                type="checkbox"
                checked={Boolean(selectedPaths[item.absolute_path])}
                onChange={(event) => onSelectionChange(item.absolute_path, event.target.checked)}
              />
              <span>{item.display_name}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
```

## State and hook behavior

The hook needs a preview state plus three actions:

```ts
interface CrawlerPreviewState {
  items: DiscoveredRepo[];
  selectedPaths: Record<string, boolean>;
  isRunning: boolean;
  error: string | null;
}
```

Key methods:

```ts
runCrawlerPreview(rootPath, maxDepth)
```
- calls the Rust command `crawl_repositories_command`
- maps results to selected items by default
- stores them in preview state

```ts
togglePreviewSelection(path, selected)
```
- updates the selection map for the preview list

```ts
commitSelectedPreviewPaths()
```
- filters the preview list down to selected items
- calls `add_new_tracked_path` once per selected repository
- resets preview state and reloads tracked paths

## Types needed

```ts
export interface DiscoveredRepo {
  id?: string;
  display_name: string;
  absolute_path: string;
  is_git_repository: boolean;
  depth?: number;
  selected?: boolean;
}

export interface CrawlerPreviewState {
  items: DiscoveredRepo[];
  selectedPaths: Record<string, boolean>;
  isRunning: boolean;
  error: string | null;
}
```

## Rust side

The existing implementation uses two commands:

```rs
#[tauri::command]
fn crawl_repositories_command(root_path: String, max_depth: u32) -> Result<Vec<git::DiscoveredRepo>, String> {
    git::crawl_repositories(&root_path, max_depth)
}
```

and the import step uses:

```rs
pub async fn add_new_tracked_path(
    state: tauri::State<'_, DbState>,
    absolute_path: String,
    workspace_id: Option<String>,
) -> Result<(), String> {
    // existing tracked path insertion flow
}
```

The crawler logic itself lives in [src-tauri/src/git.rs](../src-tauri/src/git.rs) and is already structured to be reused.

## Re-integration checklist

To add this feature again later, wire it in this order:

1. Add the shared types to [src/features/tracked-projects/types/index.ts](../src/features/tracked-projects/types/index.ts).
2. Add the preview and commit methods to [src/features/tracked-projects/hooks/useTrackedPaths.ts](../src/features/tracked-projects/hooks/useTrackedPaths.ts).
3. Drop in [src/features/tracked-projects/components/ProjectCrawler.tsx](../src/features/tracked-projects/components/ProjectCrawler.tsx).
4. Render the component from [src/features/tracked-projects/TrackedProjectsPage.tsx](../src/features/tracked-projects/TrackedProjectsPage.tsx) beside the existing workspace/tracked path UI.
5. Ensure the current workspace is selected before committing imports.

## Recommended placement

If this should become a first-class import option, the cleanest re-add point is the tracked-projects page, where the workspace context and repository list already exist.

## Notes

This is intentionally structured as an additional import path rather than a replacement for existing repository import flows. That keeps it easy to enable or disable later without changing the core tracked-projects experience.
