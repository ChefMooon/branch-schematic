# Reusable Tauri 2 updater setup

This guide extracts the updater setup used by CM Modpack Util so it can be
adapted to another Tauri 2 desktop application.

The implementation uses:

- Tauri's official updater plugin.
- A Tauri updater signing key pair.
- GitHub Releases as a static update feed.
- GitHub Actions and `tauri-apps/tauri-action@v1` to build and publish assets.
- A Svelte/TypeScript frontend that checks for metadata first and requires
  explicit user consent before downloading and installing an update.

The examples below use Windows x64 and the NSIS installer, but the same
contract can support Linux and macOS by adding their platform artifacts and
manifest entries.

## Architecture

The updater has four cooperating parts:

| Layer | Responsibility | Example in this repository |
| --- | --- | --- |
| Tauri configuration | Embeds the public key, declares the feed URL, and enables updater artifacts. | [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) |
| Rust/Tauri runtime | Registers the updater and process plugins and grants capability permissions. | [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs), [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) |
| Frontend | Checks metadata, displays release details, downloads with progress, installs, and controls relaunch behavior. | [`src/lib/updates.svelte.ts`](../src/lib/updates.svelte.ts), [`src/lib/updates.ts`](../src/lib/updates.ts) |
| Release pipeline | Builds the application, signs updater artifacts, creates a GitHub Release, and uploads `latest.json` and signatures. | [`.github/workflows/release.yml`](../.github/workflows/release.yml) |

There is no custom update server in this setup. GitHub Releases hosts the
static `latest.json` manifest and the installer assets. The Tauri runtime
performs the network request and signature verification; the frontend does not
call the GitHub API or download installer URLs directly.

### Trust model

Tauri updater signing and Windows Authenticode signing are different things:

- The Tauri updater private key signs the updater artifact. The matching public
  key is embedded in the application and lets installed applications reject
  tampered or incorrectly signed updates.
- Authenticode signing identifies the Windows publisher and can improve
  SmartScreen reputation. It is optional and was not part of this project's
  first updater release.
- A valid Tauri signature does not remove Windows SmartScreen or
  unknown-publisher warnings when the installer has no Authenticode signature.

## Prerequisites

Before implementing the updater, confirm that the other application has:

- A Tauri 2 project with a working desktop build.
- A stable application version available to both the Tauri config and release
  tooling.
- A GitHub repository where the workflow can create releases and upload assets.
- A release policy: supported platforms, stable versus prerelease channels,
  installer format, and whether installation should restart immediately.
- A secure place outside the repository to store and back up the updater
  private key.

Keep the version synchronized across every file that participates in a build.
In this project, `src-tauri/tauri.conf.json` is the authoritative source and
must match `package.json`, `src-tauri/Cargo.toml`, the pushed tag, and any
visible application version.

## 1. Install the dependencies

Use the package manager and Tauri CLI already used by the application. These
are the relevant dependencies from CM Modpack Util:

```powershell
npm run tauri add updater
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
cargo add tauri-plugin-updater@2 tauri-plugin-process@2 --manifest-path src-tauri/Cargo.toml
```

The process plugin is only needed if the frontend will call `relaunch()` as a
separate action. It can be omitted when the updater's install operation always
restarts the application itself.

For a manually maintained setup, the resulting manifests contain equivalents
of:

```json
"@tauri-apps/plugin-updater": "^2",
"@tauri-apps/plugin-process": "^2"
```

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

Commit the lockfiles after dependency installation. CI should use the lockfile
with `npm ci`, not resolve a different dependency graph with `npm install`.

## 2. Generate and protect the updater key

Generate the key pair manually with the Tauri CLI. Do this on a maintainer
machine, not in application code or GitHub Actions:

```powershell
npm run tauri signer generate -- -w "$HOME\.tauri\myapp.key"
```

The command prompts for a password. A password is strongly recommended. The
CLI writes the private key to the chosen path and reports the public key.

Key rules:

1. Keep the private key file outside the repository.
2. Back it up in a password manager or encrypted offline storage.
3. Never commit, paste into source code, print, or log the private key or its
   password.
