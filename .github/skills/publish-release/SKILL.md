---
name: publish-release
description: 'Prepare and publish a Branch Schematic Windows release. Use when bumping the application version, updating the changelog, creating a v<semver> tag, pushing the release workflow, validating Tauri updater assets, or rehearsing the Windows updater flow.'
---

# Branch Schematic Release Workflow

## When to Use

Use this skill for every Windows release, updater rehearsal, or version bump.
The project publishes unsigned Windows NSIS artifacts through
`.github/workflows/release.yml` when a stable `vX.Y.Z` tag is pushed.

The release workflow creates a draft GitHub release. Do not publish it until
the installer and updater manifest have been inspected.

## Release Procedure

1. Add or update the `## [X.Y.Z]` entry in `CHANGELOG.md` before changing the
   version. It must contain at least one bullet point. The workflow extracts
   this entry into the GitHub release body and updater `latest.json` notes.
2. Synchronize the same stable SemVer value in:
   - `package.json`
   - `package-lock.json` root metadata
   - `src-tauri/Cargo.toml`
   - `src-tauri/Cargo.lock` application package entry
   - `src-tauri/tauri.conf.json`
3. Keep the checked-in updater endpoint in `src-tauri/tauri.conf.json` pointed
   at the stable `releases/latest/download/latest.json` feed. The workflow's
   `scripts/prepare-release-config.mjs` deliberately generates a temporary
   `src-tauri/tauri.release.conf.json` with a tag-specific endpoint for the
   release build; do not commit that generated file. Because this project is
   unsigned, the release configuration must not require a public key or emit
   updater signatures.
4. Run the repository checks:
   - `npm run test:version`
   - `npm run test:updater-manifest`
   - `npm test`
   - `npm run build`
   - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
   - `cargo check --manifest-path src-tauri/Cargo.toml`
   - `git diff --check`
5. Verify the exact release tag and configuration as the workflow will:
   - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-version-consistency.ps1 -Tag vX.Y.Z`
   - `node scripts/prepare-release-config.mjs --tag vX.Y.Z --output src-tauri/tauri.release.conf.json` only after the script has been made unsigned-compatible; the current script still requires `TAURI_UPDATER_PUBLIC_KEY`.
   - Remove the generated release config after inspection and never commit it.
6. Commit the complete release change set with a Conventional Commit message,
   create an annotated `vX.Y.Z` tag, and push the branch and tag.
7. Wait for the Windows workflow to finish. Inspect the draft release's NSIS
   installer and `latest.json`. Confirm that `latest.json` has the expected
   version, changelog notes, HTTPS GitHub download URL, and Windows platform
   entry. There must be no `.sig` requirement for this unsigned release.
8. Do not use `scripts/validate-updater-manifest.mjs` unchanged: its current
   contract requires a signature and is for signed updater artifacts. Publish
   the draft only after the unsigned artifact and manifest checks pass. Keep
   the release non-prerelease.

## Update Rehearsal

- The checked-in app uses the stable `releases/latest` endpoint, while a
  release build uses its tag-specific endpoint. Confirm both configurations
  point to the same repository and that the generated release URL contains the
  pushed `vX.Y.Z` tag.
- The existing `npm run test:updater-manifest` and
   `scripts/validate-updater-manifest.mjs` tests currently assert signed
   manifests. Update them before using them as the unsigned release gate.
   For a real draft, download `latest.json` and the NSIS installer and verify
   the manifest contains no signature requirement.
- On Windows, verify the app's updater UX matches the current implementation:
  the update downloads first, then offers installation and restart or deferral.
  Confirm that deferral does not repeatedly notify for the same version and
  that Settings can install a downloaded update.
- Use `node scripts/evaluate-rollout.js diagnostics.json` only for rollout
  diagnostics. A non-zero exit means the stale-state or registration-failure
  threshold requires rollback or a documented mitigation.

## Version and Credential Rules

- Release tags must be stable `vX.Y.Z`; prerelease and build suffixes are
  rejected by `scripts/check-version-consistency.ps1` and
  `scripts/prepare-release-config.mjs`.
- An unsigned release must not require `TAURI_UPDATER_PUBLIC_KEY`,
   `TAURI_SIGNING_PRIVATE_KEY`, or `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Never commit generated release configuration, or release credentials.
- Never commit updater private keys, passwords, Authenticode material, or
  release credentials.
