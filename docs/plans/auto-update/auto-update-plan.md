---
title: "Branch Schematic Auto-Update - Implementation Plan"
status: BLOCKED_PENDING_SIGNING_REHEARSAL
current_phase: 5 / 5
created: 2026-09-15
last_updated: 2026-09-15
---

# Overall Plan Completion Status

* **Final State:** IMPLEMENTED_PENDING_REHEARSAL
* **Total Phases Completed:** 4 / 5
* **Summary of Outcome:** Native updater support, the React update experience, and a fail-closed draft release pipeline are implemented. Phase 5 remains blocked on maintainer signing secrets, a real draft release, and Windows installation rehearsal.

# Specification & Overview

### 1. Scope & Objective
- **Source:** `docs/plans/auto-update/guide.md`, the supplied reusable Tauri 2 updater guide.
- **Goal:** Add a signed, user-consented desktop update flow for Branch Schematic using the official Tauri updater plugin and GitHub Releases as a static update feed, with a repeatable tagged-release pipeline.
- **In-Scope:** Tauri updater and process dependencies; signed updater artifact configuration; Rust plugin registration and scoped permissions; a feature-local React coordinator and UI; metadata-only startup checks; explicit download/install/restart actions; retryable error states; version consistency validation; a GitHub Actions draft-release pipeline; release rehearsal and documentation.
- **Out-of-Scope:** A custom update server or GitHub API client; Authenticode signing; automatic silent installation; database migrations; unrelated repository or workspace behavior; multi-platform publishing before the first supported platform is rehearsed successfully.
- **Owner Dependency:** The maintainer will generate and securely back up the updater private key and add `TAURI_SIGNING_PRIVATE_KEY` plus, when applicable, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub Actions repository secrets. The private key and password must never enter the repository, frontend, logs, or generated artifacts.

### 2. Technical Constraints & Architecture
- Use the official Tauri 2 updater and process plugins, the existing npm/Cargo toolchains, React 19, the feature-driven structure under `src/features/`, and the existing Phosphor icon and notification conventions.
- Keep updater calls behind a typed coordinator/API boundary rather than scattering native plugin calls through routes. The boundary must distinguish metadata checking from artifact download and installation.
- The initial release target, bundle format, update channel, restart policy, release-note source, and stable endpoint timing are fixed by the closed decision record below. The first supported target is Windows x64 with the NSIS bundle.
- Treat `src-tauri/tauri.conf.json` as the authoritative application version and synchronize it with `package.json`, `src-tauri/Cargo.toml`, the release tag, and visible version UI. Do not guess the GitHub owner/repository or embed a placeholder endpoint in a production build.
- Keep updater permissions scoped to the existing main-window capability. Do not add shell or filesystem permissions for updater behavior.
- Browser/preview mode must not report a successful update check when Tauri APIs are unavailable. Startup checks must be non-blocking and must not make the core application unusable.
- No database schema change is required by the source guide. If notification suppression is persisted, first inspect existing notification/settings persistence and use an existing appropriate store rather than inventing a migration without a requirement.

### 3. Closed Decision Record
- **First supported target:** Windows x64 with the NSIS bundle only. Other platforms remain out of scope until this target completes rehearsal.
- **Channel and tags:** Stable production releases only, using non-prerelease semantic-version tags in the form `vX.Y.Z`.
- **Repository and release mode:** `ChefMooon/branch-schematic`; the first tagged workflow run creates a draft release for inspection before publication.
- **Release notes:** A committed `CHANGELOG.md` entry is the source of release notes and must be present before the tagged workflow runs.
- **Restart behavior:** Install with `restartAfterInstall: false`, transition to an explicit ready-to-restart state, and call `relaunch()` only after user confirmation.
- **Endpoint modes:** Development/preview builds disable updater checks; rehearsal builds use an explicit tag-specific or temporary published feed; production uses `https://github.com/ChefMooon/branch-schematic/releases/latest/download/latest.json` only after rollout approval.
- **Notification suppression:** Deferring an update suppresses startup notification for that update during the current app session only. The update remains available through About and manual check; no database migration or persistent suppression setting is required.
- **Validation command:** Do not add a generic `npm run check` solely for this feature. Use existing test/build commands plus focused updater, manifest, version, and configuration checks.
- **External prerequisite owner:** The maintainer generates and backs up the updater key outside the repository and adds the required GitHub Actions secrets. Secret values are never recorded in this plan or logs.

---

# Execution Plan & Handoffs

