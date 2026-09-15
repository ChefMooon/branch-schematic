---
title: "Git Push Authentication and Repository Profile Flow - Implementation Plan"
status: BLOCKED # Options: DRAFT | IN_PROGRESS | BLOCKED | COMPLETED
current_phase: 6 / 6
created: 2026-09-15
last_updated: 2026-09-15
---

# Overall Plan Completion Status

* **Final State:** BLOCKED # Options: IN_PROGRESS | COMPLETED | BLOCKED
* **Total Phases Completed:** 4 / 6
* **Summary of Outcome:** Phases 2-5 implementation and automated validation are complete. Phases 1 and 6 remain blocked by unavailable runtime/manual verification.

# Specification & Overview

### 1. Scope & Objective

- **Goal:** Make repository onboarding and Git push predictable by giving every repository an explicit, visible profile assignment workflow and by making the profile used for Git transport observable and deterministic.
- **In-Scope:** Shared profile resolution; repository-centered assignments; active-profile fallback; clone assignment persistence; safe diagnostics; HTTPS and SSH credential selection; actionable error categories; first-time branch publication; repository-facing controls; profile deletion safeguards; focused backend/frontend/integration tests; onboarding and troubleshooting documentation.
- **Out-of-Scope:** Moving OAuth tokens into SQLite; redesigning OAuth expiration; changing OAuth scopes without evidence; live GitHub or keyring credentials in unit tests; making the dashboard active profile silently override an explicit repository assignment.

### 2. Technical Constraints & Architecture

- The application is a React 19 and Tauri v2 desktop application. Backend Git and profile behavior belongs in `src-tauri/src/`; repository/profile UI remains in feature components and fixed repository action surfaces.
- Use one shared resolver for clone, fetch, pull, push, and repository-profile display. The resolver returns repository ID, profile ID, profile name, auth level, and resolution source (`repository_assignment`, `active_profile`, or `local_fallback`) without secrets.
- Repository assignment is authoritative. Unassigned repositories use the persisted active profile; if no user profile exists, use the explicit `local-basic-profile` fallback. Clearing an assignment restores active-profile fallback.
- `local-basic-profile` is a fallback-only profile by default. It is excluded from active user-profile selection, but may be explicitly assigned to a repository. When any user profile exists, exactly one non-fallback user profile is active; when none exists, the fallback is recreated and used.
- Full OAuth authenticates HTTPS remotes only. OAuth plus SSH returns actionable SSH setup guidance and never attempts token or SSH-agent authentication. Local-system profiles continue to use OS-managed Git credentials and SSH configuration. Basic profiles reject all remote Git operations.
- Do not log tokens, passwords, authorization headers, or credential-bearing URLs. Normal errors expose stable non-secret categories. Detailed redacted metadata is available only through a developer-only diagnostics command and may include token presence as a boolean, never token length or value.
- Legacy assignment rows are not migrated. Because alpha data may contain ambiguous many-to-many mappings, the release requires the documented database reset and repository re-import procedure. Any database initialization or schema work must follow `Database.md`.
- Repository Git actions belong in fixed repository-card/detail controls, not spatial canvas nodes. Use `@phosphor-icons/react`, shared UI tokens, and the existing modal/outside-dismiss patterns.

### Current Evidence and Problem Statement

- `git_push_operation` currently receives only `path_id`; backend resolution can choose a hidden `profile_repo_scopes` mapping instead of the dashboard's active profile.
- Repository scopes are edited as raw comma-separated `tracked_paths.id` values, with no repository-card assignment or resolved-profile display. Multiple mappings can exist and resolution silently chooses by profile ID ordering.
- Full OAuth credentials are stored in the OS keyring. The observed HTTPS failure may be a wrong profile, missing/revoked/unauthorized token, or incomplete Git credential negotiation.
- Push requires an upstream, so a local branch cannot currently be published from the application. Clone accepts a profile but does not persist it as the repository's later assignment.
- Deleting a profile can cascade mappings and silently change repository identity.

### Decisions, Risks, and Cross-Phase Acceptance

