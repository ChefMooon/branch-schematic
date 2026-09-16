# Auto-Update Release Runbook

Branch Schematic publishes only stable `vX.Y.Z` tags as draft Windows x64 NSIS
releases. The release workflow uses the committed `CHANGELOG.md` entry for the
draft release body and uploads the Tauri updater manifest and signature assets.

## Maintainer prerequisites

1. Generate and back up the Tauri updater key pair outside this repository.
2. Add the private key as the GitHub Actions secret
   `TAURI_SIGNING_PRIVATE_KEY`. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when
   the key is password-protected. Never commit or print either value.
3. Add the matching public key as the repository Actions variable
   `TAURI_UPDATER_PUBLIC_KEY`. It is not a private key, but it must be the exact
   public key paired with the signing secret. The workflow fails if it is absent
   rather than using a placeholder.

The committed `src-tauri/tauri.conf.json` contains the stable public updater
feed, while updater artifact generation remains disabled for ordinary builds.
The workflow creates a temporary release configuration after the public key is
supplied. Release builds use the same moving public feed so an installed older
version can discover future releases.

## Release procedure

1. Update the version consistently in `package.json`, `src-tauri/Cargo.toml`,
   and `src-tauri/tauri.conf.json`.
2. Replace the `Unreleased` label with the matching `## [X.Y.Z] - Unreleased`
   changelog entry and complete its notes before creating the tag.
3. Run `npm run test:version`, `npm run test:updater-manifest`, `npm test`,
   `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and
   `git diff --check`.
4. Push the matching `vX.Y.Z` tag. The workflow rejects malformed, prerelease,
   unprefixed, or mismatched tags and creates a draft release only.
5. Run the release configuration validation and inspect the draft assets and
   `latest.json`: the manifest must contain the `windows-x86_64` entry, NSIS
   installer URL, release notes, UTC `pub_date`, and non-empty signature. Do
   not publish until the Windows rehearsal passes.
6. Publish the draft release only after the installer and updater manifest have
   passed inspection. The public `releases/latest/download/latest.json` feed
   does not become usable for installed apps until publication.

## Release scripts

These scripts are intentionally small and fail closed. They do not create or
store signing keys. The release workflow runs the version check, temporary
configuration generation, and release-note extraction automatically. The
validation scripts are useful before pushing a tag and in CI checks.

| Script | What it does | How to run it |
| --- | --- | --- |
| [`check-version-consistency.ps1`](../scripts/check-version-consistency.ps1) | Verifies that the stable `vX.Y.Z` tag matches the versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Rejects prerelease, malformed, and unprefixed tags. | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-version-consistency.ps1 -Tag v0.1.0` |
| [`test-version-consistency.ps1`](../scripts/test-version-consistency.ps1) | Tests the version checker with a matching version, a mismatched package version, a prerelease tag, an unprefixed tag, and a malformed tag. | `npm run test:version` |
| [`prepare-release-config.mjs`](../scripts/prepare-release-config.mjs) | Creates a temporary Tauri config for the tagged build. It enables updater artifacts, selects the NSIS target, injects the maintainer-provided public key, and points the updater at the stable public GitHub release manifest. | `node scripts/prepare-release-config.mjs --tag v0.1.0 --output <temporary-config-path>` |
| [`extract-release-notes.ps1`](../scripts/extract-release-notes.ps1) | Extracts only the matching `## [X.Y.Z]` section from `CHANGELOG.md`, requires bullet-point notes, and writes them to a temporary file for the GitHub Release body. | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-release-notes.ps1 -Tag v0.1.0 -OutputPath <temporary-notes-path>` |
| [`validate-updater-manifest.mjs`](../scripts/validate-updater-manifest.mjs) | Validates `latest.json`: stable version, release notes, UTC publication date, Windows x64 platform entry, HTTPS GitHub asset URL, NSIS installer filename, and non-empty signature. It can also verify that the installer and `.sig` assets exist. | `node scripts/validate-updater-manifest.mjs --manifest <latest.json> --asset-dir <release-assets> --version 0.1.0` |
| [`test-updater-manifest.mjs`](../scripts/test-updater-manifest.mjs) | Runs fixture tests for a valid manifest plus missing signature, missing platform, mismatched version, and malformed publication date cases. | `npm run test:updater-manifest` |

The normal local validation sequence is:

```powershell
npm run test:version
npm run test:updater-manifest
npm run test:release-config
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

The workflow uses temporary files under the GitHub Actions runner's temp
directory for the generated Tauri config and extracted release notes. These
files are not committed.

The initial pipeline does not claim Authenticode signing. Tauri updater
signatures authenticate updater artifacts; Authenticode is a separate optional
Windows publisher-signing concern and remains out of scope.

## Existing installed builds

Builds created before the stable-feed fix may contain a tag-specific updater
endpoint and cannot be repaired by changing the source configuration. For an
existing test installation, either add a compatibility `latest.json` asset to
the legacy release endpoint or reinstall using a build containing the stable
feed. Retain the compatibility asset until those builds are retired.

## Rollout gate

The committed app and release builds now use the stable
`releases/latest/download/latest.json` endpoint. Complete the older-installed-
build rehearsal before announcing the first release built with this fix. A bad
release is rolled forward with a higher fixed version; do not rotate the
updater key as the first response.

### Rollout diagnostics

[`evaluate-rollout.js`](../scripts/evaluate-rollout.js) is a separate
post-release operational tool. It reads a diagnostics JSON file, checks the
stale-state and registration-failure rates against their thresholds, and
returns a rollback recommendation. It exits with status `1` when a threshold
requires rollback and status `2` for invalid input or usage errors.

```powershell
node scripts/evaluate-rollout.js diagnostics.json
```