## Phase 1: Release Policy and Signing Prerequisites
- **Status:** COMPLETED_WITH_EXTERNAL_PREREQUISITE_PENDING
- **Objective:** Close the decisions and external prerequisites that determine configuration, UI behavior, and release validation.

### Tasks
- [ ] Record the closed release decisions above and verify the current Git remote matches `ChefMooon/branch-schematic`.
- [ ] Generate the Tauri updater key pair manually outside the repository, back it up securely, verify the public key/private key match, and add the required GitHub Actions secrets supplied by the maintainer.
- [ ] Inspect the existing version surfaces, release workflow directory, About/Settings entry points, notification persistence, and test conventions; record the verified surfaces in the Phase 1 report.
- [ ] Define the release-note entry format and require the committed `CHANGELOG.md` entry before tagging.

### Verification & Acceptance Criteria
- [ ] **Automated Checks:** Confirm the repository has a working baseline with `npm test`, `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, and `cargo check --manifest-path src-tauri/Cargo.toml` (use `cargo check` rather than the focused Rust test suite per repository instructions).
- [ ] **Functional Assertions:** The decision record identifies the first platform/bundle, channel and endpoint strategy, tag/version convention, release-note source, and restart behavior; no private signing material is present in the worktree; the maintainer records key/secret readiness without recording secret values.

### Plan Compliance Checklist
- [ ] **Required Files:** `docs/plans/auto-update/guide.md` remains the source; decision notes and owner prerequisites are recorded in this plan or the implementation handoff without modifying the guide.
- [ ] **Boundaries:** Do not add updater code, secrets, generated signatures, or release artifacts in this phase.
- [ ] **Legacy Code Removed:** None required; no existing behavior is replaced during preparation.
- [ ] **Acceptance Checks:** Baseline commands and external prerequisite checks are actually recorded before Phase 2 starts.

### Phase 1 Handoff & Verification Report
- **Compliance Check:** PASS for repository inspection and decision record; signing-key readiness remains external and unverified.
- **Verification Result:** `npm test` passed (49 files, 263 tests). The baseline build completed successfully during implementation validation. The remote matches `ChefMooon/branch-schematic`; `CHANGELOG.md` was added during Phase 4. Cargo fmt remains blocked by pre-existing differences in `src-tauri/src/auth.rs` and `src-tauri/src/git.rs`.
- **Execution Proof / Logs:** Captured in `docs/reports/2026-09-15-auto-update-implementation-report.md`.
- **Artifacts Created/Modified:** Version/release surfaces inspected; no signing material created.
- **Decisions & Deviations:** The maintainer-owned key and GitHub secrets were not available in the worktree and were never generated or recorded.
- **Next Phase Context:** Native implementation proceeded with updater artifact generation and production endpoint fail-closed until the real public key is supplied.

---

## Phase 2: Tauri Updater Foundation
- **Status:** IMPLEMENTED_PENDING_PUBLIC_KEY
- **Objective:** Make the native application capable of checking, downloading, verifying, installing, and optionally relaunching signed updates.

### Tasks
- [ ] Add compatible `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` dependencies; update npm and Cargo lockfiles through the existing package tooling.
- [ ] Register the updater plugin and optional process plugin in the existing builder chain in `src-tauri/src/lib.rs` without disturbing database startup, tray setup, or existing plugins.
- [ ] Add only the updater defaults and process restart permission required by the selected flow to the capability covering the main window; verify whether `desktop.json` also applies to the target and update it only if required by the Tauri capability model.
- [ ] Configure the embedded public key, HTTPS endpoint strategy, updater artifact generation, and deliberate bundle target in `src-tauri/tauri.conf.json` using confirmed repository/version values.
- [ ] Configure development/preview builds to disable updater checks, rehearsal builds to use an explicit tag-specific or temporary published feed, and production builds to use the stable `ChefMooon/branch-schematic` endpoint only at rollout.
- [ ] Verify the generated Tauri capability schema and configuration accept the new permissions and plugin settings; ensure updater permissions are scoped to `main` without adding new shell or filesystem permissions.

### Verification & Acceptance Criteria
- [ ] **Automated Checks:** Run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `npm run build`, and the Tauri configuration/build validation appropriate to the selected bundle.
- [ ] **Functional Assertions:** The packaged app contains the configured public key and intended channel endpoint, the runtime registers the required plugins, updater permissions apply only to the main window, development builds do not claim update success, and no private key or password is committed.

### Plan Compliance Checklist
- [ ] **Required Files:** `package.json`, `package-lock.json` if dependency installation changes it, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` if dependency installation changes it, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, the applicable capability JSON file(s), and generated capability/schema outputs if the project requires them.
- [ ] **Boundaries:** Do not add custom Rust update commands, direct GitHub API/download code, broad shell/filesystem permissions, or database migrations.
- [ ] **Legacy Code Removed:** Remove no unrelated plugins or permissions; replace only temporary/placeholder updater configuration introduced during this phase.
- [ ] **Acceptance Checks:** Native checks and configuration validation are run against the actual diff.

