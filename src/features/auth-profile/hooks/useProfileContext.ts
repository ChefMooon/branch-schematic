import { useEffect, useMemo } from 'react';
import { useProfileStore } from '../stores/profileStore';

export function useProfileContext() {
  const {
    profiles,
    activeProfileId,
    tokenHealthMap,
    isHydrated,
    isLoading,
    error,
    hydrateProfiles,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    refreshTokenHealth,
  } = useProfileStore();

  useEffect(() => {
    void hydrateProfiles();
  }, [hydrateProfiles]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void refreshTokenHealth();
  }, [isHydrated, refreshTokenHealth]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  return {
    profiles,
    activeProfile,
    activeProfileId,
    tokenHealthMap,
    isHydrated,
    isLoading,
    error,
    hydrateProfiles,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    refreshTokenHealth,
  };
}
