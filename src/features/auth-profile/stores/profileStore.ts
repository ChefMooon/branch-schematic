import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TokenHealthStatus, UserProfile } from '../types';

function buildProfileId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `profile-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeProfile(profile: Partial<UserProfile> & { id?: string }): UserProfile {
  const scopeValue = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [];
  };

  const authLevel = profile.auth_level === 'local_system' || profile.auth_level === 'full_oauth' ? profile.auth_level : 'basic';
  const isFavorite = profile.is_favorite === true || profile.is_favorite === 1 ? 1 : 0;

  return {
    id: profile.id ?? buildProfileId(),
    display_name: profile.display_name?.trim() || 'New profile',
    auth_level: authLevel,
    username: profile.username ?? null,
    email: profile.email ?? null,
    avatar_url: profile.avatar_url ?? null,
    api_base_url: profile.api_base_url ?? null,
    repository_scope: scopeValue(profile.repository_scope),
    folder_scope: scopeValue(profile.folder_scope),
    commit_name: profile.commit_name ?? null,
    commit_email: profile.commit_email ?? null,
    token_value: profile.token_value ?? null,
    token_expires_at: profile.token_expires_at ?? null,
    last_token_check_at: profile.last_token_check_at ?? null,
    is_active: profile.is_active ?? 0,
    is_favorite: isFavorite,
    created_at: profile.created_at ?? new Date().toISOString(),
    updated_at: profile.updated_at ?? new Date().toISOString(),
  };
}

function toBackendProfile(profile: Partial<UserProfile>) {
  return {
    id: profile.id ?? undefined,
    display_name: profile.display_name ?? undefined,
    auth_level: profile.auth_level ?? 'basic',
    username: profile.username ?? undefined,
    email: profile.email ?? undefined,
    avatar_url: profile.avatar_url ?? undefined,
    api_base_url: profile.api_base_url ?? undefined,
    repository_scope: profile.repository_scope ?? [],
    folder_scope: profile.folder_scope ?? [],
    commit_name: profile.commit_name ?? undefined,
    commit_email: profile.commit_email ?? undefined,
    token_value: profile.token_value ?? undefined,
    token_expires_at: profile.token_expires_at ?? undefined,
    last_token_check_at: profile.last_token_check_at ?? undefined,
    is_active: typeof profile.is_active === 'boolean' ? (profile.is_active ? 1 : 0) : (profile.is_active ?? 0),
    is_favorite: typeof profile.is_favorite === 'boolean' ? (profile.is_favorite ? 1 : 0) : (profile.is_favorite ?? 0),
    created_at: profile.created_at ?? undefined,
    updated_at: profile.updated_at ?? undefined,
  };
}

function sortProfiles(profiles: UserProfile[]) {
  return [...profiles].sort((left, right) => {
    const leftFavorite = Number(left.is_favorite ?? 0) === 1 ? 1 : 0;
    const rightFavorite = Number(right.is_favorite ?? 0) === 1 ? 1 : 0;

    if (leftFavorite !== rightFavorite) {
      return rightFavorite - leftFavorite;
    }

    const leftActive = Number(left.is_active ?? 0) === 1 ? 1 : 0;
    const rightActive = Number(right.is_active ?? 0) === 1 ? 1 : 0;

    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    return (left.display_name ?? '').localeCompare(right.display_name ?? '');
  });
}

function inferHealthStatus(profile: UserProfile): TokenHealthStatus {
  if (!profile.token_value) {
    return 'none';
  }

  if (profile.token_expires_at) {
    const expiresAt = new Date(profile.token_expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
  }

  return 'healthy';
}

interface ProfileStoreState {
  profiles: UserProfile[];
  activeProfileId: string | null;
  tokenHealthMap: Record<string, TokenHealthStatus>;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrateProfiles: () => Promise<void>;
  selectProfile: (profileId: string | null) => void;
  addProfile: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  updateProfile: (profileId: string, changes: Partial<UserProfile>) => Promise<UserProfile | null>;
  deleteProfile: (profileId: string) => Promise<void>;
  setTokenHealth: (profileId: string, status: TokenHealthStatus) => void;
  refreshTokenHealth: () => Promise<void>;
}

const seedProfile = normalizeProfile({
  id: 'local-basic-profile',
  display_name: 'Local workspace',
  auth_level: 'basic',
  is_active: 1,
  commit_name: 'Local user',
  commit_email: 'local@example.com',
  repository_scope: ['.'],
  folder_scope: ['.'],
});

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  profiles: [seedProfile],
  activeProfileId: seedProfile.id,
  tokenHealthMap: { [seedProfile.id]: inferHealthStatus(seedProfile) },
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrateProfiles: async () => {
    if (get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const rows = await invoke<unknown[]>('get_profiles');
      const nextProfiles = sortProfiles((rows ?? []).map((entry) => normalizeProfile(entry as Partial<UserProfile>)));

      if (nextProfiles.length === 0) {
        const fallbackProfiles = [seedProfile];
        set({
          profiles: fallbackProfiles,
          activeProfileId: fallbackProfiles[0]?.id ?? null,
          tokenHealthMap: {
            [fallbackProfiles[0].id]: inferHealthStatus(fallbackProfiles[0]),
          },
          isHydrated: true,
          isLoading: false,
        });
        return;
      }

      const persistedActiveProfile = nextProfiles.find((profile) => Number(profile.is_active ?? 0) === 1) ?? null;
      const currentActiveProfile = get().activeProfileId
        ? nextProfiles.find((profile) => profile.id === get().activeProfileId) ?? null
        : null;
      const nextActiveProfileId = persistedActiveProfile?.id ?? currentActiveProfile?.id ?? nextProfiles[0]?.id ?? null;

      const nextTokenHealth: Record<string, TokenHealthStatus> = {};
      nextProfiles.forEach((profile) => {
        nextTokenHealth[profile.id] = get().tokenHealthMap[profile.id] ?? inferHealthStatus(profile);
      });

      set({
        profiles: nextProfiles,
        activeProfileId: nextActiveProfileId,
        tokenHealthMap: nextTokenHealth,
        isHydrated: true,
        isLoading: false,
      });

      await get().refreshTokenHealth();
    } catch (error) {
      console.warn('Falling back to local profile state:', error);
      const fallbackProfiles = get().profiles.length > 0 ? get().profiles : [seedProfile];
      const fallbackActiveId = fallbackProfiles.find((profile) => profile.id === get().activeProfileId)?.id ?? fallbackProfiles[0]?.id ?? null;
      set({
        profiles: fallbackProfiles,
        activeProfileId: fallbackActiveId,
        tokenHealthMap: Object.fromEntries(
          fallbackProfiles.map((profile) => [profile.id, get().tokenHealthMap[profile.id] ?? inferHealthStatus(profile)])
        ),
        isHydrated: true,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unable to hydrate profiles',
      });
    }
  },

  selectProfile: async (profileId) => {
    const previousActiveProfileId = get().activeProfileId;
    set({ activeProfileId: profileId });

    if (!profileId) {
      return;
    }

    try {
      const persistedProfile = await invoke<Partial<UserProfile>>('update_profile', {
        profileId,
        profile: toBackendProfile({
          ...(get().profiles.find((profile) => profile.id === profileId) ?? seedProfile),
          is_active: 1,
          updated_at: new Date().toISOString(),
        }),
      });
      const hydratedProfile = normalizeProfile({
        ...(get().profiles.find((profile) => profile.id === profileId) ?? seedProfile),
        ...(persistedProfile ?? {}),
        is_active: 1,
      });

      set((state) => ({
        profiles: sortProfiles(
          state.profiles.map((profile) => {
            if (profile.id === profileId) {
              return hydratedProfile;
            }
            if (profile.id === previousActiveProfileId && previousActiveProfileId !== profileId) {
              return normalizeProfile({ ...profile, is_active: 0 });
            }
            return profile;
          })
        ),
        activeProfileId: hydratedProfile.id,
        tokenHealthMap: {
          ...state.tokenHealthMap,
          [hydratedProfile.id]: state.tokenHealthMap[hydratedProfile.id] ?? inferHealthStatus(hydratedProfile),
        },
        error: null,
      }));
    } catch (error) {
      console.warn('Unable to persist active profile change:', error);
      set({ error: error instanceof Error ? error.message : 'Unable to activate profile' });
    }
  },

  addProfile: async (profile) => {
    const nextProfile = normalizeProfile({
      ...profile,
      id: profile.id ?? buildProfileId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    try {
      const persistedProfile = await invoke<Partial<UserProfile>>('add_profile', { profile: toBackendProfile(nextProfile) });
      const hydratedProfile = normalizeProfile({ ...nextProfile, ...(persistedProfile ?? {}) });
      set((state) => ({
        profiles: sortProfiles([...state.profiles.filter((entry) => entry.id !== hydratedProfile.id), hydratedProfile]),
        activeProfileId: state.activeProfileId ?? hydratedProfile.id,
        tokenHealthMap: { ...state.tokenHealthMap, [hydratedProfile.id]: inferHealthStatus(hydratedProfile) },
        error: null,
      }));
      return hydratedProfile;
    } catch (error) {
      console.warn('Unable to persist profile via Tauri:', error);
      set((state) => ({
        profiles: sortProfiles([...state.profiles.filter((entry) => entry.id !== nextProfile.id), nextProfile]),
        activeProfileId: state.activeProfileId ?? nextProfile.id,
        tokenHealthMap: { ...state.tokenHealthMap, [nextProfile.id]: inferHealthStatus(nextProfile) },
        error: error instanceof Error ? error.message : 'Unable to persist profile',
      }));
      throw error;
    }
  },

  updateProfile: async (profileId, changes) => {
    const currentProfile = get().profiles.find((profile) => profile.id === profileId);
    if (!currentProfile) {
      return null;
    }

    const nextProfile = normalizeProfile({
      ...currentProfile,
      ...changes,
      id: profileId,
      updated_at: new Date().toISOString(),
    });

    try {
      const persistedProfile = await invoke<Partial<UserProfile>>('update_profile', { profileId, profile: toBackendProfile(nextProfile) });
      const hydratedProfile = normalizeProfile({ ...nextProfile, ...(persistedProfile ?? {}) });
      set((state) => ({
        profiles: sortProfiles(state.profiles.map((profile) => (profile.id === profileId ? hydratedProfile : profile))),
        tokenHealthMap: { ...state.tokenHealthMap, [hydratedProfile.id]: state.tokenHealthMap[hydratedProfile.id] ?? inferHealthStatus(hydratedProfile) },
        error: null,
      }));
      return hydratedProfile;
    } catch (error) {
      console.warn('Unable to update profile via Tauri:', error);
      set((state) => ({
        profiles: sortProfiles(state.profiles.map((profile) => (profile.id === profileId ? nextProfile : profile))),
        tokenHealthMap: { ...state.tokenHealthMap, [nextProfile.id]: state.tokenHealthMap[nextProfile.id] ?? inferHealthStatus(nextProfile) },
        error: error instanceof Error ? error.message : 'Unable to update profile',
      }));
      throw error;
    }
  },

  deleteProfile: async (profileId) => {
    const nextProfiles = get().profiles.filter((profile) => profile.id !== profileId);
    const fallbackActiveProfileId = nextProfiles[0]?.id ?? null;

    try {
      await invoke('delete_profile', { profileId });
      set((state) => ({
        profiles: sortProfiles(nextProfiles),
        activeProfileId: state.activeProfileId === profileId ? fallbackActiveProfileId : state.activeProfileId,
        tokenHealthMap: Object.fromEntries(
          nextProfiles.map((profile) => [profile.id, state.tokenHealthMap[profile.id] ?? inferHealthStatus(profile)])
        ),
        error: null,
      }));
    } catch (error) {
      console.warn('Unable to delete profile via Tauri:', error);
      set((state) => ({
        profiles: sortProfiles(get().profiles),
        activeProfileId: state.activeProfileId,
        tokenHealthMap: state.tokenHealthMap,
        error: error instanceof Error ? error.message : 'Unable to delete profile',
      }));
      throw error;
    }
  },

  setTokenHealth: (profileId, status) => {
    set((state) => ({
      tokenHealthMap: { ...state.tokenHealthMap, [profileId]: status },
    }));
  },

  refreshTokenHealth: async () => {
    const profileIds = get().profiles.map((profile) => profile.id);

    if (profileIds.length === 0) {
      return;
    }

    try {
      const response = await invoke<unknown>('check_profile_tokens', { profileIds });
      const nextTokenHealth: Record<string, TokenHealthStatus> = {};

      if (Array.isArray(response)) {
        response.forEach((entry) => {
          if (entry && typeof entry === 'object' && 'profile_id' in entry && 'status' in entry) {
            const profileId = String((entry as Record<string, unknown>).profile_id);
            const status = (entry as Record<string, unknown>).status;
            nextTokenHealth[profileId] = typeof status === 'string' ? (status as TokenHealthStatus) : inferHealthStatus(get().profiles.find((profile) => profile.id === profileId) ?? seedProfile);
          }
        });
      } else if (response && typeof response === 'object') {
        Object.entries(response as Record<string, unknown>).forEach(([profileId, status]) => {
          nextTokenHealth[profileId] = typeof status === 'string' ? (status as TokenHealthStatus) : inferHealthStatus(get().profiles.find((profile) => profile.id === profileId) ?? seedProfile);
        });
      }

      set((state) => ({
        tokenHealthMap: {
          ...state.tokenHealthMap,
          ...Object.fromEntries(
            state.profiles.map((profile) => [profile.id, nextTokenHealth[profile.id] ?? state.tokenHealthMap[profile.id] ?? inferHealthStatus(profile)])
          ),
        },
      }));
    } catch (error) {
      console.warn('Unable to check profile token health:', error);
      set((state) => ({
        tokenHealthMap: Object.fromEntries(
          state.profiles.map((profile) => [profile.id, state.tokenHealthMap[profile.id] ?? inferHealthStatus(profile)])
        ),
      }));
    }
  },
}));
