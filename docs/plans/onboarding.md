# Reviewed and Revised Plan: First-Run Onboarding

## Decision Summary
- Overall disposition: hand off to implementation with the resolved product and implementation decisions below.
- Confidence: medium
- Scope assessed: a first-startup onboarding experience for the Tauri desktop app, a manual test entry point on the database diagnostics route, and educational content for local features, profiles, and authentication.

The plan review found material implementation gaps around state ownership, modal behavior, shared UI reuse, persistence, native credentials, and verification. Those gaps are closed below through the recorded decisions and the implementation-ready plan.

The change is worthwhile, but onboarding should not require authentication or prevent local work. The current application already supports a local-first workflow with a seeded Basic profile, while remote repository operations require a healthy Full OAuth profile. The flow should orient users, establish one small first success, and make authentication an optional capability upgrade.

## Decision Register
### Round 1 decisions
- `d1-first-run`: **Resolved**. Track onboarding globally for the local app/database; allow users to skip immediately and replay it from the main Settings page. This preserves local-first access and makes the education recoverable.
- `d2-enable-auth`: **Resolved**. “Authenticate and enable as application” means selecting Full OAuth and completing the existing provider OAuth consent flow. OAuth application/client configuration remains deployment work outside onboarding.
### Round 2 decisions
- `d3-local-system`: **Resolved**. Local system supports local Git and native remote Git operations through the OS-managed credential chain, such as the Windows Credential Manager or SSH agent. Provider API access and provider repository discovery remain Full OAuth-only.
- `d4-test-trigger`: **Resolved**. Keep both controls: Settings Replay is the normal user-facing path, while the database diagnostics route has a clearly labeled DEV-only, non-persisting test trigger.
### Round 3 decisions: implementation shape
- `d5-plan-shape`: **Resolved**. Keep this impact assessment and append an implementation-ready plan so the rationale, risks, and execution details remain together.
- `d6-ui-ownership`: **Resolved**. Create a feature-owned `src/features/onboarding/` module. Root/layout code wires the feature into startup and existing modal owners but does not own onboarding step state.
- `d7-modal-reuse`: **Resolved**. Reuse the existing `Button`, Phosphor icons, `useBackdropDismiss`, theme variables, and established modal CSS conventions. Do not introduce a generic modal primitive or refactor unrelated modals in this initiative.
- `d8-first-success`: **Resolved**. Reuse the AppLayout-owned Add Local Repository modal through its existing event-based integration; do not duplicate folder-picker or repository-add logic in onboarding.
### Round 4 decisions: behavior and backend
- `d9-persistence`: **Resolved**. Add versioned onboarding status to the existing single-row `settings` table through the next database migration. Persist completion and skip for the current version; replay and DEV test presentation do not require a database reset.
- `d10-dialog`: **Resolved**. Use a modal dialog with explicit Back, Next, Skip, and Finish actions. Escape and the close button follow the safe skip path; the underlying canvas and fixed frame remain visually isolated while the dialog is open.
- `d11-step-sequence`: **Resolved**. Use four progressive steps: local-first welcome, Dashboard/Branch Map workflow, profiles/privacy/authentication, and optional local-repository first success followed by completion.
- `d12-oauth-entry`: **Resolved**. Reuse ProfileManagementModal for profile editing and OAuth connection. Onboarding may open that existing surface, but must not silently change the active profile or duplicate OAuth controls.
- `d13-remote-credentials`: **Resolved**. Reuse `auth-git2::GitAuthenticator` for OS-managed Git credentials and add explicit capability enforcement. Local system enables native-credential Git remotes; provider API and provider repository discovery remain Full OAuth-only.

## Proposed Changes
### C1: First-startup onboarding gate
- Intended outcome: show a short onboarding flow the first time the app reaches a usable, database-ready state.
- In scope: detect first run, render the flow, track completion or skip state, allow resuming or replaying the guide, and avoid showing it on every launch.
- Out of scope: changing the database recovery flow, requiring a GitHub account, importing repositories automatically, or replacing the normal dashboard navigation.
- Dependencies: the database-ready state in `DatabaseRecoveryGate`, the root layout, persisted application settings, and the app's existing modal and focus conventions.
- Settled behavior: the global state is stored in the single-row settings record with a version and status; users can skip onboarding and continue locally; the guide can be replayed from Settings; the DEV test trigger is presentation-only.