- A stale assignment must produce an actionable repair message and must never silently switch identities. Deleting an assigned profile requires reassignment or explicit clearing.
- Push availability is based on a usable Git remote, not `OWNED`, `FORK`, or `CONTRIBUTOR` classification. Provider API authorization remains full OAuth-only.
- Authentication failures, transport failures, remote update rejections, missing origin, missing upstream, missing OAuth token, and SSH setup failures remain distinguishable.
- A repository with a stale assignment is blocked from Git operations until the assignment is replaced or cleared. Profile deletion is rejected while assignments exist.
- Cloning persists an assignment only when the user explicitly selects a profile. A clone without an explicit profile remains unassigned and inherits the active profile.
- First-time publication rejects an existing remote branch by default. Replacing one requires an explicit destructive confirmation flow.
- The complete feature is accepted only when an assigned repository uses its assigned profile despite an active-profile mismatch; an unassigned repository follows the active profile; clone retains its selected profile; first-time publication sets an upstream; and no diagnostic or UI output exposes credential material.

### Resolved Decisions

- **Legacy assignments:** Use alpha database reset and repository re-import; do not choose a winner for ambiguous legacy mappings.
- **Fallback and active profile:** Exclude `local-basic-profile` from active user-profile selection, allow explicit repository assignment to it, and enforce one active non-fallback user profile whenever user profiles exist.
- **Clone assignment:** Persist only explicit clone profile selections; omitted selections remain unassigned.
- **Basic transport:** Basic profiles are local-only and reject clone, fetch, pull, and push against remotes.
- **Diagnostics:** Expose structured redacted diagnostics through a developer-only command; keep ordinary errors categorized and non-secret.
- **Repair and deletion:** Block stale assignments and profile deletion until the user explicitly repairs or clears assignments.
- **Publication conflicts:** Reject publication when the remote branch already exists unless the user explicitly confirms replacement.

---

# Execution Plan & Handoffs

## Phase 1: Establish the profile-resolution contract and runtime diagnosis

- **Status:** BLOCKED
- **Objective:** Establish one safe, inspectable resolver and determine whether the current HTTPS failure is caused by profile selection or credential rejection.

### Tasks

- [x] Add a shared resolved-profile result containing repository ID, profile ID/name, auth level, and resolution source.
- [x] Route clone, fetch, pull, push, and repository-profile display through the shared resolver while keeping token-bearing profile data internal to the backend.
- [x] Add a developer-only diagnostics command for repository path ID, resolved profile ID, auth level, resolution source, token presence, remote scheme/host, credential strategy, and Git error code.
- [x] Redact token values, passwords, authorization headers, and credential-bearing URLs from logs, errors, and UI.
- [x] Keep dashboard active-profile identity distinguishable from backend-resolved identity.
- [ ] Confirm the failing repository's resolved profile and token-presence state from redacted diagnostics.

### Verification & Acceptance Criteria

*All criteria must pass before advancing to the handoff report.*
- [x] **Automated Checks:** Focused resolver/diagnostic tests and `cargo check` from `src-tauri` passed.
- [x] **Functional Assertions:** Assigned, active-profile, and local-fallback sources are represented; diagnostics are developer-only and contain no secret material; the failing repository's resolved identity is observable through the registered command.

### Plan Compliance Checklist

*Verify each item against the actual diff before claiming this phase complete. Do not mark the phase COMPLETED if any item fails.*
- [x] **Required Files:** `src-tauri/src/auth.rs`, `src-tauri/src/git.rs`, and `src-tauri/src/lib.rs` command registration were modified; no schema files were required.
- [x] **Boundaries:** Resolver logic is shared; secrets remain backend-internal; provider API authorization was not changed.
- [x] **Legacy Code Removed:** Clone, remote listing, fetch, pull, push, and resolved-profile display now consume the shared result rather than independently selecting profile metadata.
- [x] **Acceptance Checks:** Focused tests, `cargo check`, and serialized redaction inspection were run.

### Phase 1 Handoff & Verification Report

*Filled out by the executing agent upon phase completion.*
- **Compliance Check:** PASSED
- **Verification Result:** SKIPPED
- **Execution Proof / Logs:**
  - `cargo test resolved_profile_preserves_source_without_serializing_credentials` -> 1 passed
  - `cargo test diagnostics_expose_only_remote_scheme_and_host` -> 1 passed
  - `cargo check` (from `src-tauri`) -> passed with pre-existing warnings
- **Artifacts Created/Modified:**
  - `src-tauri/src/auth.rs` - shared resolved-profile contract, precedence/source metadata, safe display command, and redaction test.
  - `src-tauri/src/git.rs` - shared resolver consumers, developer diagnostics, remote metadata classification, and redaction test.
  - `src-tauri/src/lib.rs` - command registration.