4. Copy only the public key into `tauri.conf.json`.
5. Do not generate or rotate the key in CI.
6. If the private key is lost, already-installed applications cannot trust new
   artifacts signed with a replacement key. Key rotation requires a staged
   update trusted by the old key.

Tauri's documentation notes that `.env` files are not a substitute for the
signing environment during a build. The private key must be supplied through
an actual environment variable or the CI secret mechanism.

## 3. Configure Tauri

Add the updater artifact flag and updater configuration to
`src-tauri/tauri.conf.json`:

```json
{
  "version": "0.1.0",
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<PUBLIC_KEY_FROM_TAURI_SIGNER>",
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Important details:

- `pubkey` is the public key content, not a file path.
- `endpoints` is an array. Production endpoints should use HTTPS.
- `createUpdaterArtifacts: true` makes Tauri generate signed updater bundles.
- `targets: ["nsis"]` makes the Windows artifact choice unambiguous. If both
  NSIS and MSI are built, configure the release action to prefer NSIS or choose
  the installer format deliberately.
- Use a tag-specific endpoint during the first rehearsal if the stable
  `releases/latest` feed is not ready. Do not validate `releases/latest` with a
  draft or prerelease release.

For a GitHub static manifest, Tauri expects the required platform entry to
contain the installer URL and the complete signature text:

```json
{
  "version": "0.1.0",
  "notes": "Release notes",
  "pub_date": "2026-09-15T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.1.0/MyApp_0.1.0_x64-setup.exe",
      "signature": "<contents of the .sig file>"
    }
  }
}
```

The `latest.json` file is release metadata. Tauri verifies the downloaded
updater artifact against the embedded public key; `latest.json` is not a
separately signed document.

## 4. Register the Rust plugins and permissions

Register the plugins in the Tauri builder:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

The process plugin is needed for an explicit `relaunch()` action. The updater
plugin owns endpoint access, manifest parsing, artifact download, signature
verification, and installation. A custom Rust command is not required for the
basic flow.

Grant the frontend the plugin capabilities in
`src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "updater:default",
    "process:allow-restart"
  ]
}
```

`updater:default` includes the normal check, download, install, and combined
download-and-install permissions. Keep the capability scoped to the intended
window. Do not grant broader shell or filesystem permissions to implement an
updater.

## 5. Implement the frontend boundary

The frontend imports the official JavaScript APIs:

```ts
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
```

A minimal explicit flow is:

```ts
const update = await check();

if (update) {
  let downloaded = 0;

  await update.download((event: DownloadEvent) => {
    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      // Update the visible progress state.
    }
  });

  // Require a separate user action before this call.
  await update.install({ restartAfterInstall: true });
}
```

For a separate restart decision, install without an automatic restart and call
`relaunch()` only after the user selects **Restart now**:

```ts
await update.install({ restartAfterInstall: false });
// Later, after explicit confirmation:
await relaunch();
```

Choose one restart policy and make the UI, state machine, and tests agree. The
current CM Modpack Util source contains both the explicit `relaunch()` helper
and an `installAndRestart()` path that passes `restartAfterInstall: true`; this
is an adaptation point for another application, not a requirement to support
both behaviors.

### Recommended user-facing state model

A useful coordinator keeps update state separate from the native plugin API:

```text
idle
  -> checking
  -> up_to_date
  -> available
  -> download_confirm
  -> downloading
  -> install_confirm
  -> installing
  -> ready_to_restart
  -> restarting