### C2: Explain the core application workflow
- Intended outcome: a new user understands what Branch Schematic is for and how to get to the first useful result.
- In scope: concise explanations of the Dashboard/repository catalog, Branch Map/canvas, branch and commit context, views, and local Git actions; a clear first action such as adding a local repository and opening it in the Branch Map.
- Out of scope: a tour of every advanced Git command, every filter, canvas gesture, database diagnostic, or management option.
- Dependencies: existing dashboard, repository-add, branch-map, and view workflows.
- Settled behavior: feature content is progressive, limited to what a user needs on day one, and implemented as the four-step flow defined below.

### C3: Explain profiles and authentication levels
- Intended outcome: users understand which information is local-only, what each profile level means, and when authentication is needed.
- In scope: define and implement the distinct Local system capability; explain Basic local, Local system, and Full OAuth; identify local information that can be entered without authentication; explain the additional provider identity and token-backed capabilities obtained with OAuth; provide optional paths to create or connect profiles.
- Out of scope: collecting secrets in onboarding, displaying access tokens, inventing capabilities for Local system, or silently changing the active profile.
- Dependencies: `ProfileManagementModal`, `OAuthConnectButton`, the profile store, the OAuth loopback flow, token health state, and the native keyring.
- Settled behavior: the implementation includes the Local system Git capability using `auth-git2::GitAuthenticator` and explicit operation guards. “Enable as application” means completing provider OAuth consent for Branch Schematic; configuring the OAuth application itself remains deployment work. OAuth tokens remain in the OS keyring and never appear in onboarding UI.

### C4: Manual onboarding test trigger
- Intended outcome: testers can launch the onboarding presentation from the database diagnostics route without deleting data or restarting the app.
- In scope: add a clearly labeled test control to `src/routes/database.tsx` that opens the flow in a test mode.
- Out of scope: making the diagnostics route part of the normal onboarding path or changing the persisted first-run completion state when the test control is used.
- Dependencies: the onboarding controller/state owner and the existing diagnostics route.
- Settled behavior: Settings Replay is normal user-facing functionality; the separate database-route control is rendered only in development and never changes persisted onboarding state.

### C5: Add a guided first success (recommended)
- Intended outcome: the user completes one meaningful local task instead of only reading feature descriptions.
- In scope: offer an optional action to add an existing local repository, then direct the user to the Dashboard or Branch Map; explain that adding a path does not modify files in that directory.
- Out of scope: automatic directory crawling, remote cloning, branch mutation, or requiring repository setup to finish onboarding.
- Dependencies: `AddLocalRepositoryModal`, workspace hydration, empty-state behavior, and Branch Map initialization.
- Settled behavior: the first success triggers the existing AppLayout-owned Add Local Repository modal. A valid add may offer Dashboard or Branch Map navigation; cancellation, invalid paths, and no repository available remain recoverable and never block completion.

## Clarifications
- Asked and answered: the user requires first-time startup onboarding, wants to explain core features and authentication, and wants a manual test button on the database route.
- Still needed:
	- No product decisions remain open. The implementation details are specified in the implementation-ready plan below, including native credential policy, error behavior, permissions/capabilities, migration details, and the test matrix for Local system.
- Assumptions used for this assessment:
	- Onboarding is optional and local work must remain available without authentication.
	- Completion is global to the local app/database, versioned, and replayable from Settings.
	- A diagnostic test launch presents the guide without mutating the saved completion state.
	- Authentication is explained and offered contextually, not forced at the beginning.
	- Local system supports local Git plus native remote Git through OS-managed credentials; provider API operations remain Full OAuth-only.
	- The database diagnostics trigger is DEV-only; Settings Replay is available to normal users.