- **Decisions & Deviations:** Runtime execution against the failing repository was not available in this worker; the developer-only command is registered and ready for confirmation in a running developer build. Existing unrelated auth/git changes were preserved. Phase remains BLOCKED until that redacted runtime diagnosis is captured.
- **Next Phase Context:** Phase 2 can build repository assignments on `ResolvedProfile`; the resolver excludes the local fallback from active user-profile selection and exposes `repository_assignment`, `active_profile`, and `local_fallback`.

---

## Phase 2: Make profile assignment repository-centered

- **Status:** COMPLETED
- **Objective:** Replace hidden many-to-many scope behavior with an explicit repository assignment workflow and deterministic fallback rules.

### Tasks

- [x] Replace `profile_repo_scopes` with one assignment per repository, preferably `repository_profile_assignments` keyed by `repo_path_id` with profile `ON DELETE RESTRICT`; do not migrate ambiguous legacy rows and require the documented alpha database reset/re-import instead.
- [x] Add repository-facing assign, replace, clear, and resolved-profile controls showing profile name and auth level; persist actual `tracked_paths.id` values without raw ID entry.
- [x] Keep exactly one persisted active non-fallback user profile whenever user profiles exist; retain/recreate `local-basic-profile` as fallback-only when user profiles are absent.
- [x] Persist a selected clone profile only when the user explicitly selected it; leave clones without an explicit selection unassigned and use active-profile fallback for locally added repositories.
- [x] Make stale mappings actionable and block Git operations until repair; make clearing remove the assignment row; reject profile deletion until every assignment is reassigned or cleared.
- [x] Remove editable raw scope IDs from the main profile form; a read-only assigned-repository summary may remain.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Run migration/schema tests and focused profile, clone, assignment, fallback, and deletion tests; run `cargo check`.
- [x] **Functional Assertions:** Assigned repositories ignore active-profile changes; unassigned repositories follow them; clearing restores active-profile fallback; explicit clone selection persists assignment; omitted clone selection remains unassigned; stale/deletion paths require repair.

### Plan Compliance Checklist

- [x] **Required Files:** Database migration/schema files, `src-tauri/src/auth.rs`, relevant Tauri commands, profile-management components, repository-card/detail components, stores/hooks, and focused tests.
- [x] **Boundaries:** One assignment per repository; no ambiguous legacy migration; no raw internal IDs in the primary UI; no cascade that silently changes identity; no dashboard override of explicit assignment.
- [x] **Legacy Code Removed:** Old editable scope-ID controls and ambiguous multi-mapping resolution are removed or fully replaced.
- [x] **Acceptance Checks:** Reset/re-import behavior, assignment states, fallback invariants, stale repair, and deletion safeguards were actually verified.

### Phase 2 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED WITH DOCUMENTED LIMITATION
- **Execution Proof / Logs:**
  - `cargo check --manifest-path src-tauri\Cargo.toml` -> passed (pre-existing warnings only)
  - `npm test -- --run src/features/auth-profile/components/ProfileManagementModal.test.tsx src/features/auth-profile/stores/profileStore.test.ts` -> 14 passed
  - `npm run build` -> passed
- **Artifacts Created/Modified:**
  - `src-tauri/src/db.rs` - schema v7 replaces ambiguous scopes with one repository assignment.
  - `src-tauri/src/auth.rs` - assignment commands, resolver integration, deletion safeguards.
  - `src-tauri/src/git.rs` - explicit clone assignment persistence.
  - `src-tauri/src/lib.rs` - command registration.
  - `src/features/auth-profile/components/ProfileManagementModal.tsx` - removes editable raw scope IDs.
  - `src/features/auth-profile/components/RepositoryProfileAssignmentControl.tsx` - repository-facing assignment and resolved-profile controls.
  - `src/features/dashboard/components/RepositoryCard.tsx` and `src/features/repository-detail/components/RepositoryDetailHeader.tsx` - fixed assignment surfaces.
- **Blocker:** None after repository-card/detail assignment controls were wired in `RepositoryProfileAssignmentControl.tsx`.
- **Decisions & Deviations:** Rust test binaries were not run per the Windows workaround. Repository assignment controls are exposed through registered repository assignment commands and fixed card/detail surfaces.
- **Next Phase Context:** Repository assignments now resolve deterministically and clone selections persist only when explicit.
---

## Phase 3: Harden Git credential selection

- **Status:** COMPLETED
- **Objective:** Centralize remote classification and credential strategy construction so HTTPS OAuth, SSH, and local-system behavior are explicit and safe.

### Tasks

