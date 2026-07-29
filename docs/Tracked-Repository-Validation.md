# Tracked Repository Validation

This document describes how tracked repositories are validated in the desktop app, when validation runs, and what the UI does when a repository can no longer be found.

## Overview

Tracked repositories are checked to make sure the saved path still exists and still points to a valid Git repository. This protects the dashboard from showing stale entries that were moved, deleted, or otherwise disconnected from their original folder.

## When validation happens

Validation runs in two main places:

1. Dashboard startup and refresh
   - When the dashboard loads, it hydrates the tracked repository list.
   - After the repository list is available, the app calls the repository verification flow for all tracked paths.
   - This gives the workspace a quick pass over every saved repository path so missing or invalid entries can be surfaced immediately.

2. Manual validation from the repository card
   - A user can trigger validation manually from a repository card.
   - This is useful when a repository was moved recently and the user wants to confirm its current state without waiting for the next dashboard refresh.

## How validation works

The validation flow is implemented in two layers:

### Frontend

The dashboard uses a verification hook that gathers the current tracked repository paths and sends them to the backend for validation.

For each repository, the app checks:
- whether the stored path still exists on disk
- whether the path is a directory
- whether the directory can be opened as a Git repository

### Backend

The Tauri backend exposes two commands:

- `verify_repo_paths(paths)`
  - Validates a batch of saved repository paths.
  - Returns the list of paths that failed validation.

- `validate_repository_path(path)`
  - Validates a single repository path.
  - Returns `true` when the path is still a valid Git repository, otherwise `false`.

The underlying check is simple and reliable:
- it verifies the filesystem entry exists
- it verifies it is a directory
- it attempts to open it as a Git repository with `git2::Repository::open`

## What happens to the repository card when a repository is missing

When a repository fails validation, the workspace store marks that repository as `missing`.

Once a repo is marked missing, the repository card changes into a dedicated recovery experience:

- the normal branch and status content is hidden
- the card displays a warning that the repository could not be found at its saved location
- the card presents recovery actions:
  - Locate
  - Clone Again
  - Remove

### Locate

If the user clicks Locate, the app opens a folder picker and lets them select the repository folder again. Once a new path is chosen:
- the new path is attached to the tracked repository
- the repository is marked as resolved again
- the card leaves the missing-state UI

### Clone Again

Clone Again opens the repository modal so the user can re-clone the repository from the appropriate source.

### Remove

Remove lets the user delete the tracked entry from the workspace catalog if they no longer want to keep it around.

## Store behavior

The workspace store is responsible for translating validation results into UI state:

- when a path is verified, the repository is marked as active/resolved
- when a path is missing, the repository is marked as missing
- when a repository becomes valid again after Locate, the missing state is cleared

This means the repository card is driven by explicit validation results rather than by stale assumptions about the repository’s last known location.
