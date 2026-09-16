---
name: publish-release
description: 'Prepare and publish a Branch Schematic Windows release. Use when bumping the application version, updating the changelog, creating a v<semver> tag, pushing the release workflow, validating Tauri updater assets, or rehearsing the Windows updater flow.'
---

# Branch Schematic Release Workflow

## When to Use

Use this skill for every Windows release, updater rehearsal, or version bump.
The project publishes Windows NSIS artifacts through
`.github/workflows/release.yml` when a stable `vX.Y.Z` tag is pushed.

This project has two independent signing concerns:

- **Windows Authenticode signing** signs the executable/NSIS installer and
   identifies the Windows publisher. The release must not be treated as ready
   until the configured Windows signing provider has signed the installer.
- **Tauri updater signing** signs updater artifacts and adds a `signature`
   value plus a `.sig` asset to `latest.json`. This release requires the
   matching public key and private key credentials; do not disable it to make
   a release pass.

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
3. Keep both the checked-in updater endpoint and the temporary release
   configuration pointed at the stable `releases/latest/download/latest.json`
   feed. The workflow's `scripts/prepare-release-config.mjs` injects
   `TAURI_UPDATER_PUBLIC_KEY` and enables updater artifacts; do not commit its
   generated `src-tauri/tauri.release.conf.json`. Keep this separate from the
   Windows Authenticode signing step.
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
   - Set `TAURI_UPDATER_PUBLIC_KEY` from the repository Actions variable, then run `node scripts/prepare-release-config.mjs --tag vX.Y.Z --output src-tauri/tauri.release.conf.json`; inspect the stable endpoint and matching public key without printing the key.
   - Remove the generated release config after inspection and never commit it.
6. Commit the complete release change set with a Conventional Commit message,
   create an annotated `vX.Y.Z` tag, and push the branch and tag.
7. Wait for the Windows workflow to finish. Inspect the draft release's NSIS
   installer and `latest.json`. Confirm that the installer has a valid
   Authenticode signature from the intended publisher. Confirm that
   `latest.json` has the expected version, changelog notes, HTTPS GitHub
   download URL, Windows platform entry, non-empty updater signature, and
   matching `.sig` asset.
8. Publish the draft only after both the Windows installer-signing check and
   the matching updater-manifest check pass. Keep the release non-prerelease.

## Update Rehearsal

- The checked-in app and release builds use the stable `releases/latest`
   endpoint. Confirm the generated configuration preserves the release version
   and updater key while keeping this moving feed unchanged.
- The existing `npm run test:updater-manifest` and
   `scripts/validate-updater-manifest.mjs` validate the signed updater
   manifest contract. They do not prove Authenticode signing. For a real
   draft, download `latest.json` and the NSIS installer, validate the
   manifest and `.sig` asset, and separately verify the installer's
   Authenticode signature.
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
- The release requires `TAURI_UPDATER_PUBLIC_KEY` as a repository Actions
   variable, `TAURI_SIGNING_PRIVATE_KEY` as a GitHub Actions secret, and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when the key is protected. Missing
   values must fail the workflow; never use placeholders.
- Windows Authenticode credentials must be supplied through the selected
   signing provider's GitHub Actions secrets or identity, never committed or
   printed. The workflow must fail closed when those credentials are absent.
- Never commit generated release configuration, or release credentials.
- Never commit updater private keys, passwords, Authenticode material, or
   release credentials.
