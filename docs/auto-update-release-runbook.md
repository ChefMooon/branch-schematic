# Auto-Update Release Runbook

Branch Schematic publishes stable Windows x64 NSIS releases from a Windows
maintainer machine. The local release runner creates a GitHub draft first,
builds signed Tauri updater artifacts locally, uploads validated assets, and
leaves publication as a manual operator action.

## Prerequisites

- Windows PowerShell, Node/npm, Rust/Cargo, and the project dependencies.
- GitHub CLI installed and authenticated with permission to create and upload
  releases: `gh auth status`.
- A pushed stable tag matching the synchronized application version.
- `TAURI_UPDATER_PUBLIC_KEY` and `TAURI_SIGNING_PRIVATE_KEY` in the current
  PowerShell environment. Set
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when the key is protected.

Never commit or print signing credentials. Authenticode signing is not part of
this process and must not be implied by a successful release.

## Release

1. Update the version in `package.json`, `package-lock.json`,
   `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and
   `src-tauri/tauri.conf.json`.
2. Add the matching `## [X.Y.Z]` changelog entry with bullet notes.
3. Run the focused checks:

   ```powershell
   npm run test:version
   npm run test:updater-manifest
   npm run test:release-config
   npm run test:release-local
   ```

4. Commit and push the version change and tag:

   ```powershell
   git push origin main
   git push origin vX.Y.Z
   ```

5. Create and upload the draft release locally:

   ```powershell
   npm run release:local -- --tag vX.Y.Z
   ```

The runner creates the draft before building. A build failure therefore leaves
an inspectable draft and a run report rather than silently losing the release
context.

## Reports and Recovery

Each run writes an ignored directory under `.release-status/` containing:

- `status.json` for machine-readable step results and artifact paths.
- `status.md` for a human-readable summary.

Reports contain timestamps, exit codes, sanitized errors, and recovery hints.
They never contain private keys, passwords, or full environment dumps.

If a run fails, inspect the failed step and draft in GitHub. A draft can be
resumed explicitly after confirming its ownership:

```powershell
npm run release:local -- --tag vX.Y.Z --resume --release-id <release-id>
```

The runner does not publish releases. Manually inspect `latest.json`, the NSIS
installer, and the matching `.sig` asset, then publish the draft in GitHub.

## Helper Scripts

| Script | Purpose |
| --- | --- |
| `scripts/release-local.mjs` | Creates the draft, builds locally, validates, uploads, and records status. |
| `scripts/check-version-consistency.ps1` | Validates the tag against application and lockfile versions. |
| `scripts/prepare-release-config.mjs` | Creates a temporary signed-updater Tauri configuration. |
| `scripts/extract-release-notes.ps1` | Extracts the matching changelog section. |
| `scripts/validate-updater-manifest.mjs` | Validates the generated manifest and local assets. |

## Signing Boundary

Tauri updater signatures authenticate updater artifacts. Windows Authenticode
signing identifies the Windows publisher and is a separate deferred concern.
Do not claim Authenticode signing without a configured provider and an
independent signature check.