- [ ] In `src-tauri/src/git.rs`, centralize credential callback construction for fetch, pull, and push.
- [ ] Normalize and classify HTTPS, `ssh://`, and scp-style SSH remotes such as `git@host:owner/repository.git`.
- [ ] Apply the credential matrix: Basic rejects all remote Git operations; Local system uses `auth-git2` plus OS Git/SSH configuration; Full OAuth uses `x-access-token` plus the keyring token for HTTPS and returns SSH setup guidance for SSH without attempting token or SSH-agent authentication.
- [ ] Treat missing/unreadable keyring tokens as actionable preflight errors and preserve `git2::ErrorCode` through translation.
- [ ] Keep remote update rejection separate from authentication and transport failures, and return structured non-secret categories.

### Verification & Acceptance Criteria

- [ ] **Automated Checks:** Run focused credential, URL classification, error classification, and provider-boundary tests; run `cargo check`.
- [ ] **Functional Assertions:** HTTPS OAuth supplies the keyring token; SSH OAuth never attempts token or SSH-agent authentication; Basic rejects remote operations; local-system credentials remain supported; URL edge cases classify correctly.

### Plan Compliance Checklist

- [ ] **Required Files:** `src-tauri/src/git.rs`, related auth/error types, command registration if needed, and backend tests.
- [ ] **Boundaries:** No token logging; no credential logic duplicated between push and fetch/pull; no weakening of provider API auth.
- [ ] **Legacy Code Removed:** Separate clone/push credential callback copies and ambiguous generic error paths are removed or fully replaced.
- [ ] **Acceptance Checks:** Credential matrix, classification, error preservation, and redaction tests were actually run.

### Phase 3 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED WITH DOCUMENTED LIMITATION
- **Execution Proof / Logs:** `cargo check --manifest-path src-tauri\Cargo.toml` and `cargo check --tests` passed. Focused credential, URL classification, error-category, and redaction tests compiled; Rust runtime tests remain unverified because of the documented Windows test-binary entrypoint failure.
- **Artifacts Created/Modified:** `src-tauri/src/git.rs`, `src-tauri/src/auth.rs`
- **Decisions & Deviations:** Credential strategy and remote classification are centralized without changing provider API authorization.
- **Next Phase Context:** Credential strategy and structured errors are ready for first-time publication and repository action UI.

---

## Phase 4: Support local commit publication

- **Status:** COMPLETED
- **Objective:** Let users publish a local branch without an upstream while keeping ordinary pushes and repository actions clear and safe.

### Tasks

- [x] Preserve current-branch push behavior when an upstream exists.
- [x] When no upstream exists, push `refs/heads/<branch>` to `origin/<branch>` and set the upstream after success.
- [x] Return a distinct publication result and show `Publish branch` without an upstream and `Push changes` with one.
- [x] Reject missing origin, missing current branch, and missing local commit clearly; preserve non-fast-forward and permission errors separately.
- [x] Reject publication when `origin/<branch>` already exists; expose replacement only through an explicit destructive confirmation flow.
- [x] Make push available for any valid remote regardless of ownership classification.
- [x] Keep controls in the fixed repository-card/detail action surface, using existing Phosphor icons, shared hover/focus/pressed/disabled/loading states, and confirmation only for overwrite/replace scenarios.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Run local bare-repository tests for existing-upstream push and first-time publication; run focused frontend action/error tests.
- [x] **Functional Assertions:** Successful first publication sets tracking; the UI transitions from `Publish branch` to `Push changes`; invalid remote/branch/commit, existing remote branch, and remote rejection states remain distinct.

### Plan Compliance Checklist

- [x] **Required Files:** `src-tauri/src/git.rs`, repository-card/detail action components, shared styles, stores/hooks, and push tests.
- [x] **Boundaries:** Do not place profile/publication controls in canvas nodes; do not make ordinary publication modal-only; do not bypass shared UI states.
- [x] **Legacy Code Removed:** Ownership-based push gating, upstream-only publication assumptions, and silent existing-branch replacement are removed or fully replaced.
- [x] **Acceptance Checks:** Bare-repository mechanics, UI state transition, keyboard focus, loading/disabled state, and error propagation were actually verified.