```

Also model `later`, `offline`, and `failed` states. Each state should have a
meaning, visible next action, and recovery path.

Recommended behavior:

- Startup checks request metadata only. They do not download installer bytes.
- A newer version produces a non-blocking notification.
- The user can review version, date, notes, and a release-page link.
- Download and install require explicit confirmation.
- Download progress is visible and does not block unrelated application work.
- A successful install either offers a separate restart choice or clearly
  reports that the updater will restart immediately.
- Duplicate checks, downloads, installs, and relaunches are ignored or rejected
  while the same operation is active.
- Offline, malformed, unsigned, interrupted, and install-failure states remain
  visible and retryable without making the core application unusable.
- Static browser preview mode must not claim that an update check succeeded when
  the Tauri runtime is unavailable.
- Persist the last-notified or last-deferred version if repeated startup
  notifications would be disruptive.

CM Modpack Util uses a typed coordinator and shared toast system rather than
putting updater calls throughout route components. The settings/About surface
shows current version, available version, last check time, release notes, and
manual check actions. The global layout starts a non-blocking startup check:

```ts
onMount(() => {
  void checkForUpdates(true);
});
```

The focused tests cover legal state transitions, duplicate-operation guards,
notification suppression, and the important metadata-versus-artifact boundary:
[`src/lib/updates.test.ts`](../src/lib/updates.test.ts).

## 6. Add the GitHub Actions release workflow

A minimal Windows-only workflow based on this project is:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    runs-on: windows-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Set up Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install frontend dependencies
        run: npm ci

      - name: Verify release version consistency
        shell: pwsh
        env:
          RELEASE_TAG: ${{ github.ref_name }}
        run: |
          $configVersion = (Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json).version
          $packageVersion = (Get-Content package.json | ConvertFrom-Json).version
          $cargoVersion = (Select-String -Path src-tauri/Cargo.toml -Pattern '^version\s*=\s*"([^"]+)"$').Matches.Groups[1].Value
          $tagVersion = $env:RELEASE_TAG -replace '^v', ''
          $versions = @($configVersion, $packageVersion, $cargoVersion, $tagVersion)
          if (($versions | Select-Object -Unique).Count -ne 1) {
            throw "Version mismatch: tauri=$configVersion package=$packageVersion cargo=$cargoVersion tag=$tagVersion"
          }

      - name: Build and publish draft release
        uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: My App ${{ github.ref_name }}
          releaseBody: See RELEASE_NOTES.md or use generated release notes.
          releaseDraft: true
          prerelease: false
          uploadUpdaterJson: true
          uploadUpdaterSignatures: true
          updaterJsonPreferNsis: true
          args: "--bundles nsis"
```

Adapt these values:

- Change the tag pattern and release naming convention.
- Use the application's Node version and package manager.
- Keep `beforeBuildCommand` in `tauri.conf.json` aligned with the frontend
  build command. `tauri-action` runs the Tauri build, which then runs that
  configured frontend build command.
- Use `projectPath` if the Tauri project is not at the repository root.
- Use a platform matrix only after each platform's artifact, signing, and
  manifest entry has been tested.
- Keep `permissions: contents: write` at workflow or job scope so the automatic
  `GITHUB_TOKEN` can create a release and upload assets.
- Keep `releaseDraft: true` for initial pipeline validation. Publish manually
  after inspecting the assets.

The workflow in this repository is the complete working reference:
[`.github/workflows/release.yml`](../.github/workflows/release.yml).

## GitHub secrets and permissions

Add repository Actions secrets at **Settings > Secrets and variables > Actions >
New repository secret**.

| Name | Required | Value and purpose |
| --- | --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Yes | Complete contents of the private key file generated by `tauri signer generate`. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | If the key has a password | The password entered when the key was generated. It may be empty only when the key was intentionally created without a password. |
| `GITHUB_TOKEN` | Automatic | GitHub creates this token for each workflow run. Do not create or store a replacement for the normal release workflow. The workflow needs `contents: write`. |

Do not place the private key in repository variables, `.env` files, build
artifacts, release notes, or frontend code. Do not echo the signing environment
in a workflow step. GitHub masks secret values, but logs should not be given
secret material to print in the first place.

If the application later adds Microsoft Authenticode signing, that is a
separate certificate and secret-custody project. It is not required to make
Tauri updater signature verification work, and its secret names depend on the
chosen certificate and signing action.

## 7. Release and validation procedure

Use this order for the first release:

1. Synchronize the version in the Tauri config, package manifest, Rust manifest,
   visible version UI, and release tag.
2. Write the release notes before building. The updater manifest captures the
   release notes at build time; editing a GitHub draft afterward does not
   necessarily change the already-uploaded `latest.json`.
