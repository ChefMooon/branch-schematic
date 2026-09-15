# GitHub OAuth Token Handling Security Review

## Scope
Reviewed the current OAuth implementation in [src-tauri/src/auth.rs](../src-tauri/src/auth.rs), [src-tauri/src/db.rs](../src-tauri/src/db.rs), [src/features/auth-profile/hooks/useOAuthFlow.ts](../src/features/auth-profile/hooks/useOAuthFlow.ts), and the environment configuration in [.env](../.env).

## Executive Summary
The app uses a generally reasonable pattern for the OAuth exchange itself: the access token is exchanged over HTTPS, the callback listener is bound to localhost, and the token is stored in the OS keyring rather than in SQLite. The frontend receives profile metadata and token health only; repository API calls resolve the profile ID in Rust and use the keyring credential inside backend commands. The remaining material risk is local environment secret handling.

## Findings

| ID | Severity | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| F1 | High | A GitHub client secret is stored in the project environment file and loaded by the backend at runtime. | The file [.env](../.env) contains `GITHUB_CLIENT_SECRET`, and [src-tauri/src/auth.rs](../src-tauri/src/auth.rs) loads it via `std::env::var` and `dotenv::dotenv()`. | Rotate the secret immediately, remove it from source-controlled or local project files, and avoid shipping a confidential client secret in a desktop app. Prefer a backend proxy or a public-client flow without a secret. |
| F2 | Resolved | The OAuth access token was returned across the Tauri IPC boundary into the frontend. | `OAuthExchangeResponse` now contains profile metadata only; `useOAuthFlow` and profile state never receive a token. | Keep the token in Rust and expose only profile metadata and token health. |
| F3 | Resolved | Token values were part of the profile payload model and could be surfaced to the UI layer. | UI-facing `AuthProfileRow` and `AuthProfileInput` have no token field. Backend-only `RemoteAuthProfile` is used for GitHub operations. | Preserve the backend/public type split and do not add token fields to serializable frontend DTOs. |
| F4 | Resolved with alpha reset | The database schema contained an `oauth_token` column. | The current `auth_profiles` CREATE TABLE and seed INSERT in [src-tauri/src/db.rs](../src-tauri/src/db.rs) no longer contain the column, and the assignment schema is version 7. Existing databases are intentionally unsupported for this alpha-breaking change. | Delete the database plus `-wal`/`-shm`, launch once to regenerate the schema, then re-import repositories. |
| F5 | Low | Environment handling is broad and could unintentionally leak secrets or make local configuration easier to misread. | [src-tauri/src/auth.rs](../src-tauri/src/auth.rs) loads dotenv from the process environment without a strict path, while [.env](../.env) contains both public and private OAuth values. | Use a dedicated ignored env file for local development, keep secrets out of the repo, and avoid exposing any secret-valued variables to Vite or the frontend build. |

## What Is Working Well
- The token exchange is performed directly to GitHub over HTTPS.
- The callback listener is constrained to localhost and uses a loopback redirect.
- New flows store the token in the OS keyring rather than putting it in SQLite.
- Basic remote repository loading passes only a profile ID through IPC; Rust resolves the keyring token and makes the GitHub request.
- OAuth persistence compensates a failed profile update by restoring the prior keyring credential or deleting the newly written credential.

## Git transport and repository assignment policy

Full OAuth tokens are used for HTTPS Git transport only. An SSH remote must use
the user's configured SSH key/agent; OAuth never falls back to token or
SSH-agent authentication. Basic profiles are local-only, while Local system
profiles use the operating system's Git credential and SSH configuration.

Repository assignments are explicit and authoritative. Unassigned repositories
inherit the active non-fallback profile, or the local fallback when no user
profile exists. A stale assignment blocks Git operations until it is replaced or
cleared, and profile deletion is blocked while assignments remain. The
repository action surface exposes the resolved profile, auth level, and
assigned-versus-inherited source without exposing credentials.

Developer-only diagnostics may report token presence as a boolean and redacted
remote metadata, but never token values or lengths, passwords, authorization
headers, or credential-bearing URLs. Normal errors expose only stable,
categorized authentication, transport, SSH, or remote-update information.

## Recommended Next Steps
1. Rotate and replace the exposed GitHub client secret.
2. Keep the resolved F2-F4 boundary covered by frontend contract tests and backend integration tests.
3. Delete the current alpha database, launch to regenerate it, verify `auth_profiles` has no `oauth_token`, and re-import repositories.
4. Move local-only secrets to a gitignored environment file and keep public identifiers such as `VITE_GITHUB_CLIENT_ID` separate from secrets.
5. For the alpha assignment-schema change, delete the SQLite database plus its `-wal`/`-shm` files, launch once to recreate and migrate a blank database, and re-import repositories. Legacy ambiguous `profile_repo_scopes` rows are not migrated.
