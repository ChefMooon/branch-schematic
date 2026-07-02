# GitHub OAuth Token Handling Security Review

## Scope
Reviewed the current OAuth implementation in [src-tauri/src/auth.rs](src-tauri/src/auth.rs), [src-tauri/src/db.rs](src-tauri/src/db.rs), [src/features/auth-profile/hooks/useOAuthFlow.ts](src/features/auth-profile/hooks/useOAuthFlow.ts), and the environment configuration in [.env](.env).

## Executive Summary
The app uses a generally reasonable pattern for the OAuth exchange itself: the access token is exchanged over HTTPS, the callback listener is bound to localhost, and the token is primarily stored in the OS keyring rather than in the SQLite database. The main risks are around secret handling and token exposure across the app boundary. In particular, a real GitHub client secret is present in the project environment file, and the access token is returned to the frontend layer and then carried through UI state.

## Findings

| ID | Severity | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| F1 | High | A GitHub client secret is stored in the project environment file and loaded by the backend at runtime. | The file [.env](.env) contains `GITHUB_CLIENT_SECRET`, and [src-tauri/src/auth.rs](src-tauri/src/auth.rs) loads it via `std::env::var` and `dotenv::dotenv()`. | Rotate the secret immediately, remove it from source-controlled or local project files, and avoid shipping a confidential client secret in a desktop app. Prefer a backend proxy or a public-client flow without a secret. |
| F2 | High | The OAuth access token is returned across the Tauri IPC boundary into the frontend and then held in React state. | [src-tauri/src/auth.rs](src-tauri/src/auth.rs) returns `token` in `OAuthExchangeResponse`, and [src/features/auth-profile/hooks/useOAuthFlow.ts](src/features/auth-profile/hooks/useOAuthFlow.ts) forwards it into the UI flow and state. | Keep the token in the backend as long as possible. Expose only profile metadata to the UI, and keep token use inside Rust commands or a dedicated secure boundary. |
| F3 | Medium | Token values remain part of the profile payload model and can be surfaced to the UI layer. | [src-tauri/src/auth.rs](src-tauri/src/auth.rs) defines `AuthProfileRow` with `token_value`, and the profile APIs return it to the frontend. | Remove `token_value` from UI-facing response models. Return only token health or presence, not the token itself. |
| F4 | Medium | The database schema still contains an `oauth_token` column, so legacy or accidental values could persist and be exposed. | [src-tauri/src/db.rs](src-tauri/src/db.rs) defines the `auth_profiles.oauth_token` column, and [src-tauri/src/auth.rs](src-tauri/src/auth.rs) may still read `row.get("oauth_token")` as a fallback. | Stop using the DB column for tokens entirely. Migrate or clear old values and ensure the application never writes tokens into SQLite. |
| F5 | Low | Environment handling is broad and could unintentionally leak secrets or make local configuration easier to misread. | [src-tauri/src/auth.rs](src-tauri/src/auth.rs) loads dotenv from the process environment without a strict path, while [.env](.env) contains both public and private OAuth values. | Use a dedicated ignored env file for local development, keep secrets out of the repo, and avoid exposing any secret-valued variables to Vite or the frontend build. |

## What Is Working Well
- The token exchange is performed directly to GitHub over HTTPS.
- The callback listener is constrained to localhost and uses a loopback redirect.
- New flows store the token in the OS keyring rather than putting it in SQLite.

## Recommended Next Steps
1. Rotate and replace the exposed GitHub client secret.
2. Remove token-bearing fields from UI-facing responses and keep token handling inside backend-only commands.
3. Clear any legacy `oauth_token` values from the database and prevent future writes.
4. Move local-only secrets to a gitignored environment file and keep public identifiers such as `VITE_GITHUB_CLIENT_ID` separate from secrets.
