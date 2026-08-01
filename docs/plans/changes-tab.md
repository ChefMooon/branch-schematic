# Repository Changes Tab Plan

## Goal
Create a repository-focused changes experience inside the repository detail view that lets a user understand what has changed in the selected repository, stage or unstage files, preview diffs, and create a commit from the UI.

## Desired User Experience
The page should feel like a lightweight but polished Git change workspace.

### Left panel: file list
- Show grouped sections in this order:
  1. Staged changes
  2. Changes (unstaged)
  3. Untracked files
  4. Conflicts
- Each item should show:
  - file path
  - change type (modified, added, deleted, renamed, untracked)
  - optional status badge
- The list should support:
  - collapsing/expanding each group
  - selecting a file to preview its diff
  - quick stage/unstage actions per file
  - hover-reveal actions on each file row for stage/revert operations
- The left and right panels should be resizable so users can make the file list wider or narrower depending on their workflow.
- In the Changes (unstaged) group, include a bulk action button to stage all unstaged changes.
- In the Untracked files group, include a bulk action button to add all untracked files to the staging area.
- The commit composer should live at the bottom of the left panel so the file list and commit workflow remain in one place.

### Right panel: diff preview
- When a file is selected, show its diff content in a read-only preview area.
- At the top of the preview panel, include a compact header with:
  - the currently selected file path on the left
  - a small settings dropdown on the right that opens a popover for preview options
- The preview options should start with two modes:
  - unified view
  - split view
- The diff preview should display line numbers for the file content being shown.
- Prefer a simple, readable layout first:
  - file header
  - added/removed lines
  - optional hunk context
- For the first pass, a plain text diff view is sufficient, with the view mode switchable from the header settings popover.

### Commit composer
- Provide a compact composer at the bottom or side of the page:
  - commit title input
  - commit message textarea
  - commit button
- Validation should prevent empty commits.
- If there are no staged changes, the UI should clearly explain that a commit cannot be created yet.

## Recommended Interaction Model
1. Load the repository’s current Git state.
2. Display grouped changed files.
3. Let the user stage or unstage individual files.
4. Let the user preview the selected file’s diff.
5. Let the user enter a commit title/message and create the commit.

## Best Possible MVP Scope
This should be implemented as a focused first version that is useful immediately.

### Included in MVP
- View all changed files for the selected repository
- Group them into staged changes, unstaged changes, untracked files, and conflicts
- Stage and unstage individual files
- Show hover-reveal actions on each file row for staging or reverting changes
- Stage all unstaged changes from the group action
- Add all untracked files from the group action
- Preview diff for the selected file
- Create a commit with a title and body
- Refresh the changes view after actions complete

### Deferred for later
- Inline line-by-line patch editing
- Drag-and-drop staging
- Discard changes per file
- Partial staging of hunks
- Conflict resolution UI
- Commit history integration inside the same page

### Suggested future enhancements
- Allow users to discard changes for a single file
- Open the selected file in the default editor from the UI
- Surface conflict status clearly when a merge is in progress

## Technical Approach
This fits naturally into the current app architecture.

### Resizable layout
A resizable split view is possible and fits well with a React + CSS implementation.

Recommended pattern:
- Use a two-column layout with a fixed draggable divider between the panels.
- Track the current split width in component state.
- Update the left panel width as the user drags the divider.
- Clamp the width to sensible minimum and maximum values so the UI never becomes unusable.

This can be implemented in one of two ways:
1. A lightweight custom component that listens to mouse drag events.
2. A CSS grid layout with a draggable handle and a small stateful width value.

For this app, the first option is likely the best fit because it keeps the implementation local to the changes tab and avoids unnecessary complexity.

### Backend
Use the Tauri/Rust side to expose Git operations through commands rather than shelling out directly from the UI.

Recommended backend commands:
- get_repository_changes
  - returns structured file-level Git status data
  - includes path, status, staged vs unstaged state, and optional diff summary
- stage_repository_paths
  - stages one file or all files
- unstage_repository_paths
  - unstages one file or all files
- create_commit
  - creates a commit from currently staged changes using a required title and optional body

The Rust implementation should use git2 so it stays consistent with the existing Git integration model.

### Frontend
Implement the feature as part of the repository detail experience using a small feature-local state model.

Suggested UI structure:
- top-level changes view container
- left file list panel with collapsible sections for Staged Changes, Changes, Untracked Files, and Conflicts
- left panel footer containing the commit composer
- right diff preview panel for the selected file

Suggested state pieces:
- list of change entries
- selected file
- active grouping (changes vs staged)
- loading state
- busy state for staging/unstaging/committing
- error state and inline status messaging
- commit form state
- last successful refresh timestamp or revision marker