### Phase 2 Handoff & Verification Report
- **Compliance Check:** PASS for native integration and scoped permissions; signed artifact configuration is gated pending the real public key.
- **Verification Result:** `cargo check`, `npm run build`, `npm run tauri build -- --no-bundle --debug`, and `git diff --check` passed. Cargo fmt is blocked only by pre-existing `auth.rs`/`git.rs` formatting drift.
- **Execution Proof / Logs:** Captured in `docs/reports/2026-09-15-auto-update-implementation-report.md`.
- **Artifacts Created/Modified:** `package.json`, lockfiles, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`.
- **Decisions & Deviations:** No fake public key, endpoint, private key, installer, or signature was added.
- **Next Phase Context:** Frontend coordinator can use the native APIs and reports unsupported/gated runtime states honestly.

---

## Phase 3: Frontend Update Experience
- **Status:** COMPLETED
- **Objective:** Provide a resilient, testable React update workflow integrated with the existing About/Settings and global layout/notification surfaces.

### Tasks
- [ ] Create a feature-local `src/features/auto-update/` boundary containing typed update metadata/state, the native API adapter or coordinator, focused tests, and UI components as needed; keep components small and aligned with existing conventions.
- [ ] Implement legal states for idle/checking/up-to-date/available/deferred/downloading/installing/ready-to-restart/restarting/offline/failed, with guarded duplicate operations and retry paths.
- [ ] Define coordinator ownership of the updater object returned by `check()`, invalidate stale results after retry/defer, and guard concurrent check/download/install/relaunch operations.
- [ ] Ensure startup checks request metadata only, are non-blocking, suppress the deferred version for the current session only, and never download installer bytes before user consent.
- [ ] Show current and available versions, release date/notes, release-page link where provided, last-check status, download progress, failure detail, retry, defer, install, and the selected restart action.
- [ ] Integrate the update UI with the existing About route and/or Settings route, shared `NotificationProvider`, `AppLayout` startup lifecycle, and existing button/modal/accessibility patterns. Use the shared outside-dismiss/backdrop patterns for any new overlays.
- [ ] Handle static browser preview mode explicitly so it reports unsupported runtime status rather than false update success.
- [ ] Add keyboard-focus, accessible progress/status semantics, disabled-action, retry, and explicit-restart coverage for the update UI.

### Verification & Acceptance Criteria
- [ ] **Automated Checks:** Add focused Vitest/Testing Library coverage and run the relevant auto-update test file(s), then run `npm test`, `npm run build`, and the focused updater/configuration checks defined in Phase 4.
- [ ] **Functional Assertions:** Tests prove metadata checks do not download; consent gates download/install; stale updater results cannot install; progress updates are monotonic and visible; duplicate operations are guarded; legal failures are retryable; session-only suppression works; restart behavior uses explicit confirmation; preview mode is honest; and update controls satisfy the accessibility contract.

### Plan Compliance Checklist
- [ ] **Required Files:** New modules under `src/features/auto-update/`, the integrated `src/routes/about.tsx` and/or `src/routes/settings.tsx`, the owning startup/layout file identified during implementation, and focused test files adjacent to the feature.
- [ ] **Boundaries:** Do not put updater API calls in unrelated route components, bypass the shared notification/modal patterns, or download installer URLs directly from the frontend.
- [ ] **Legacy Code Removed:** Remove any temporary mock/placeholder update path before completion; preserve the existing About/Settings behavior outside the update surface.
- [ ] **Acceptance Checks:** Focused tests and the full frontend test/build checks are run and their results recorded.

### Phase 3 Handoff & Verification Report
- **Compliance Check:** PASS for the testable frontend contract.
- **Verification Result:** Focused and full frontend tests passed (51 files, 275 tests); `npm run build` passed.
- **Execution Proof / Logs:** Captured in `docs/reports/2026-09-15-auto-update-implementation-report.md`.
- **Artifacts Created/Modified:** `src/features/auto-update/`, `src/components/layout/AppLayout.tsx`, `src/routes/about.tsx`, and `src/routes/settings.tsx`.
- **Decisions & Deviations:** Update controls are exposed through About and Settings; startup checks are non-blocking and session-only suppression is in memory.
- **Next Phase Context:** A valid signed feed and packaged Windows build are required for end-to-end validation.

---

## Phase 4: Signed GitHub Release Pipeline
- **Status:** IMPLEMENTED_PENDING_REHEARSAL
- **Objective:** Publish signed updater artifacts and a correct static manifest from a tagged GitHub Actions release.

### Tasks
- [x] Add a release workflow under `.github/workflows/` using the repository's Node/Rust setup, lockfile installation, least required `contents: write` permission, and the confirmed tag pattern.
- [x] Add a PowerShell version-consistency check comparing `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`, and the normalized `vX.Y.Z` tag; test matching, mismatched, prerelease, malformed, and `v`-prefixed inputs.
- [x] Pin and configure a compatible `tauri-apps/tauri-action` version with the Windows x64/NSIS target, signing secrets, `ChefMooon/branch-schematic` release, draft-first behavior, updater manifest upload, and signature upload.
- [x] Require the committed `CHANGELOG.md` entry before the build and pass it into the release body so generated `latest.json` contains the intended notes; document the required tag/release procedure.
- [x] Add a static manifest/asset validation check for the Windows platform key, version, installer URL, release notes, publication date, and non-empty signature.
- [x] Keep the production endpoint disabled or tag-specific until a published rehearsal validates the feed, then set the stable `releases/latest/download/latest.json` endpoint only at the rollout gate.
- [x] Update the updater guide or add a concise project-specific runbook only where the implementation differs from the reusable source guide; document updater signing versus optional Authenticode signing.

### Verification & Acceptance Criteria
- [x] **Automated Checks:** Run workflow/configuration lint or equivalent static validation, `npm ci` in a clean environment, version-check logic against matching and mismatching fixtures, manifest/asset validation, `npm test`, `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- [ ] **Functional Assertions:** A draft tagged release contains only the intended NSIS updater artifacts plus `.sig` and `latest.json`; the manifest has the Windows x64 platform key, correct version, installer URL, committed release notes/date, and non-empty signature; logs do not expose signing secrets.