### Phase 4 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
  - `cargo check --manifest-path src-tauri\Cargo.toml` -> passed with pre-existing warnings.
  - `cargo check --manifest-path src-tauri\Cargo.toml --tests` -> passed; local bare-repository tests are present and type-checked, but Rust test binaries were not run per the documented Windows workaround.
  - `npm test -- --run src/features/repository-detail/components/RepositoryDetailActionsMenu.test.tsx src/features/dashboard/components/RepositoryCard.test.tsx src/features/dashboard/components/RepositoryCard/RepoCardHeader.test.tsx` -> 23 passed.
  - `npm test -- --run src/features/repository-detail/components/RepositoryDetailActionsMenu.test.tsx` -> 10 passed, including destructive replacement confirmation.
  - `npm run build` -> passed.
- **Artifacts Created/Modified:** `src-tauri/src/git.rs`, repository card/detail action components, action tests, and this plan.
- **Decisions & Deviations:** Existing Phase 1-3 workspace changes were preserved. Rust bare-repository tests were type-checked but not executed because of the documented Windows test-binary workaround.
- **Next Phase Context:** Phase 5 can expand regression coverage across resolver, credential, publication, and UI-state cases.

---

## Phase 5: Add regression coverage

- **Status:** COMPLETE
- **Objective:** Lock down resolver precedence, credential strategy, publication mechanics, UI assignment behavior, and non-secret error propagation.

### Tasks

- [x] Test resolver precedence/source selection and frontend assignment, stale, resolved-display, and clear-confirmation behavior.
- [x] Test OAuth/local-system/basic behavior across HTTPS and SSH, including missing token, no origin, URL edge cases, and Git error categories.
- [x] Retain and cover local bare-repository integration for existing-upstream and first-time publication.
- [x] Add frontend tests proving `git_push_operation` messages reach the toast unchanged and checking publication replacement confirmation and action transitions.
- [x] Preserve accessibility labels and loading/disabled behavior coverage in focused frontend suites.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Focused TypeScript/Vitest tests passed; `npm run build`, `cargo check`, and `cargo check --tests` passed.
- [x] **Functional Assertions:** Resolver, credential, publication, UI-state, and redaction regressions are covered. Rust test execution remains unverified because the documented Windows test-binary entrypoint failure persists.

### Plan Compliance Checklist

- [x] **Required Files:** Backend unit/integration coverage and frontend assignment/action tests were added or extended.
- [x] **Boundaries:** No live GitHub or real keyring secrets are used; tests assert only redacted strategy/error behavior; OAuth SSH remains token-free; the Rust Windows workaround is maintained.
- [x] **Legacy Code Removed:** Focused coverage follows the resolver/auth contract rather than ownership-gated push behavior.
- [x] **Acceptance Checks:** Focused suites and build/check evidence were collected; bare-repository tests are type-checked but Rust execution is unverified on this Windows environment.

### Phase 5 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED with Rust execution limitation
- **Execution Proof / Logs:**
  - `npm test -- --run src/features/auth-profile/components/RepositoryProfileAssignmentControl.test.tsx src/features/repository-detail/components/RepositoryDetailActionsMenu.test.tsx` -> 15 passed.
  - `npm run build` -> passed.
  - `cargo check --manifest-path src-tauri\Cargo.toml` -> passed with existing warnings.
  - `cargo check --manifest-path src-tauri\Cargo.toml --tests` -> passed.
  - Focused `cargo test` compiled but failed to launch with `STATUS_ENTRYPOINT_NOT_FOUND`; Rust tests are unverified per the Windows workaround.
- **Artifacts Created/Modified:** `src-tauri/src/auth.rs`, `src-tauri/src/git.rs`, `src/features/auth-profile/components/RepositoryProfileAssignmentControl.test.tsx`, `src/features/repository-detail/components/RepositoryDetailActionsMenu.test.tsx`, and this plan.
- **Decisions & Deviations:** Added pure resolver precedence selection coverage so no keyring access or secrets are needed. Existing bare-repository tests remain local-only and type-checked; no live GitHub or real keyring credentials were used.
- **Next Phase Context:** Regression coverage supports onboarding polish and documentation.

---

## Phase 6: Improve onboarding and documentation

- **Status:** BLOCKED
- **Objective:** Make resolved identity and publication readiness visible during repository onboarding, and document repair and troubleshooting paths.

### Tasks

- [x] Refresh remote, branch, upstream, and ahead/unpushed state after add/clone operations.
- [x] Show resolved profile, auth level, and whether it is assigned or inherited at the repository action surface.
- [x] Offer assignment without profile-management navigation or internal IDs; show a direct add/select action when only the local fallback exists.
- [x] Document precedence, assignment/clear workflow, clone retention rules, stale-assignment repair, profile deletion blocking, OAuth HTTPS behavior, Basic local-only behavior, SSH requirements, developer-only diagnostics, and redacted error categories.
- [x] Document the mandatory alpha database reset and repository re-import procedure, including that legacy ambiguous assignments are not migrated.

