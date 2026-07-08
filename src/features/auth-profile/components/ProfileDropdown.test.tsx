import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileDropdown } from './ProfileDropdown';

describe('ProfileDropdown', () => {
  it('keeps the overlay from blocking window interactions while preserving outside-click closing', () => {
    render(
      <ProfileDropdown
        isOpen
        anchorElement={document.createElement('button')}
        profiles={[
          {
            id: 'profile-1',
            display_name: 'Test Profile',
            auth_level: 'user',
            is_favorite: 0,
          },
        ]}
        activeProfile={null}
        tokenHealthMap={{}}
        onClose={() => undefined}
        onSelectProfile={() => undefined}
        onToggleFavorite={() => undefined}
        onOpenManagement={() => undefined}
      />,
    );

    const overlay = screen.getByTestId('profile-dropdown-overlay');
    const backdrop = screen.getByTestId('profile-dropdown-backdrop');

    expect(overlay).toHaveStyle({ pointerEvents: 'none' });
    expect(backdrop).toHaveStyle({ pointerEvents: 'auto' });
  });
});
