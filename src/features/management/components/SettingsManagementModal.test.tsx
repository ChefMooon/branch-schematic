import { render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Tag and Group Management')).toBeInTheDocument();
  });
});
