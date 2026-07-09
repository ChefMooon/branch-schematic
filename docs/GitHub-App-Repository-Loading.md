# GitHub App Repository Loading Flow

This document describes how repository loading works for Clone Remote Repository after the GitHub App user-to-server integration updates.

## Summary

The app now uses a GitHub App-first repository loading strategy for the Basic Clone tab:

1. Load installations for the authenticated user token.
2. Auto-pick the first valid installation.
3. Load repositories for that installation.
4. Optionally supplement with authenticated public collaborator repositories.
5. Merge and deduplicate results before rendering.

Enterprise Clone and URL Clone keep their existing behavior.

## Where the Logic Lives

- Basic GitHub App repository orchestration:
  - src/features/github-auth/hooks/useGithubRepositories.ts
- GitHub App installation request:
  - src/features/github-auth/api/fetchInstallations.ts
- Installation repositories request:
  - src/features/github-auth/api/fetchRepositories.ts
- Public collaborator supplement request:
  - src/features/github-auth/api/fetchPublicCollaboratorRepositories.ts
- Basic/Enterprise/URL modal UI:
  - src/features/repository/components/CloneRemoteRepositoryModal.tsx

## Basic Clone Data Flow

### 1) Token and Profile Context

The modal reads the active profile from useProfileContext() and passes token plus API base URL into useGithubRepositories for the Basic tab.

Expected profile conditions:

- auth_level = full_oauth
- token health is healthy
- token value is non-empty

If these are not true, cloning is gated with a descriptive UI message.

### 2) Installations Request

fetchGithubInstallations calls:

- GET /user/installations

Headers used:

- Authorization: Bearer <TOKEN>
- Accept: application/vnd.github.v3+json
- X-GitHub-Api-Version: 2022-11-28

### 3) First Installation Auto-Pick

The hook selects the first valid installation id from the response and uses that for repository fetches.

Installation/org switching is intentionally deferred to a later feature.

### 4) Installation Repositories Request

fetchGithubInstallationRepositories calls:

- GET /user/installations/{installation_id}/repositories?page=<n>&per_page=<n>

This is the primary source for repositories (public and private) granted to the app installation.

### 5) Public Collaborator Supplement (Best-Effort)

To improve coverage for public repos where the user is a collaborator, the hook also attempts:

- GET /user/repos?per_page=100&visibility=public&affiliation=collaborator,organization_member

If this call fails, the hook ignores the failure and still returns installation repositories.

### 6) Merge and Deduplicate

Repositories from both sources are merged and deduplicated by repository id before rendering.

## Sorting and Display

In the modal:

- Search filtering runs against name/full name/owner/description.
- Result lists are sorted alphabetically by repository name.
- Grouped display is still by owner login.

## Error Handling

The app keeps descriptive user-facing messages for common failures:

- missing OAuth token or not full OAuth profile
- missing repo scope for private repositories
- unavailable active profile
- transport/network failures
- GitHub status-driven errors

The temporary deep debug logging added during investigation has been removed.

## Notes on Auth Model

Current implementation remains token-based from the existing profile/auth flow and uses GitHub App user-to-server endpoints for installation discovery and repository listing.

If future work introduces installation switching or explicit installation selection, it should be implemented inside src/features/github-auth/ and surfaced through the existing hook interface.

## Tests

Relevant tests:

- src/features/github-auth/api/fetchInstallations.test.ts
- src/features/github-auth/api/fetchRepositories.test.ts
- src/features/github-auth/api/fetchPublicCollaboratorRepositories.test.ts
- src/features/github-auth/hooks/useGithubRepositories.test.tsx
- src/features/repository/components/CloneRemoteRepositoryModal.test.tsx
