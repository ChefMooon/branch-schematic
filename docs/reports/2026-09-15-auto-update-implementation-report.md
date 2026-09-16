# Branch Schematic Auto-Update Implementation Report

## Overall Status

**Status:** IMPLEMENTED_PENDING_REHEARSAL

The planned native updater foundation, React update experience, and fail-closed Windows NSIS release pipeline are implemented. The work stops at the external Phase 5 boundary because signing secrets, a real GitHub draft release, and a packaged Windows rehearsal require maintainer access and cannot be truthfully simulated locally.

## Scope

Implemented the official Tauri 2 updater/process integration for Windows x64 NSIS, metadata-first and user-consented update behavior, explicit install and restart confirmation, session-only defer suppression, retryable error states, version and manifest validation, and a draft-first GitHub release workflow. No database migration, custom update server, GitHub API client, Authenticode work, private signing material, installer, signature, or generated release artifact was added.

## Execution Model

The five phases were executed sequentially. No plan-approved parallel implementation was used. Each completed implementation phase was followed by focused validation before the next phase began.

The requested subagent model `gpt-5.6-luna` was unavailable in the active tool registry. Implementation workers therefore used the default available subagent model. This is the only orchestration deviation.

## Phase Breakdown

1. **Release policy and signing prerequisites:** Completed for repository inspection and policy confirmation. The remote matches `ChefMooon/branch-schematic`; the maintainer-owned signing key and GitHub secrets remain external prerequisites. The initial `npm test` baseline passed with 49 files and 263 tests. No `CHANGELOG.md` existed at intake; the release pipeline phase added an initial unreleased entry.
2. **Tauri updater foundation:** Implemented with `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, Rust plugin registration, scoped main-window permissions, and Windows NSIS bundle selection. The public key and endpoint remain fail-closed until supplied by the maintainer.
3. **Frontend update experience:** Implemented under `src/features/auto-update/`, integrated into About, Settings, and startup layout behavior. The coordinator owns update objects, separates metadata checks from download/install, guards duplicates and stale results, reports preview/runtime unavailability honestly, and requires explicit restart confirmation.
4. **Signed GitHub release pipeline:** Implemented `.github/workflows/release.yml`, PowerShell version consistency validation, manifest/asset validation, release configuration preparation, `CHANGELOG.md`, and the release runbook. Local checks pass; a real draft release remains unverified.
5. **End-to-end rehearsal and rollout:** Blocked pending maintainer secrets and real release execution. No rollout claim is made.

## Validation Evidence

Passed:

- `npm run test:version`
- `npm run test:updater-manifest`
- `npm ci`
- `npm test` with 51 files and 275 tests passing
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run tauri build -- --no-bundle --debug`
- Node syntax checks for release scripts
- Fail-closed missing-public-key and release-config substitution checks
- `git diff --check`

Not fully available:

- `actionlint` was unavailable locally; equivalent workflow/configuration checks were run.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` reports pre-existing formatting differences in untouched `src-tauri/src/auth.rs` and `src-tauri/src/git.rs`.
- Focused Rust tests were not run, per the repository's Windows workaround instruction.
- No GitHub draft release, signed installer, public temporary feed, clean-machine installation, signature rejection test, or stable-feed rollout was performed.

## Main Artifacts

- [Auto-update implementation plan](../plans/auto-update/auto-update-plan.md)
- [Auto-update release runbook](../auto-update-release-runbook.md)
- [Release workflow](../../.github/workflows/release.yml)
- [Auto-update feature](../../src/features/auto-update/)
- [Version consistency check](../../scripts/check-version-consistency.ps1)
- [Manifest validation](../../scripts/validate-updater-manifest.mjs)
- [Changelog](../../CHANGELOG.md)

## Remaining Blocker and Handoff

The maintainer must complete these steps before Phase 5 can proceed:

1. Generate and back up the Tauri updater key outside the repository.
2. Add `TAURI_SIGNING_PRIVATE_KEY` and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub Actions secrets.
3. Add the matching `TAURI_UPDATER_PUBLIC_KEY` repository variable without exposing private key material.
4. Push a matching stable `vX.Y.Z` tag and inspect the draft NSIS assets and `latest.json`.
5. Publish a clearly labeled temporary rehearsal feed, test an older Windows build through metadata check, consented download, signature verification, install, and explicit restart, and exercise the documented failure paths.
6. Only after successful rehearsal, enable and validate the stable `releases/latest/download/latest.json` endpoint.

Rollback remains publishing a higher fixed version and stopping advertisement of a broken version. Signing-key rotation is not the first response to a bad release.