3. Confirm both Tauri signing secrets exist as repository Actions secrets.
4. Push a matching `v<semver>` tag.
5. Let the workflow create a draft release.
6. Inspect the draft assets. For Windows NSIS, expect the setup executable, its
   `.sig` file, and `latest.json`.
7. Open `latest.json` and verify the version, `windows-x86_64` entry, installer
   URL, and non-empty signature.
8. Publish a clearly labeled temporary test release if the stable feed has not
   been validated yet. A draft release is not suitable for validating the
   public `releases/latest` URL.
9. Install an older build on a clean Windows machine and rehearse the complete
   flow: metadata check, no download before consent, artifact download,
   signature verification, installation, and the chosen restart behavior.
10. Test the failure paths: offline feed, malformed manifest, missing asset,
    wrong signature, interrupted download, failed install, and relaunch failure.
11. Only after the rehearsal passes, switch the application to the stable
    endpoint:

    ```text
    https://github.com/<owner>/<repo>/releases/latest/download/latest.json
    ```

12. Publish the stable release as the newest non-prerelease release so
    `releases/latest` resolves to the intended version.

Run repository checks before pushing the tag. For this project:

```powershell
npm test
npm run check
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

## Troubleshooting

### The workflow cannot create or upload the release

Check that the workflow or job has `contents: write` and that repository
Actions settings do not override the token with read-only permissions.

### `latest.json` returns 404

The stable endpoint requires a published non-prerelease release with the
expected assets. A draft or prerelease may be reachable through its tag-specific
URL but will not satisfy `releases/latest`.

### The application rejects an update signature

Confirm that the public key in the built application matches the private key in
`TAURI_SIGNING_PRIVATE_KEY`, and that the `.sig` file belongs to the exact
installer URL and build being published. Never solve this by disabling updater
signatures.

### The manifest points to the wrong Windows installer

When both MSI and NSIS are generated, choose one format consistently. Use
`updaterJsonPreferNsis: true` and `--bundles nsis` when NSIS is the intended
updater artifact.

### The version check reports an unexpected result

Check all version sources and the tag. Tauri compares SemVer; a tag prefix such
as `v` is accepted in the static manifest, but your workflow should normalize it
when comparing the tag with package and Cargo versions.

### Windows still shows a SmartScreen warning

That is expected when the installer has no Microsoft Authenticode signature.
Tauri updater signatures authenticate the update artifact to installed
applications but do not establish Windows publisher reputation.

### A key must be replaced

Do not simply generate a new key and publish with it. Existing installations
trust the old embedded public key. Plan a staged migration in which an update
trusted by the old key delivers an application containing the new public key,
then publish artifacts with the new private key.

## Adaptation checklist

Before copying this setup into another Tauri application, confirm:

- [ ] The updater and process dependencies are installed at compatible Tauri 2 versions.
- [ ] The updater key was generated manually, backed up, and never committed.
- [ ] The public key and HTTPS endpoint are configured in `tauri.conf.json`.
- [ ] `createUpdaterArtifacts` is enabled and the intended bundle is explicit.
- [ ] Rust plugin registration and capability permissions are present.
- [ ] The frontend checks metadata separately from artifact download.
- [ ] Download, install, restart, retry, offline, and signature-failure states are visible.
- [ ] Duplicate operations are guarded.
- [ ] Versions are checked against the release tag in CI.
- [ ] `GITHUB_TOKEN` has only the release permission required by the workflow.
- [ ] The two Tauri signing secrets are configured in GitHub Actions.
- [ ] The first release is inspected as a draft and rehearsed through a published tag-specific endpoint.
- [ ] The stable `releases/latest` endpoint is enabled only after the rehearsal passes.
- [ ] Authenticode expectations are documented separately from updater signing.

## References

- [Tauri updater plugin documentation](https://v2.tauri.app/plugin/updater/)
- [Tauri GitHub Actions pipeline](https://v2.tauri.app/distribute/pipelines/github/)
- [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action)
- [Tauri updater JavaScript API](https://v2.tauri.app/reference/javascript/updater/)
- [CM Modpack Util release procedure](desktop-updates.md)
- [CM Modpack Util updater implementation plan](plans/desktop-updates-plan.md)