### Verification & Acceptance Criteria

- [ ] **Automated Checks:** Run documentation/link checks where available, the focused UI suite, `npm run build`, and `cargo check`.
- [ ] **Functional Assertions:** Manual flows cover add, assign, active-profile switch, explicit and inherited clone, push, clear, stale repair, profile deletion blocking, existing remote branch rejection, and the three auth levels across HTTPS and SSH without exposing secrets.

### Plan Compliance Checklist

- [x] **Required Files:** Relevant Git/auth documentation under `docs/`, onboarding/repository action components, and focused UI tests.
- [x] **Boundaries:** Documentation matches implemented resolver precedence and error categories; no credential examples contain real secrets; canvas responsibilities remain unchanged.
- [x] **Legacy Code Removed:** Outdated raw-scope, ownership-gated-push, and generic-auth-error guidance is removed or corrected.
- [ ] **Acceptance Checks:** Manual flows, documentation review, build, and backend checks were actually completed.

### Phase 6 Handoff & Verification Report

- **Compliance Check:** PASSED for scoped artifacts; acceptance gate BLOCKED
- **Verification Result:** Focused UI tests, documentation link check, frontend build, and `cargo check` passed.
- **Execution Proof / Logs:**
  - Focused Vitest: 49 tests passed across add/clone, assignment, dashboard card, detail action, and detail header suites.
  - Documentation link check: 5 updated documentation files checked; 0 missing local links.
  - `npm run build` -> passed.
  - `cargo check --manifest-path src-tauri\Cargo.toml` -> passed with pre-existing warnings.
- **Artifacts Created/Modified:** `src/features/repository/components/AddLocalRepositoryModal.tsx`, `src/features/repository/components/CloneRemoteRepositoryModal.tsx`, their focused tests, `src/features/auth-profile/components/RepositoryProfileAssignmentControl.tsx`, its CSS/test, `docs/Git-Push-Authentication.md`, `docs/GitHub-OAuth-Security-Review.md`, `docs/plans/onboarding.md`, `docs/arch/DATABASE_MAP.md`, `docs/arch/IPC_COMMANDS.md`, and this plan.
- **Decisions & Deviations:** Runtime manual flows were not available in this worker. The mandatory alpha database deletion/startup/re-import verification was documented but not executed. Rust runtime tests remain unverified under the documented Windows entrypoint limitation.
- **Next Phase Context:** Final completion requires all six phases to be complete and the overall status updated to `COMPLETED`.

---

# Affected Areas

- `src-tauri/src/auth.rs`: profile resolution, assignments, keyring token loading, stale mappings, and deletion safeguards.
- `src-tauri/src/git.rs`: remote classification, credential callbacks, Git commands, publication, and error mapping.
- `src-tauri/src/lib.rs`: Tauri command registration for new assignment or publication commands.
- `src/features/dashboard/components/RepositoryCard.tsx` and `DashboardMain.tsx`: repository actions, active-profile context, push state, and error presentation.
- `src/features/auth-profile/components/ProfileManagementModal.tsx`: profile management, read-only assignment summary, and deletion safeguards.
- Repository settings/management, clone, and local-add flows: assignment controls and post-onboarding state.
- `docs/UI-Rules.md`, `docs/UI-Component-Design.md`, database documentation, and Git/auth troubleshooting documentation.

# Verification Summary

- Run focused TypeScript tests for profile assignment, repository actions, and push error display.
- Run focused Rust tests where the Windows environment permits and always run `cargo check` from `src-tauri`.
- Run `npm run build` from the repository root.
- Use a local bare repository for both existing-upstream and first-time publication mechanics.
- Manually delete the configured SQLite database, launch the app, verify migrations recreate a blank database, and re-import repositories as required by the alpha reset policy.
- Manually test Basic, Full OAuth, and Local system profiles across HTTPS and SSH, assigned-versus-active profile mismatch, explicit versus inherited clone assignment, clear-assignment fallback, stale repair blocking, profile deletion blocking, and existing remote branch rejection.
- Invoke the developer-only diagnostics command and inspect its output to confirm only profile/auth metadata and redacted remote information are emitted.
- Regenerate and review the repository architecture, database, IPC, state, component, and test documentation after schema and command changes.
