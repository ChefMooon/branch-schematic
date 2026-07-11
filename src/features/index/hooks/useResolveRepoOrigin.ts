import { useMemo } from 'react';
import { useProfileStore } from '../../auth-profile/stores/profileStore';
import type { TrackedPath } from '../../../types/git';

export type RepoOriginType = NonNullable<TrackedPath['repo_origin_type']>;

export function resolveRepoOrigin(repo: TrackedPath, githubUsername: string | null | undefined): RepoOriginType {
  const fallbackOrigin = repo.repo_origin_type ?? 'LOCAL_ONLY';
  const ownerLogin = repo.github_owner_login?.trim();
  const profileLogin = githubUsername?.trim();

  if (!ownerLogin || !profileLogin) {
    return fallbackOrigin;
  }

  if (ownerLogin.toLowerCase() === profileLogin.toLowerCase()) {
    return 'OWNED';
  }

  return fallbackOrigin;
}

export function useResolveRepoOrigin(repo: TrackedPath): RepoOriginType {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const githubUsername = useProfileStore((state) => {
    const activeProfile = state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
    return activeProfile?.username?.trim() ?? null;
  });

  return useMemo(() => resolveRepoOrigin(repo, githubUsername), [repo.github_owner_login, repo.repo_origin_type, githubUsername, activeProfileId]);
}

type RepoOriginBadgeState = {
  isInactiveByProfile: boolean;
  title: string | null;
};

export function useRepoOriginBadgeState(repo: TrackedPath, originType: RepoOriginType): RepoOriginBadgeState {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const activeProfile = useProfileStore((state) => {
    return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
  });

  const githubUsername = activeProfile?.username?.trim() ?? null;
  const activeProfileName = activeProfile?.display_name?.trim() ?? 'Unknown profile';

  return useMemo(() => {
    const ownerLogin = repo.github_owner_login?.trim();
    const profileLogin = githubUsername?.trim();
    const canBeProfileRelated = originType === 'OWNED' || originType === 'FORK' || originType === 'CONTRIBUTOR';

    if (!canBeProfileRelated) {
      return {
        isInactiveByProfile: false,
        title: null,
      };
    }

    if (!ownerLogin) {
      if (originType === 'CONTRIBUTOR' && profileLogin) {
        return {
          isInactiveByProfile: false,
          title: `Active profile is ${activeProfileName} (${profileLogin}). Contributor relationship is profile-derived for this repository.`,
        };
      }

      return {
        isInactiveByProfile: true,
        title: `Owner metadata is unavailable. Active profile is ${activeProfileName}${profileLogin ? ` (${profileLogin})` : ''}.`,
      };
    }

    if (originType === 'CONTRIBUTOR') {
      if (!profileLogin) {
        return {
          isInactiveByProfile: true,
          title: `Repository owner is ${ownerLogin}. Active profile ${activeProfileName} has no GitHub username configured.`,
        };
      }

      return {
        isInactiveByProfile: false,
        title: `Repository owner is ${ownerLogin}. Active profile ${activeProfileName} (${profileLogin}) is related as contributor.`,
      };
    }

    const isMatch = Boolean(
      profileLogin && ownerLogin.toLowerCase() === profileLogin.toLowerCase()
    );

    if (isMatch) {
      return {
        isInactiveByProfile: false,
        title: `Repository owner is ${ownerLogin}. Active profile is ${activeProfileName} (${profileLogin}).`,
      };
    }

    if (!profileLogin) {
      return {
        isInactiveByProfile: true,
        title: `Repository owner is ${ownerLogin}. Active profile ${activeProfileName} has no GitHub username configured.`,
      };
    }

    return {
      isInactiveByProfile: true,
      title: `Repository owner is ${ownerLogin}. Active profile ${activeProfileName} is signed in as ${profileLogin}.`,
    };
  }, [repo.github_owner_login, githubUsername, activeProfileId, activeProfileName, originType]);
}