import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from './profileStore';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('profile store token health', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useProfileStore.setState({
      profiles: [
        {
          id: 'profile-1',
          display_name: 'OAuth Profile',
          auth_level: 'full_oauth',
          api_base_url: 'https://api.github.com',
          is_active: 0,
        },
      ],
      activeProfileId: null,
      tokenHealthMap: { 'profile-1': 'none' },
      isHydrated: true,
      isLoading: false,
      error: null,
    });
  });

  it('refreshes token health when a full OAuth profile becomes active', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'update_profile') {
        return {
          id: 'profile-1',
          display_name: 'OAuth Profile',
          auth_level: 'full_oauth',
          api_base_url: 'https://api.github.com',
          is_active: 1,
        };
      }

      if (command === 'check_profile_tokens') {
        return [{ profile_id: 'profile-1', status: 'healthy' }];
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    await useProfileStore.getState().selectProfile('profile-1');

    expect(useProfileStore.getState().activeProfileId).toBe('profile-1');
    expect(useProfileStore.getState().tokenHealthMap['profile-1']).toBe('healthy');
    expect(invokeMock).toHaveBeenCalledWith('check_profile_tokens', { profileIds: ['profile-1'] });
  });

  it('forwards full OAuth classification when updating a profile', async () => {
    invokeMock.mockImplementation(async (command: string, payload: { profile?: { auth_level?: string } }) => {
      if (command === 'update_profile') {
        expect(payload.profile?.auth_level).toBe('full_oauth');
        return {
          id: 'profile-1',
          display_name: 'OAuth Profile',
          auth_level: 'full_oauth',
          api_base_url: 'https://api.github.com',
          is_active: 0,
        };
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    await useProfileStore.getState().updateProfile('profile-1', { auth_level: 'full_oauth' });

    expect(invokeMock).toHaveBeenCalledWith('update_profile', expect.objectContaining({
      profileId: 'profile-1',
      profile: expect.objectContaining({ auth_level: 'full_oauth' }),
    }));
  });

  it('includes the api_base_url when updating a profile so saved edits persist', async () => {
    invokeMock.mockImplementation(async (command: string, payload: { profile?: { api_base_url?: string; auth_level?: string } }) => {
      if (command === 'update_profile') {
        expect(payload.profile?.api_base_url).toBe('https://github.example.com');
        expect(payload.profile?.auth_level).toBe('full_oauth');
        return {
          id: 'profile-1',
          display_name: 'OAuth Profile',
          auth_level: 'full_oauth',
          api_base_url: 'https://github.example.com',
          is_active: 0,
        };
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    await useProfileStore.getState().updateProfile('profile-1', { api_base_url: 'https://github.example.com' });

    expect(invokeMock).toHaveBeenCalledWith('update_profile', expect.objectContaining({
      profileId: 'profile-1',
      profile: expect.objectContaining({ api_base_url: 'https://github.example.com' }),
    }));
  });
});