## Review Findings and UI Coverage
### Required revisions now incorporated
- **State ownership:** the original document named startup and replay behavior but did not name an owner. The new feature module owns onboarding state, persistence orchestration, step definitions, and presentation mode; `__root.tsx` and `AppLayout.tsx` only provide startup/layout and existing modal integration.
- **Persistence contract:** the original document called for versioning without defining schema shape or migration sequencing. The plan now requires `onboarding_version` and `onboarding_status` in the existing `settings` row, a migration, generated database documentation, and an alpha reset/re-import note.
- **UI implementation contract:** the original document described a flow but not a usable UI. The plan now defines a fixed-frame modal, four steps, progress semantics, navigation controls, safe dismissal, responsive constraints, accessibility, and loading/error states.
- **Common component reuse:** the plan explicitly reuses `Button`, Phosphor icons, `useBackdropDismiss`, theme variables, the existing ProfileManagementModal, OAuthConnectButton, and AddLocalRepositoryModal. No onboarding-specific button, icon, folder picker, OAuth form, or generic modal shell is added.
- **Backend truthfulness:** the original document identified the Local system gap but left its mechanism unresolved. The plan now reuses `auth-git2::GitAuthenticator`, separates native Git transport from provider REST access, and tests the capability matrix without weakening the Full OAuth provider API guard.
- **Verification:** every major acceptance path now has a focused frontend, Rust, manual, or migration check, including blank-database startup, replay, skip, test mode, OAuth cancellation, credential failure, invalid repository paths, keyboard interaction, and the Local system capability boundary.

### UI conformance requirements
| UI concern | Plan requirement | Existing pattern reused |
| --- | --- | --- |
| Fixed frame vs spatial viewport | Render onboarding as a fixed overlay after database readiness; do not transform, pan, or mutate the canvas while the dialog is open. | `AppLayout` frame and the spatial isolation in `UI-Component-Design.md` |
| Controls | Use `Button` variants `submit`, `basic`, and `close`; use icon-only buttons only when the icon is familiar and has an accessible label/title. | `src/components/button/Button.tsx` and `Button.css` |
| Icons | Use `@phosphor-icons/react` for close, navigation, repository, profile, and status icons. | Repository-wide icon convention |
| Theme and interaction states | Use `--app-surface`, `--app-control`, `--app-border`, `--app-text`, `--app-muted`, `--app-accent`, `--app-on-accent`, and `--app-danger`; preserve hover, focus-visible, active, and disabled states. | `docs/UI-Rules.md` and `Button.css` |
| Dialog dismissal | Use `useBackdropDismiss` so a press that starts inside the dialog cannot dismiss it when released on the backdrop. Escape/close use the explicit skip path. | `src/hooks/useBackdropDismiss.ts` and existing modal usage |
| Modal and focus behavior | Provide `role="dialog"`, `aria-modal`, labelled/described content, progress status, initial focus, focus restoration, a keyboard-safe Tab cycle, body scroll locking with prior overflow restoration, and responsive max dimensions. | Existing `.app-modal` conventions plus the accessibility requirements in the assessment |
| Existing workflows | Trigger existing AppLayout-owned repository/profile modal flows rather than nesting or duplicating those dialogs inside onboarding. | `open-repository-modal` event, `ProfileManagementModal`, `AddLocalRepositoryModal` |