## Data Shape
A richer shape is worth using from the start so the UI can handle edge cases without special-casing later.

```ts
interface RepositoryChangeItem {
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
  isConflicted?: boolean;
  isBinary?: boolean;
  diffAvailable?: boolean;
  diffSummary?: string;
  canStage?: boolean;
  canUnstage?: boolean;
}
```

## UX Principles
- Keep the layout simple and predictable.
- Make the default state obvious: show the repository’s current change list immediately.
- Avoid overloading the page with too many controls in the first pass.
- Make the split view adaptive so the file list and diff preview can each claim more space when useful.
- Use strong empty states for:
  - no changes
  - no staged changes
  - no diff selected
  - commit form not ready
- Validate commit input so the title is required and empty or invalid commit messages are blocked.

## Robustness and Reliability Requirements
The tab should be resilient enough to handle both the primary happy path and common Git edge cases without feeling brittle.

### In-progress Git operation handling
The changes tab should also support repositories that are currently paused inside a merge, rebase, or cherry-pick operation. In that state, the page should shift from a normal commit workflow into a resolution-oriented workflow rather than pretending the repo is in a standard unstaged/staged state.

Recommended behavior:
- Detect whether the repository is currently in a merge, rebase, or cherry-pick operation.
- Show a prominent status banner at the top of the changes view explaining that Git is currently paused and that the user must resolve or continue the operation.
- Surface conflicted files in the Conflicts section and make them the primary focus of the view.
- Keep the diff preview available so the user can inspect the conflict content and understand what needs to be resolved.
- Disable the standard commit composer while the operation is in progress, since a normal commit would not be the correct action for this state.
- Provide clear actions to continue or abort the in-progress operation, using the underlying Git commands rather than a manual workaround.

This should be treated as a first-class mode of the page, not as an edge-case fallback. The experience should feel like: “Git is paused here; here is what is blocked, here is what is conflicted, and here are the next actions.”

### Backend contract expectations
- The backend should return a structured change snapshot rather than a loosely formatted status string.
- Stage/unstage/commit operations should return updated change data, not just a boolean success flag.
- Errors should be surfaced as actionable strings, including whether the problem was caused by Git state, missing identity config, a pre-commit hook, or an invalid operation.

### Git edge cases to account for
- Conflicted files should appear in the Conflicts section and should not be silently treated as ordinary modified files.
- Binary files should render a clear fallback message instead of attempting to show a text diff.
- Deleted, renamed, and newly added files should be represented clearly in the list and preview.
- Detached HEAD, unborn branches, and repositories with no initial commit should be handled gracefully with explicit messaging.
- Missing Git identity configuration should block commit creation with a helpful explanation.
- Pre-commit hook failures should be surfaced as commit errors rather than disappearing into a generic failure.
- Submodules and other non-standard Git paths should be treated as unsupported or clearly labeled if they cannot be diffed in the first pass.

### Refresh and state consistency
- After staging, unstaging, or committing, the view should refresh the change list immediately.
- If the selected file is removed or no longer exists after an action, the selection should be cleared or moved to a safe fallback.
- The UI should avoid stale state by reloading the change snapshot after any successful action and by disabling overlapping actions while a request is in flight.

### Diff preview resilience
- The preview pane should support a fallback message for binary or unsupported content.
- Very large diffs should be capped or truncated to preserve responsiveness.
- The preview should still render a readable summary for renamed and deleted files.

### Commit safety and composer behavior
- The commit button should remain disabled until a valid title is present and there are staged changes available.
- The composer should trim whitespace before validation.
- A successful commit should clear the composer and refresh the change list.
- Commit failures should preserve the entered title/body so the user can adjust and retry.

### Accessibility and testing expectations
- File rows and group actions should be keyboard accessible.
- Loading, empty, and error states should be visually clear and screen-reader friendly.
- Test coverage should include successful stage/unstage flows, commit validation, conflict rendering, fallback rendering for binary or unsupported diffs, and the in-progress operation mode.

## Acceptance Criteria
The feature is successful when a user can:
- open the repository detail view
- see the repository’s changed files
- distinguish between changes and staged changes
- select a file and see its diff
- stage or unstage the file
- enter a commit title and message and create a valid commit

## Implementation Order
1. Backend command to collect repository changes
2. Frontend shell for grouped file list and diff preview
3. Stage/unstage interaction
4. Commit composer and commit action
5. Empty states, error handling, refresh behavior, and fallback rendering
6. Edge-case hardening for conflicts, binary files, and commit failures

## Notes and Constraints
- This should remain local-first and should not depend on remote GitHub operations for the basic workflow.
- The first version should focus on clarity and reliability rather than advanced Git features.
- Since this app already has repository-level Git status support, the changes page should build on that foundation rather than introduce a separate Git model.
