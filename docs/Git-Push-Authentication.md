# Git authentication and repository profiles

## Which profile is used?

Every tracked repository has one resolved profile. An explicit repository
assignment takes precedence over the active profile. An unassigned repository
inherits the persisted active non-fallback profile. If no user profile exists,
the `local-basic-profile` fallback is recreated and used.

The repository action surface shows the resolved profile, authentication level,
and whether the result is **assigned** or **inherited**. Use **Assign** or
**Replace** there to change the repository without entering profile management.
**Clear assignment** removes the row and restores active-profile inheritance.
The local fallback can be assigned directly, but it is local-only.

If an assignment becomes stale because its profile was deleted or is unavailable,
Git operations are blocked. Replace the assignment or clear it before retrying.
Profile deletion is similarly blocked while any repository is assigned to that
profile; reassign or clear those repositories first.

## Clone and onboarding behavior

An explicitly selected profile is retained as the repository assignment after a
clone. A clone with no explicit profile selection remains unassigned and follows
the active profile. Adding an existing local repository also starts unassigned.
After add or clone, the application refreshes the remote, current branch,
upstream, ahead/behind, and unpushed state before showing the repository action
surface.

## Authentication levels and remotes

| Level | HTTPS remotes | SSH remotes | Provider API |
| --- | --- | --- | --- |
| Basic | Local-only; remote Git operations are rejected | Local-only; rejected | Not available |
| Local system | Uses the operating system's Git credential and SSH configuration | Uses the operating system's Git credential and SSH configuration | Not available |
| Full OAuth | Uses the keyring token for HTTPS Git transport | Requires a working SSH key/agent or other SSH setup; OAuth never supplies a token or SSH-agent credential | Available when the OAuth token has the required provider scopes |

OAuth is therefore an HTTPS Git transport capability, not an SSH credential
provider. Configure and test an SSH key with the operating system when using an
SSH remote. A missing, unreadable, expired, or unauthorized OAuth token must be
reconnected or repaired rather than copied into the application.

## Troubleshooting and diagnostics

Git errors remain categorized so the repair path is clear: authentication,
transport, remote update rejection, missing origin, missing upstream,
missing OAuth token, and SSH setup failures are distinct. Normal errors and
logs never include tokens, passwords, authorization headers, or credential-
bearing URLs.

The developer-only repository diagnostics command can report repository and
resolved-profile IDs, profile name, authentication level, resolution source,
token presence as a boolean, remote scheme/host, credential strategy, and the
Git error code. It never reports token values, token lengths, passwords, or
authorization headers. Do not expose this command through normal user-facing
settings.

## Alpha database reset

The old `profile_repo_scopes` relationship is not migrated. Its many-to-many
rows can represent ambiguous identity, so no profile is chosen automatically.
For this alpha release, delete the configured SQLite database and its `-wal` and
`-shm` companions, launch the application to recreate the blank database and
apply migrations, then re-import repositories. Recreate assignments explicitly
after the import. This reset is mandatory; do not rely on legacy assignment rows.
