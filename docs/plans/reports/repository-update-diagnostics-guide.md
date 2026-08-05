# Repository Update Diagnostics Guide

## Purpose

Use this guide to manually inspect repository refresh priority and runtime monitoring state in the Branch Schematic desktop application. The guide is intentionally limited to checks that can be performed quickly from the application UI and the existing development command line.

The diagnostics window is observational. It reads a manager-owned snapshot and does not create watchers, start refreshes, persist priority, or replace automated tests and scale measurements.

## Prerequisites

- Windows development environment for Branch Schematic.
- Dependencies installed with `npm install`.
- A database containing at least one tracked repository.
- A repository that can be safely changed locally for refresh testing.
- The application started normally with the manager-owned watcher implementation.

Start the application from PowerShell:

```powershell
npm run tauri dev
```

## Open the Diagnostics Window

1. Start the application.
2. Look at the application title bar.
3. Select the activity/diagnostics button immediately to the left of Notifications.
4. Confirm that `Repository Update Diagnostics` opens.
5. Close it with the close button, Escape, or a press that starts and ends on the backdrop.

The button belongs to the app title bar, so it is available independently of the branch-map canvas toolbar.

## What the Window Shows

The summary row reports the manager snapshot at the most recent capture:

- `Active`: repositories with a runtime manager entry.
- `Running`: refreshes currently in progress.
- `Watchers`: repositories with an active filesystem watcher.
- `Polling`: repositories using the fallback polling monitor.
- `Degraded`: entries with one or more failures.
- `Coalesced`: refresh requests merged while work was already running.

The table reports each runtime entry:

| Column | Meaning |
| --- | --- |
| Priority | Current transient scheduling priority: `foreground`, `visible`, or `background`. |
| Repository | Workspace label when available, otherwise the repository ID. |
| Runtime | `idle`, `running`, `follow-up`, or `degraded`. |
| Monitor | `watcher`, `polling`, or `pending`. |
| Detail | Whether the repository detail view is active. |
| Trigger | Last manager trigger reason recorded for the entry. |
| Failures | Current runtime failure count. |
| Generation | Runtime generation counter for the entry. |

The table refreshes approximately once per second while the window is open. The footer timestamp identifies the latest snapshot.

## Quick Validation Checklist

Record the date, application mode, and a short observation for each check. Use the checkbox only after the expected result is observed.

### Basic window behavior

- [x] **Open from the title bar:** The diagnostics button appears immediately to the left of Notifications and opens the modal.
- [x] **Close safely:** The close button and Escape close the modal. A press that starts inside the modal and ends outside does not accidentally close it.
- [x] **Refresh timestamp:** Leave the modal open for several seconds. The footer timestamp changes as snapshots arrive.
- [x] **Search:** Enter a repository name or ID. Only matching rows remain visible. Clear the field and confirm all rows return.
- [x] **Filters:** Select `Running`, `Degraded`, and `Polling`. Each selection narrows the table and `All states` restores the full list.
- [x] **Priority ordering:** The table places degraded entries first, then higher-priority entries before lower-priority entries.

### Managed-mode state

- [x] **Repository entries appear:** After startup registration settles, tracked repositories appear in the table with IDs or workspace labels.
- [x] **Watcher ownership is visible:** Normal managed entries show `watcher` in the Monitor column when registration succeeds.
- [x] **Runtime priority is visible:** At least one row displays a priority value. Confirm that the value is a runtime state and does not change a persisted repository setting.
- [-] **Detail activity is visible:** Open a repository detail view while the modal remains available. Its Detail value should change to `active` while that detail view owns the repository, then return to `idle` after leaving it. cannot open details and this modal at the same time.
- [ ] **Refresh activity is visible:** Trigger one supported repository refresh or make a small local Git change. Observe a row temporarily show `running`, a changed Generation value, or an updated Trigger value.
- [ ] **Follow-up activity is observable when reproducible:** Trigger another refresh while the first is still running. If the timing produces a coalesced request, observe `follow-up` or an increased Coalesced summary value.

### Privacy and scope

- [x] **No absolute paths are shown:** Repository rows show labels or IDs, not filesystem paths.
- [x] **No credentials or Git output are shown:** The window contains no tokens, remotes containing credentials, or arbitrary command output.
- [x] **Read-only behavior:** Opening, polling, filtering, sorting, and closing the window do not alter repository tracking, persisted priority, or refresh configuration.
- [x] **No duplicate visible refresh path:** Opening and closing the window does not cause an extra workspace refresh notification or a second visible watcher registration.

## Simple Evidence Record

Copy this section into a test note or issue and fill it in after a run:

```text
Date:
OS:
Tracked repositories:
Fixture repository used for refresh activity:

Passed checks:
- 

Failed checks:
- 

Observed values:
- Mode:
- Active:
- Running:
- Watchers:
- Polling:
- Degraded:
- Coalesced:

Notes:
- 
```

## Checks This Window Cannot Prove

Do not treat a healthy-looking table as proof of the following:

- 2,000- or 5,000-repository startup time.
- Memory allocation, idle CPU, or operating-system watcher limits.
- Correctness of every watcher layout, worktree, packed-ref, or missing-path case.
- Reliable shutdown completion under process termination.
- Runtime Rust concurrency behavior when the Windows Rust test executable cannot launch.
- End-to-end cache freshness after every possible Git operation.
- Rollout thresholds without a recorded diagnostics capture and the corresponding evaluator input.

Use the existing automated test suite, Rust compilation/runtime tests, benchmark scripts, and Stage 9 rollout evidence for those claims.

## Related Documentation

- [Repository Update Detection](../../Repository-Update-Detection.md)
- [Repository Update Detection Implementation Plan](../repository-update-detection-implementation-plan.md)
- [Stage 10 Evaluation](repository-update-detection-stage-10.md)
