import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryProfileAssignmentControl } from './RepositoryProfileAssignmentControl';

const invokeMock = vi.fn();
const hydrateProfilesMock = vi.fn();
const profile = {
  id: 'profile-1',
  display_name: 'Work OAuth',
  auth_level: 'full_oauth' as const,
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('../stores/profileStore', () => ({
  useProfileStore: (selector: (state: unknown) => unknown) =>
    selector({
      profiles: [profile],
      isHydrated: true,
      hydrateProfiles: hydrateProfilesMock,
    }),
}));

describe('RepositoryProfileAssignmentControl', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    hydrateProfilesMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_repository_profile_assignment') {
        return { profile_id: null, profile_name: null, auth_level: null, stale: false };
      }
      if (command === 'get_resolved_profile') {
        return {
          profile_name: 'Active fallback',
          auth_level: 'local_system',
          resolution_source: 'active_profile',
        };
      }
      return undefined;
    });
  });

  it('displays the resolved profile and resolution source without an assignment', async () => {
    const user = userEvent.setup();
    render(<RepositoryProfileAssignmentControl repoPathId="repo-1" />);

    await user.click(await screen.findByRole('button', { name: /manage repository profile assignment/i }));

    expect(screen.getByText('Active fallback')).toBeInTheDocument();
    expect(screen.getByText('Local system · Inherited from the active profile')).toBeInTheDocument();
  });

  it('assigns a profile and refreshes the resolved state', async () => {
    const user = userEvent.setup();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_repository_profile_assignment') {
        return { profile_id: null, profile_name: null, auth_level: null, stale: false };
      }
      if (command === 'get_resolved_profile') {
        return { profile_name: 'Active fallback', auth_level: 'local_system', resolution_source: 'active_profile' };
      }
      if (command === 'assign_repository_profile') {
        return { profile_id: 'profile-1', profile_name: 'Work OAuth', auth_level: 'full_oauth', stale: false };
      }
      return undefined;
    });

    render(<RepositoryProfileAssignmentControl repoPathId="repo-1" />);
    await user.click(await screen.findByRole('button', { name: /manage repository profile assignment/i }));
    await user.click(screen.getByRole('button', { name: /assign work oauth/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('assign_repository_profile', {
        repoPathId: 'repo-1',
        profileId: 'profile-1',
      });
    });
  });

  it('shows stale assignments and offers a destructive clear confirmation', async () => {
    const user = userEvent.setup();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_repository_profile_assignment') {
        return { profile_id: 'deleted-profile', profile_name: null, auth_level: null, stale: true };
      }
      if (command === 'get_resolved_profile') {
        return { profile_name: 'Active fallback', auth_level: 'local_system', resolution_source: 'active_profile' };
      }
      return undefined;
    });

    render(<RepositoryProfileAssignmentControl repoPathId="repo-1" />);
    await user.click(await screen.findByRole('button', { name: /manage repository profile assignment/i }));

    expect(screen.getByText('Stale assignment')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear assignment/i }));
    expect(screen.getByRole('heading', { name: /clear repository profile assignment/i })).toBeInTheDocument();
  });
});
