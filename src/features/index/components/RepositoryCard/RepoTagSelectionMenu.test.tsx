import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TagSelectionModal } from './RepoTagSelectionMenu';

vi.mock('../../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({
    addToast: vi.fn(),
  }),
}));

describe('TagSelectionModal', () => {
  it('applies tag changes immediately when a tag is toggled', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <TagSelectionModal
        isOpen
        availableTags={[{ id: 'tag-1', tag_name: 'backend', color_hex: '#4f46e5', repo_count: 1 }]}
        assignedTagNames={[]}
        onClose={vi.fn()}
        onApply={onApply}
      />
    );

    await user.click(screen.getByRole('button', { name: /backend/i }));

    expect(onApply).toHaveBeenCalledWith(['backend']);
  });

  it('uses a done action to close the modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TagSelectionModal
        isOpen
        availableTags={[]}
        assignedTagNames={[]}
        onClose={onClose}
        onApply={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByRole('button', { name: /done/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
