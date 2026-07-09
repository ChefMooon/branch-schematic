import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileManagementModal } from './ProfileManagementModal';
import type { UserProfile } from '../types';

vi.mock('./OAuthConnectButton.tsx', () => ({
  OAuthConnectButton: () => null,
}));

const profile: UserProfile = {
  id: 'profile-1',
  display_name: 'Alpha',
  auth_level: 'basic',
};

const profiles = [profile];

describe('ProfileManagementModal', () => {
  it('closes the modal only when the backdrop press is released on the backdrop', () => {
    const onClose = vi.fn();

    render(
      <ProfileManagementModal
        isOpen
        onClose={onClose}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const overlay = screen.getByTestId('profile-management-modal-overlay');

    fireEvent.mouseDown(overlay);
    fireEvent.mouseUp(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close the modal when the backdrop press is released outside the overlay', () => {
    const onClose = vi.fn();

    render(
      <ProfileManagementModal
        isOpen
        onClose={onClose}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const overlay = screen.getByTestId('profile-management-modal-overlay');

    fireEvent.mouseDown(overlay);
    fireEvent.mouseUp(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open after saving an existing profile', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaveProfile = vi.fn().mockResolvedValue(profile);

    render(
      <ProfileManagementModal
        isOpen
        onClose={onClose}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={onSaveProfile}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(onSaveProfile).toHaveBeenCalledWith('profile-1', expect.objectContaining({ display_name: 'Alpha' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open and switches to editing after creating a new profile', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreateProfile = vi.fn().mockResolvedValue({ ...profile, id: 'profile-2', display_name: 'Created profile' });

    render(
      <ProfileManagementModal
        isOpen
        onClose={onClose}
        profile={null}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={onCreateProfile}
        onSaveProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /create profile/i }));

    expect(onCreateProfile).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Created profile')).toBeInTheDocument();
  });

  it('keeps the selected row highlighted when hovered', () => {
    render(
      <ProfileManagementModal
        isOpen
        onClose={vi.fn()}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const selectButton = screen.getByRole('button', { name: /select profile alpha/i });
    const selectedRow = selectButton.parentElement;

    fireEvent.mouseEnter(selectButton);

    expect(selectedRow?.getAttribute('style')).toContain('border-color: var(--accent, #3b82f6)');
    expect(selectButton.getAttribute('style')).toContain('background-color: transparent');
  });

  it('keeps the current profile highlighted when switching to create mode', async () => {
    const user = userEvent.setup();

    render(
      <ProfileManagementModal
        isOpen
        onClose={vi.fn()}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const selectedRow = screen.getByRole('button', { name: /select profile alpha/i }).parentElement;

    expect(selectedRow?.getAttribute('style')).toContain('border-color: var(--accent, #3b82f6)');

    await user.click(screen.getByRole('button', { name: /^new$/i }));

    expect(selectedRow?.getAttribute('style')).toContain('border-color: var(--accent, #3b82f6)');
  });

  it('asks for confirmation before deleting the active profile from the footer action', async () => {
    const user = userEvent.setup();
    const onDeleteProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProfileManagementModal
        isOpen
        onClose={vi.fn()}
        profile={profile}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={onDeleteProfile}
        onSelectProfile={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByRole('heading', { name: /delete profile/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /cancel/i })[1]);

    expect(onDeleteProfile).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting a profile from the profile list', async () => {
    const user = userEvent.setup();
    const onDeleteProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProfileManagementModal
        isOpen
        onClose={vi.fn()}
        profile={null}
        profiles={profiles}
        tokenHealthMap={{}}
        onCreateProfile={vi.fn()}
        onSaveProfile={vi.fn()}
        onDeleteProfile={onDeleteProfile}
        onSelectProfile={vi.fn()}
      />
    );

    await user.click(screen.getByTitle(/delete profile alpha/i));

    expect(screen.getByRole('heading', { name: /delete profile/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete profile$/i }));

    expect(onDeleteProfile).toHaveBeenCalledWith('profile-1');
  });
});