## Current-State Evidence
- The root route renders `DatabaseRecoveryGate`, then `NotificationProvider`, then `AppLayout` and the current route outlet in [`src/routes/__root.tsx`](../../src/routes/__root.tsx). This is the nearest shared startup boundary, and the database gate must remain outside onboarding so recovery actions are available before any normal app UI.
- [`src/components/database-recovery/DatabaseRecoveryGate.tsx`](../../src/components/database-recovery/DatabaseRecoveryGate.tsx) renders the application only after native startup reports `ready`; it already owns the loading/recovery states that a first-run gate must not bypass.
- [`src/components/layout/AppLayout.tsx`](../../src/components/layout/AppLayout.tsx) hydrates the workspace and profile context on mount, subscribes to workspace updates, and owns the repository/profile modals. An onboarding overlay placed around or inside this layout must account for those existing asynchronous hydrations and modal ownership.
- [`src/features/dashboard/components/DashboardMain.tsx`](../../src/features/dashboard/components/DashboardMain.tsx) loads tracked repositories and quick-filter metadata, verifies repositories, and provides the primary repository catalog workflow.
- [`src/components/layout/AppSidebar.tsx`](../../src/components/layout/AppSidebar.tsx) exposes Home, Branch Map, Database, Data Management, and Settings. This gives onboarding a concrete re-entry location to point toward, but there is currently no Help or onboarding item.
- [`src/features/repository/components/RepositoryDropdown.tsx`](../../src/features/repository/components/RepositoryDropdown.tsx) exposes New Repository, Add Local Repository, Create New View, and Clone Repository. Clone is disabled and labeled as requiring sign-in when the active profile is not eligible.
- [`src/features/repository/components/AddLocalRepositoryModal.tsx`](../../src/features/repository/components/AddLocalRepositoryModal.tsx) uses a native folder picker and `add_new_tracked_path`; it explicitly describes attaching an existing Git repository and does not write to the selected repository during this workflow.
- [`src/features/auth-profile/types/index.ts`](../../src/features/auth-profile/types/index.ts) defines exactly three profile levels: `basic`, `local_system`, and `full_oauth`.
- [`src/features/auth-profile/stores/profileStore.ts`](../../src/features/auth-profile/stores/profileStore.ts) seeds a local Basic profile named `Local workspace` with local commit identity defaults, then hydrates persisted profiles from `get_profiles`.
- [`src/features/auth-profile/components/ProfileManagementModal.tsx`](../../src/features/auth-profile/components/ProfileManagementModal.tsx) lets users choose the three auth levels and edit display name, commit identity, scopes, and provider URL. It is the existing profile setup surface that onboarding should reuse or link to rather than duplicate.
- [`src/features/auth-profile/components/OAuthConnectButton.tsx`](../../src/features/auth-profile/components/OAuthConnectButton.tsx) starts the existing browser-based OAuth flow when a profile is set to Full OAuth. [`useOAuthFlow.ts`](../../src/features/auth-profile/hooks/useOAuthFlow.ts) starts a loopback listener, opens the provider authorization page, requests `repo read:org`, exchanges the code, hydrates profiles, and refreshes token health.
- [`src-tauri/src/git.rs`](../../src-tauri/src/git.rs) rejects remote operations unless `auth_level` is `full_oauth` and a non-empty token is available. This is the strongest verified capability boundary for the onboarding explanation.
- The resolved Local system behavior therefore requires a deliberate backend change: native Git remote operations must be separated from provider API operations, with OS credential callbacks or an equivalent native mechanism, while the existing provider API guard remains Full OAuth-only.
- [`src-tauri/src/auth.rs`](../../src-tauri/src/auth.rs) stores the OAuth token in the OS keyring and exposes profile/token commands. Onboarding must never ask users to paste or reveal the token.
- [`src-tauri/src/db.rs`](../../src-tauri/src/db.rs) creates a single-row `settings` table and seeds the local Basic profile in the database migration. There is no onboarding completion/version field or existing first-run state.
- [`src/routes/database.tsx`](../../src/routes/database.tsx) is a diagnostic control panel for database cache, scanner, notification, branch, mount, and checkout testing. It is an appropriate place for a temporary manual test trigger, but not an appropriate production onboarding surface.
- [`package.json`](../../package.json) provides `npm run test` and `npm run build`; there is no dedicated documentation or onboarding validation command.
- The referenced [Checklist Design mobile onboarding guide](https://www.checklist.design/mobile/onboarding) identifies seven relevant principles: keep only genuinely required steps, show progress, provide step navigation, request permissions contextually, allow skipping, include limited personalization, and handle keyboard/focus behavior correctly. The guide is mobile-oriented, but these interaction principles apply to the desktop first-run flow as well.
- Unknown: the current code validates and stores `local_system`, but no current remote-operation consumer grants it a distinct capability. Its meaning should not be described as a concrete feature until product behavior is defined.

## Impact Findings
### C1: First-startup onboarding gate
- Classification: beneficial with conditions
- Positive impact: improves discoverability at the exact moment users need orientation and can prevent the empty dashboard from feeling like a broken state.
- Negative impact or unintended consequence: a blocking modal can delay experienced users, interfere with existing profile/workspace hydration, and create repeated prompts after database recovery or partial completion.
- Affected surfaces: root layout, database-ready gating, persisted settings, new onboarding feature state, and likely app-level tests.
- Dependencies and interactions: onboarding must wait for database readiness; it should not assume profile or workspace hydration has completed; a future replay action needs a stable controller rather than a one-off local component state.
- Confidence and rationale: medium-high. The startup ownership and global/skippable/replayable behavior are now settled; persistence schema/version details remain implementation decisions for the plan.
- Discriminating check: launch with a blank database, confirm the app reaches recovery-ready state and shows onboarding once; relaunch after completion, after skip, and after an interrupted step to verify the intended state transitions.
- Recommendation: proceed with a versioned global completion state, immediate Skip, and a Settings replay action.

### C2: Explain the core application workflow
- Classification: beneficial with conditions
- Positive impact: gives users a useful mental model of the Dashboard, Branch Map, repositories, branches, commits, and views without requiring them to discover the navigation by trial and error.
- Negative impact or unintended consequence: a feature catalog can become a long tutorial, delay the first value moment, and explain advanced actions before the user has data to understand them.
- Affected surfaces: onboarding content/components, Dashboard and Branch Map entry points, repository empty states, and accessibility tests.
- Dependencies and interactions: C5 should follow or be offered from this content; repository and canvas actions should remain available after skip.
- Confidence and rationale: high for the benefit, medium for exact content. Existing navigation and actions provide a verified basis for a short guide.
- Discriminating check: usability review with a fresh database: can a tester identify the next action and reach a repository or an intentional empty state within a few minutes without completing every optional explanation?
- Recommendation: proceed with a short progressive flow of roughly three to five steps, with one clear first action and an explicit skip path.

### C3: Explain profiles and authentication levels
- Classification: beneficial with conditions
- Positive impact: sets an accurate expectation that local repository tracking and local Git context do not require OAuth, while remote provider operations do; it makes consent and token storage less surprising.
- Negative impact or unintended consequence: inaccurate descriptions of Local system could cause users to select a profile level that has no distinct behavior; OAuth can fail because of cancellation, provider configuration, network problems, or token health issues; placing consent at the start can make users think sign-in is mandatory.
- Affected surfaces: onboarding auth step, profile management, OAuth flow status/error handling, token health display, and possibly product copy/configuration.
- Dependencies and interactions: Local system capability must be defined before copy and implementation are finalized; OAuth should be offered after the local-first explanation and only when the user chooses Full OAuth.
- Confidence and rationale: medium-low. Basic and Full OAuth boundaries are verified, but the user has requested a new Local system capability that the current code does not implement.
- Discriminating check: define an operation matrix for Basic, Local system, and Full OAuth, then test each profile against local Git, system-credential remote Git, provider API, and remote clone actions before finalizing onboarding language.
- Recommendation: proceed to implementation planning with a capability matrix that distinguishes local Git, native remote Git, provider API, and provider repository discovery. The plan must not implement Local system by weakening the existing Full OAuth provider API guard.

### C4: Manual onboarding test trigger
- Classification: beneficial with conditions
- Positive impact: makes visual and interaction testing repeatable without resetting the database or altering first-run state.
- Negative impact or unintended consequence: a production-visible diagnostic button can confuse users, and a test trigger that marks onboarding complete can make later first-run verification unreliable.
- Affected surfaces: `src/routes/database.tsx`, onboarding controller, test coverage, and development-only rendering.
- Dependencies and interactions: the trigger must invoke the same presentation path as startup while passing a non-persisting test mode.
- Confidence and rationale: high. The database route is already explicitly diagnostic and the desired test entry is concrete.
- Discriminating check: complete onboarding, use the database test button, close it, and relaunch; verify the app does not show onboarding again unless the persisted state is deliberately reset.
- Recommendation: proceed with both controls. Settings Replay is user-facing; the database trigger is DEV-only, non-persisting, and uses the same onboarding presentation path.

### C5: Guided first success
- Classification: beneficial with conditions
- Positive impact: adding a local repository and opening the Branch Map demonstrates the app's value more effectively than feature descriptions alone and works offline without OAuth.
- Negative impact or unintended consequence: file-picker permissions, invalid paths, non-Git folders, missing repositories, or slow initial indexing can turn onboarding into a setup failure; users who have no repository ready need a clean skip path.
- Affected surfaces: Add Local Repository modal, workspace hydration, dashboard empty state, Branch Map loading, notifications, and onboarding step state.
- Dependencies and interactions: should be optional, should use existing repository-add behavior, and should not silently create branches or modify files.
- Confidence and rationale: medium-high. The local add workflow is already implemented, but the best post-add navigation and loading copy need product confirmation.
- Discriminating check: run the flow with a valid Git repository, a non-Git folder, a missing path, and no selected path; verify errors are recoverable and the user can skip without losing progress.
- Recommendation: include as an optional primary action after the orientation, with a secondary skip/continue action.

## Recommended Additional Onboarding Content
- Explain local-first privacy and boundaries: repository paths, cached metadata, profile metadata, and OAuth credentials have different storage/permission implications; OAuth tokens are stored through the OS keyring and should never be copied into the UI.
- Explain the first-run empty state: no repositories is a valid starting state, and the user can add a local repository or return later.
- Explain the practical permission moments: choosing a local folder, opening the browser for OAuth consent, and the OS credential/keyring boundary. Ask only when the related action is selected.
- Add a completion summary with the next recommended action, such as "Add a local repository" or "Open Branch Map", rather than ending on a generic success message.
- Make the guide re-enterable from Settings or Help so skipped education is recoverable without a database reset.
- Support keyboard navigation, visible focus, Escape behavior that does not accidentally discard progress, screen-reader step labels, and responsive sizing for smaller windows. The checklist specifically calls out keyboard handling even though this is a desktop app.
- Avoid a full feature tour for diagnostics, advanced branch mutations, or every management setting. Offer contextual empty-state guidance later when the user reaches those surfaces.

## Cross-Change Considerations
- Sequence the work as: define onboarding state and first-run semantics, define the auth capability copy, design the short step sequence, then connect the optional local first-success action and diagnostic trigger.
- The database-ready gate must precede onboarding. A blank or recoverable database should not be treated as an onboarding failure, and onboarding should not compete with the recovery modal.
- Authentication education and the first-success action should be separate steps. The local path is usable without OAuth, so users should not have to grant provider access before seeing value.
- A versioned onboarding state is preferable to a permanent boolean if future product changes may require a new explanation. Any schema change to persist this in SQLite requires a migration and should follow the repository's alpha reset/re-import procedure.
- The manual test trigger must bypass the normal first-run decision only for presentation; it must not rewrite completion, profile, workspace, or repository data.
- Settings owns the normal replay action; the database route remains a testing surface and must not become the user's way to revisit onboarding.
- If onboarding invokes existing modals, define which surface owns close behavior and focus restoration. AppLayout currently owns profile and repository modals, while the root owns startup readiness.

## Implementation-Ready Plan
### 1. Establish the feature boundary and state contract
- Add the onboarding feature under `src/features/onboarding/` using the repository's feature-driven structure: `components/`, `hooks/`, `stores/` or a reducer module, `types/`, and feature CSS only where needed.
- Define a small state model with `presentationMode` (`startup`, `replay`, `test`), current step, open/closed state, busy state, and recoverable error state. Keep the four step definitions as data so progress labels, navigation, and tests share one source of truth.
- Expose a controller/provider or equivalent feature hook that supports startup evaluation, `openReplay`, `openTest`, `skip`, `finish`, and step navigation. Startup must wait for database readiness and must not depend on workspace indexing completing.
- Keep root integration narrow: render the controller/presentation after `DatabaseRecoveryGate` reports ready and alongside the existing `NotificationProvider`/`AppLayout` frame. The database recovery screen must remain unobstructed by onboarding.

### 2. Add versioned persistence through the settings owner
- Add the next SQLite migration in `src-tauri/src/db.rs` with `onboarding_version INTEGER NOT NULL DEFAULT 0` and `onboarding_status TEXT NOT NULL DEFAULT 'not_started'` constrained to `not_started`, `skipped`, or `completed`.
- Keep the current onboarding schema version as a named frontend/backend constant. A current-version `skipped` or `completed` state suppresses startup presentation; an older version is eligible for startup presentation.
- Add narrow Tauri commands or a feature-specific database abstraction for reading and updating onboarding state. UI components must not contain raw SQL; the feature hook owns loading, writes, and failure handling.
- Update `docs/Database.md` through `npm run docs:db`. Follow the repository alpha rule: tell implementers and testers to reset the database and re-import repositories after the migration.
- Treat persistence failures as recoverable: show the app and allow a test/replay presentation, but expose a non-blocking error state and do not claim a durable completion until the write succeeds.

### 3. Build the four-step fixed-frame modal
- Implement an onboarding modal in `src/features/onboarding/components/` using the established `.app-modal` structure and theme variables, not a new shared modal primitive.
- Step 1, **Local first**: explain what Branch Schematic tracks locally, that authentication is optional, and that adding a repository attaches an existing folder without modifying it.
- Step 2, **See the structure**: explain Dashboard/repository catalog, Branch Map/spatial canvas, views, branches, commits, and the first useful path through the existing navigation. Keep canvas explanations informational; do not mount a second canvas or alter canvas viewport state.
- Step 3, **Profiles and access**: show the Basic local, Local system, and Full OAuth capability matrix, including local data/privacy boundaries, native credential behavior, provider API limits, and OS-keyring token handling. Provide an action to open ProfileManagementModal, preserving the current active profile unless the user explicitly changes it there.
- Step 4, **Make it useful**: offer the existing Add Local Repository flow as the primary first-success action, with a clear skip/continue alternative. After a successful add, offer navigation to Dashboard or Branch Map. A user without a repository can finish without setup.
- Render progress as an accessible step indicator such as `Step 2 of 4`, with Back disabled on the first step, Next/Finish using `submit`, Skip using `basic`, and close using the existing `close` variant plus a visible accessible label.
- Use `useBackdropDismiss`, Phosphor icons, and `Button` throughout. Keep the overlay fixed in the frame layer, use a bounded width/height with internal scrolling for small windows, and preserve stable button dimensions while busy.
- On Escape or close, use the same explicit skip path. Do not silently discard a repository/profile operation that is currently busy; disable dismissal controls while the delegated modal operation is active and restore focus to the invoking control when the modal closes.

### 4. Wire existing modal owners without duplicating workflows
- Add a typed event or narrow controller callback for onboarding to request the AppLayout-owned `add-local` repository modal. Extend `AddLocalRepositoryModal` only as needed to report successful add completion back to the onboarding controller; preserve its current picker, validation, notification, duplicate, and error behavior.
- Add a matching AppLayout integration for opening ProfileManagementModal from onboarding. Reuse the existing profile list, auth-level selector, OAuthConnectButton, token-health status, deletion confirmation, and active-profile rules.
- Do not nest onboarding around either existing modal in a way that creates two competing backdrops. When a delegated modal opens, onboarding should pause its own actions or close to a resumable step, then reopen/advance after the delegated flow reports completion or cancellation.
- Add the DEV-only database-route trigger in `src/routes/database.tsx`. It must call the same `openTest` controller path, be clearly labeled as a test control, and never write onboarding state or repository/profile data.
- Add Settings Replay to the normal settings surface using `Button` and the shared interaction states. It opens the same modal in `replay` mode and does not require clearing the database.

### 5. Implement and enforce the Local system capability boundary
- Reuse `auth-git2::GitAuthenticator` for Git fetch, pull, push, and native-credential clone transport. Do not add a second credential store or expose credentials to React; OAuth tokens continue to use the existing OS keyring path.
- Replace the current single `full_oauth` remote-operation assumption with an explicit capability check: Basic permits local Git only; Local system permits local Git plus configured Git remotes authenticated through the OS-managed chain; Full OAuth permits those Git remotes plus provider REST discovery/metadata/branch APIs.
- Keep `ensure_remote_access` or its replacement restricted to provider API calls. Provider repository listing, provider branch discovery, and provider metadata must still fail clearly for Basic and Local system.
- Define user-facing errors for missing helper/SSH credentials, rejected credentials, network failures, provider OAuth cancellation, expired/unreachable tokens, and unsupported provider operations. Errors must identify the next action without revealing tokens or sensitive credential material.
- Review `src-tauri/capabilities/*.json` and Tauri command registration in `src-tauri/src/lib.rs`; add only the permissions required by the chosen command surface. No provider API permission is implied by Local system.

### 6. Test and validate the complete flow
- Frontend unit/component tests: state transitions for startup eligibility, version mismatch, skip, finish, replay, DEV test mode, Back/Next boundaries, Escape/close behavior, persistence failure, progress semantics, and delegated modal completion/cancellation.
- Accessibility/component tests: dialog roles and labels, visible focus, Tab cycling, focus restoration, disabled busy controls, screen-reader step status, responsive bounded layout classes, and pointer-aware backdrop behavior including inside-to-backdrop drag.
- Integration tests: root onboarding appears only after database readiness; AppLayout opens the existing repository/profile modals; a successful local repository add advances the flow; invalid, duplicate, cancelled, and non-Git selections remain recoverable; DEV test mode does not mutate persisted state.
- Backend tests: capability matrix for Basic, Local system, and Full OAuth across local Git, native-credential remote Git, provider REST, provider repository discovery, token absence/expiry, and credential rejection. Keep tests free of secret values.
- Database/manual checks: delete the database and launch to verify automatic recreation, migration application, and one-time onboarding; relaunch after skip and completion; use Settings Replay and the DEV database trigger; confirm test mode does not change persisted state. Reset and re-import repositories after the migration as required by the alpha workflow.
- Run `npm run test -- src/features/onboarding src/components/layout/AppLayout.test.tsx`, `npm run build`, `npm run docs:db` when the migration changes, and `cargo check` from `src-tauri`. Do not run the focused Rust test binary while the repository's Windows workaround note remains active; run those tests in CI or after that note is removed.

## Acceptance and Verification
- A blank, ready database presents onboarding once and the recovery UI remains authoritative before readiness. Verify with the database-delete launch check and a root integration test.
- Skip and Finish both suppress the current onboarding version on the next launch; their status remains distinguishable for diagnostics. Verify with persistence tests and relaunch checks.
- Settings Replay opens the same four-step guide without resetting data. Verify from Settings after completion and after skip.
- The DEV database control opens the same guide in non-persisting test mode. Verify that skip/finish in test mode leaves the stored version/status unchanged.
- The guide uses the fixed frame layer, shared Button/icon/theme conventions, pointer-aware backdrop dismissal, keyboard navigation, focus restoration, and responsive internal scrolling. Verify with component accessibility tests and a small-window manual pass.
- Existing Add Local Repository and Profile Management/OAuth flows remain the only repository/profile setup surfaces. Verify event/callback integration tests and manual cancellation/error checks.
- Local system uses native Git credentials for Git remotes but cannot call provider API discovery; Full OAuth retains provider API access. Verify the backend capability matrix and `cargo check`.
- Migration and generated database documentation match the implemented schema. Verify with `npm run docs:db` and the clean-start database reset test.

## Remaining Risks and Assumptions
- `auth-git2` behavior depends on the user's configured Git credential helper, SSH agent, or SSH key files. The UI must describe this as OS-managed credentials and provide a recoverable error when none are available.
- Existing modal owners use event/callback integration; the implementation must preserve single-modal focus ownership and avoid two active overlays during delegated repository/profile actions.
- The current repository-wide font and modal styles are inherited; onboarding should extend existing theme tokens and `.app-modal` conventions rather than introduce a separate visual system.
- The current Windows environment requires `cargo check` instead of the focused Rust test suite until the documented binary-launch workaround is removed.

## Handoff Options
1. **Pause with the revised plan**: retain the decisions and implementation-ready checklist without changing application code.
2. **Hand off to implementation**: implement the scoped feature, migration, AppLayout integration, Local system capability policy, and verification sequence above.

## Selected Handoff Status
- **Retain the revised plan.** All product and implementation-shaping decisions raised during review were answered and incorporated. The plan is ready for a future implementation pass, but no application implementation was started.
- The implementation handoff must preserve the local-first behavior, four-step modal, feature ownership, existing modal reuse, versioned settings migration, explicit Local system capability policy, DEV-only non-persisting test mode, and the validation matrix above.

## Quality Gate
- Every requested change is identified: first-startup flow, core feature explanation, profile/auth explanation, authentication enablement, database-route test trigger, common-component reuse, and UI-rule/component-design compliance.
- Material clarifications are closed: first-run scope, OAuth meaning, Local system capability boundary, and diagnostic trigger exposure are all resolved. Remaining items are implementation-plan choices with explicit security and validation requirements.
- Current-state claims are tied to the nearest startup, layout, profile, OAuth, Git, database, route, and package surfaces.
- Benefits, risks, dependencies, failure states, privacy boundaries, and cross-change ordering are explicit.
- Every impact finding includes a cheap discriminating check.
- The report separates verified facts, assumptions, and unknowns and does not present an implementation as complete.
- All review decisions are recorded with explicit consequences, and the implementation-ready plan names affected owners, data contracts, failure paths, accessibility behavior, and executable validation.
- No application code or unrelated files were modified; this assessment only updates this planning document.
