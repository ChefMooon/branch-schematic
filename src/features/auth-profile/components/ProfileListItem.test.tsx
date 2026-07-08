import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileListItem } from './ProfileListItem';

describe('ProfileListItem', () => {
  it('selects the profile and toggles favorite state from separate controls', async () => {
    const user = userEvent.setup();
    const onSelectProfile = vi.fn();
    const onToggleFavorite = vi.fn();
    const onDeleteProfile = vi.fn();

    render(
      <ProfileListItem
        profile={{
          id: 'profile-1',
          display_name: 'Octocat',
          auth_level: 'full_oauth',
          is_favorite: 0,
        }}
        isSelected={false}
        isFavorite={false}
        status="healthy"
        onSelectProfile={onSelectProfile}
        onToggleFavorite={onToggleFavorite}
        onDeleteProfile={onDeleteProfile}
      />
    );

    await user.click(screen.getByRole('button', { name: /select profile octocat/i }));
    expect(onSelectProfile).toHaveBeenCalledWith('profile-1');

    await user.click(screen.getByRole('button', { name: /favorite profile octocat/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('profile-1', true);
  });
});
