import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsManagementModal } from './SettingsManagementModal';

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: vi.fn() }),
}));

describe('SettingsManagementModal', () => {
  it('renders when open without crashing on backdrop handlers', () => {
    render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[]}
        danglingTagNames={[]}
        onClose={vi.fn()}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    expect(screen.getByText('Data Management')).toBeInTheDocument();
  });

  it('exposes accessible tabs, panels, and color controls', () => {
    render(
      <SettingsManagementModal
        isOpen
        groups={[{ id: 'group-1', group_name: 'Work', color_hex: '#64748B', repo_count: 1 }]}
        tags={[{ id: 'tag-1', tag_name: 'Active', color_hex: '#3B82F6', repo_count: 2 }]}
        danglingTagNames={[]}
        onClose={vi.fn()}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Data Management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close management modal' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tags' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Groups' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'data-management-tab-tags');
    expect(screen.getByLabelText('Choose color for new tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose color for tag Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Groups' }));

    expect(screen.getByRole('tab', { name: 'Groups' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'data-management-tab-groups');
    expect(screen.getByLabelText('Choose color for new group')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose color for group Work')).toBeInTheDocument();
    expect(screen.queryByLabelText('Choose color for new tag')).not.toBeInTheDocument();
  });

  it('keeps the Tags tab selected when the tag list refreshes after creation', async () => {
    const onCreateTag = vi.fn(async () => 'tag-2');
    const initialTags = [{ id: 'tag-1', tag_name: 'Active', color_hex: '#3B82F6', repo_count: 1 }];
    const { rerender } = render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={initialTags}
        danglingTagNames={[]}
        onClose={vi.fn()}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={onCreateTag}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Create a new tag'), { target: { value: 'Review' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Create' }).closest('form')!);
    });

    expect(onCreateTag).toHaveBeenCalledWith('Review', '#3B82F6');

    rerender(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[...initialTags, { id: 'tag-2', tag_name: 'Review', color_hex: '#3B82F6', repo_count: 0 }]}
        danglingTagNames={[]}
        onClose={vi.fn()}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={onCreateTag}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    expect(screen.getByRole('tab', { name: 'Tags' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'data-management-tab-tags');
  });

  it('closes with Escape and restores the previous body overflow value', () => {
    const onClose = vi.fn();
    document.body.style.overflow = 'scroll';

    const { unmount } = render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[]}
        danglingTagNames={[]}
        onClose={onClose}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('keeps the management modal open when Escape closes a child confirmation', () => {
    const onClose = vi.fn();

    render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[{ id: 'tag-1', tag_name: 'Active', color_hex: '#3B82F6', repo_count: 1 }]}
        danglingTagNames={[]}
        onClose={onClose}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete tag' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Delete tag' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Data Management' })).toBeInTheDocument();
  });

  it('confirms tag deletion once and removes the confirmation', async () => {
    const onClose = vi.fn();
    const onDeleteTag = vi.fn(async () => undefined);

    render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[{ id: 'tag-1', tag_name: 'Active', color_hex: '#3B82F6', repo_count: 1 }]}
        danglingTagNames={[]}
        onClose={onClose}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={onDeleteTag}
        onCleanupDanglingTags={vi.fn(async () => 0)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      const confirmButton = screen.getByRole('button', { name: 'Delete tag' });
      fireEvent.mouseDown(confirmButton);
      fireEvent.mouseUp(confirmButton);
      fireEvent.click(confirmButton);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleteTag).toHaveBeenCalledOnce();
    expect(onDeleteTag).toHaveBeenCalledWith('tag-1');
    expect(screen.queryByRole('dialog', { name: 'Delete tag' })).not.toBeInTheDocument();
  });

  it('clears a pending tag confirmation when the modal is reopened', () => {
    const props = {
      groups: [],
      tags: [{ id: 'tag-1', tag_name: 'Active', color_hex: '#3B82F6', repo_count: 1 }],
      danglingTagNames: [],
      onClose: vi.fn(),
      onCreateGroup: vi.fn(async () => null),
      onCreateTag: vi.fn(async () => null),
      onUpdateGroup: vi.fn(async () => undefined),
      onDeleteGroup: vi.fn(async () => undefined),
      onUpdateTag: vi.fn(async () => undefined),
      onDeleteTag: vi.fn(async () => undefined),
      onCleanupDanglingTags: vi.fn(async () => 0),
    };
    const { rerender } = render(<SettingsManagementModal {...props} isOpen />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete tag' })).toBeInTheDocument();

    rerender(<SettingsManagementModal {...props} isOpen={false} />);
    rerender(<SettingsManagementModal {...props} isOpen />);

    expect(screen.queryByRole('dialog', { name: 'Delete tag' })).not.toBeInTheDocument();
  });

  it('restores and purges archived repositories through the archive tab', async () => {
    const onRestoreRepository = vi.fn(async () => undefined);
    const onPurgeRepository = vi.fn(async () => undefined);

    render(
      <SettingsManagementModal
        isOpen
        groups={[]}
        tags={[]}
        archivedRepos={[{
          id: 'repo-1',
          display_name: 'Archived Repo',
          absolute_path: 'C:/projects/archived-repo',
          remote_url: null,
          archived_at: '2026-08-07T10:00:00Z',
        }]}
        danglingTagNames={[]}
        onClose={vi.fn()}
        onCreateGroup={vi.fn(async () => null)}
        onCreateTag={vi.fn(async () => null)}
        onUpdateGroup={vi.fn(async () => undefined)}
        onDeleteGroup={vi.fn(async () => undefined)}
        onUpdateTag={vi.fn(async () => undefined)}
        onDeleteTag={vi.fn(async () => undefined)}
        onCleanupDanglingTags={vi.fn(async () => 0)}
        onRestoreRepository={onRestoreRepository}
        onPurgeRepository={onPurgeRepository}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Archived repositories/ }));
    expect(screen.getByText('Archived Repo')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    });
    expect(onRestoreRepository).toHaveBeenCalledWith('repo-1');

    fireEvent.click(screen.getByRole('button', { name: 'Purge' }));
    expect(screen.getByRole('dialog', { name: 'Purge archived repository' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Purge repository' }));
    });
    expect(onPurgeRepository).toHaveBeenCalledWith('repo-1');
  });
});