### Plan Compliance Checklist
- [ ] **Required Files:** A new or updated `.github/workflows/<release-workflow>.yml`, relevant lockfiles/manifests, `src-tauri/tauri.conf.json`, and the project-specific release/update documentation selected during implementation.
- [ ] **Boundaries:** Do not commit private keys, passwords, generated installers/signatures, replacement tokens, or Authenticode work; do not grant more GitHub permission than release asset publication needs.
- [ ] **Legacy Code Removed:** Replace no existing docs workflow; ensure any temporary rehearsal endpoint/configuration is removed before stable rollout.
- [ ] **Acceptance Checks:** Workflow validation and a real draft release inspection are recorded before Phase 5.

### Phase 4 Handoff & Verification Report
- **Compliance Check:** IMPLEMENTATION_COMPLETE_EXTERNAL_REHEARSAL_PENDING
- **Verification Result:** Local workflow/config static validation, `npm ci`, version fixtures, manifest fixtures, `npm test` (51 files / 275 tests), `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `git diff --check` passed. `cargo fmt --check` remains blocked by pre-existing formatting differences in untouched Rust files; focused Rust tests were not run per repository guidance. `actionlint` was unavailable locally.
- **Execution Proof / Logs:** `npm run test:version`; `npm run test:updater-manifest`; release-config substitution and missing-public-key gate checks; `npm ci`; `npm test`; `npm run build`; `cargo check --manifest-path src-tauri/Cargo.toml`; `git diff --check`.
- **Artifacts Created/Modified:** `.github/workflows/release.yml`, `CHANGELOG.md`, `docs/auto-update-release-runbook.md`, `scripts/check-version-consistency.ps1`, `scripts/test-version-consistency.ps1`, `scripts/prepare-release-config.mjs`, `scripts/validate-updater-manifest.mjs`, `scripts/test-updater-manifest.mjs`, and package scripts in `package.json`.
- **Decisions & Deviations:** The requested `gpt-5.6-luna` model was unavailable; the default model was used. The committed updater configuration remains deliberately gated without a public key or endpoint. The workflow requires maintainer-provided `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and optional password secret, then uses a temporary tag-specific configuration. No real GitHub draft release or signed installer was run, and no Authenticode work was added.
- **Next Phase Context:** The maintainer must configure the signing key secrets/public-key variable, push a matching tag, inspect the draft NSIS assets and `latest.json`, and complete the Phase 5 Windows rehearsal before enabling the stable feed.

---

