---
name: publish-release
description: 'Prepare a Branch Schematic Windows release locally, create a draft GitHub release with the GitHub CLI, build and sign Tauri updater artifacts, upload validated assets, and rehearse the Windows updater flow.'
---

# Branch Schematic Release Workflow

Use this skill for every Windows release, updater rehearsal, or version bump.
Production releases are created from a Windows maintainer machine with the
GitHub CLI. There is no tag-triggered GitHub Actions build.

## Release Procedure

1. Add or update the `## [X.Y.Z]` entry in `CHANGELOG.md` before changing the
   version. It must contain at least one bullet point.
2. Synchronize the stable version in `package.json`, `package-lock.json`,
   `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and
   `src-tauri/tauri.conf.json`.
3. Commit and push the version change, then push the matching stable tag
   `vX.Y.Z`.
4. Confirm `gh auth status` succeeds and set these local PowerShell variables:
   `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when applicable.
5. Run `npm run release:local -- --tag vX.Y.Z`. The runner validates the
   version and notes, creates a GitHub draft first, generates a temporary
   release config, builds NSIS updater artifacts locally, validates `latest.json`
   and its matching `.sig`, uploads the assets, and verifies the draft.
6. Inspect the draft and the ignored report under `.release-status/<run>/`.
   Each run contains `status.json` and `status.md`.
7. Publish the draft manually only after the installer and updater manifest pass
   inspection.

The runner never publishes automatically. If a build or upload fails, the draft
is intentionally left available for diagnosis. Resuming an existing draft
requires explicit ownership confirmation and a release id:

```powershell
npm run release:local -- --tag vX.Y.Z --resume --release-id <release-id>
```

## Validation

The runner reuses these focused helpers:

- `scripts/check-version-consistency.ps1` validates all application and
  lockfile versions against the stable tag.
- `scripts/prepare-release-config.mjs` injects the public key and enables NSIS
  updater artifacts while preserving the stable `releases/latest` endpoint.
- `scripts/extract-release-notes.ps1` extracts the matching changelog entry.
- `scripts/validate-updater-manifest.mjs` validates the Windows x64 manifest,
  installer URL, version, notes, signature, and local assets.

Run the repository checks before a real release:

```powershell
npm run test:version
npm run test:updater-manifest
npm run test:release-config
npm run test:release-local
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

## Signing and Security

Tauri updater signing is required. Never print, commit, or write the updater
private key, password, or credential environment values to a report.

Windows Authenticode signing is currently deferred. A successful local release
must not be described as publisher-signed unless a separate signing provider
has been configured and independently verified.

Generated release configuration, changelog notes, installers, signatures, and
the status directory are local artifacts and must not be committed.
