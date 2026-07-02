import type { UserProfile } from '../types';

function isValidAvatarUrl(value?: string | null): boolean {
  if (!value?.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getProfileAvatarUrl(profile: Pick<UserProfile, 'avatar_url' | 'username' | 'auth_level'> | null | undefined): string | null {
  if (!profile) {
    return null;
  }

  if (isValidAvatarUrl(profile.avatar_url)) {
    return profile.avatar_url ?? null;
  }

  if (profile.auth_level === 'full_oauth') {
    const username = profile.username?.trim();
    if (username) {
      return `https://github.com/${encodeURIComponent(username)}.png`;
    }
  }

  return null;
}