## Phase 5: End-to-End Rehearsal and Rollout
- **Status:** BLOCKED_PENDING_EXTERNAL_REHEARSAL
- **Objective:** Prove the update contract on an older installed build, then enable the stable feed and document the operational release procedure.

### Tasks
- [ ] Run the repository checks required before tagging: `npm test`, `npm run build`, focused updater/configuration/manifest checks, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- [ ] Push a matching version tag and inspect the draft release assets and `latest.json`; verify the platform entry, URL, version, notes, date, and signature.
- [ ] Publish a clearly labeled temporary test release or use a tag-specific endpoint for rehearsal; do not use a draft release to validate the public `releases/latest` URL.
- [ ] On a clean machine with an older build, verify metadata-only startup behavior, explicit consent, download progress, signature verification, installation, and the selected restart path without disrupting normal app use.
- [ ] Exercise offline feed, malformed manifest, missing asset, wrong signature, interrupted download, failed install, duplicate action, and relaunch failure paths; confirm errors remain visible and retryable.
- [ ] After successful rehearsal, enable the stable HTTPS endpoint, publish the intended non-prerelease release, and record the final version/tag and rollback/key-rotation cautions.
- [ ] Document rollback as stopping advertisement of the broken version and publishing a higher fixed version; do not rotate the signing key as the first response to a bad release.

### Verification & Acceptance Criteria
- [ ] **Automated Checks:** All Phase 5 repository checks pass; focused frontend tests and native/configuration checks remain green after the stable endpoint change; workflow run completes without secret leakage.
- [ ] **Functional Assertions:** An older installed build detects the newer release, does not download before consent, accepts only the correctly signed artifact, installs successfully, follows the explicit restart confirmation behavior, and remains usable after failed operations. `releases/latest` resolves to the intended published non-prerelease manifest only after rollout approval.

### Plan Compliance Checklist
- [ ] **Required Files:** Final updater configuration, release workflow, feature implementation/tests, and project-specific release/update documentation; no generated release binaries are committed.
- [ ] **Boundaries:** Do not declare rollout complete from a local mock or draft-only feed; do not disable signature verification to make a failure pass; do not mix Authenticode claims into updater-signature acceptance.
- [ ] **Legacy Code Removed:** Remove tag-specific/test endpoint configuration and temporary release-only switches before stable publication, unless explicitly documented as a supported channel.
- [ ] **Acceptance Checks:** Record real workflow, manifest, installation, failure-path, and stable-feed evidence.

### Phase 5 Handoff & Verification Report
- **Compliance Check:** BLOCKED by maintainer-owned signing secrets and real release execution.
- **Verification Result:** Repository-level checks pass, but no signed draft release, public temporary feed, clean-machine installation, signature rejection test, or explicit relaunch rehearsal was performed.
- **Execution Proof / Logs:** The blocker and required operator steps are recorded in `docs/auto-update-release-runbook.md` and `docs/reports/2026-09-15-auto-update-implementation-report.md`.
- **Artifacts Created/Modified:** No generated installers, signatures, or release binaries committed.
- **Decisions & Deviations:** Stable endpoint remains gated. Do not declare rollout complete from local or draft-only validation.
- **Next Phase Context:** Maintainer must configure secrets, run the tagged draft release, publish a temporary rehearsal release/feed, test an older Windows build, then approve stable rollout.

---

# Implementation Handoff

## Remaining Risks and Assumptions
- The maintainer must still generate the updater key and configure GitHub Actions secrets outside the repository. Secret readiness is a prerequisite for the first signed release, not for frontend/native implementation work.
- GitHub Actions behavior, artifact naming, and manifest generation must be verified against the pinned action version in a real draft release; local configuration checks cannot prove publication behavior.
- Packaged-app installation, signature rejection, restart, and failure-path behavior require a Windows desktop rehearsal and cannot be established by Vitest alone.
- No persistent notification-suppression schema is required; session-only suppression is intentional.

## Implementation-Ready Checklist
- [x] First target is Windows x64/NSIS.
- [x] Production channel is stable `vX.Y.Z`.
- [x] Repository is `ChefMooon/branch-schematic`.
- [x] First tagged workflow run creates a draft.
- [x] Release notes come from committed `CHANGELOG.md`.
- [x] Installation requires explicit restart confirmation.
- [x] Development, rehearsal, and production endpoint behavior is defined.
- [x] Validation does not depend on a nonexistent `npm run check` command.
- [ ] Maintainer-generated signing key and GitHub secrets are ready.
- [x] Phase 1 repository baseline and release surfaces were verified; signing-key readiness remains external.

---