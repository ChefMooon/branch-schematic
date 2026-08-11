import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddLocalRepositoryModal } from './AddLocalRepositoryModal';

const invokeMock = vi.fn();
const addToastMock = vi.fn();
const hydrateFromBackendMock = vi.fn(async () => undefined);
const hydrateQuickFilterMetadataMock = vi.fn(async () => undefined);
const reconcileImportedRepositoryMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    hydrateFromBackend: hydrateFromBackendMock,
    hydrateQuickFilterMetadata: hydrateQuickFilterMetadataMock,
    reconcileImportedRepository: reconcileImportedRepositoryMock,
  }),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: addToastMock }),
}));

describe('AddLocalRepositoryModal notifications', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    addToastMock.mockReset();
    hydrateFromBackendMock.mockClear();
    hydrateQuickFilterMetadataMock.mockClear();
    reconcileImportedRepositoryMock.mockClear();
  });

  it('uses a toast-only notification when a repository is added', async () => {
    invokeMock.mockResolvedValue({
      outcome: 'added',
      message: 'Repository added.',
      id: 'repo-1',
      display_name: 'Example',
      absolute_path: 'C:/repos/example',
      metadata_ready: false,
    });

    render(<AddLocalRepositoryModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'C:/repos/example');
    await userEvent.click(screen.getByRole('button', { name: 'Add Repository' }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Repository added',
        variant: 'success',
        target: 'toast',
      }));
    });
  });

  it('keeps repository-add failures in the notification inbox', async () => {
    invokeMock.mockRejectedValue(new Error('Not a Git repository.'));

    render(<AddLocalRepositoryModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'C:/repos/example');
    await userEvent.click(screen.getByRole('button', { name: 'Add Repository' }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Repository could not be added',
        variant: 'error',
        target: 'both',
        message: 'Not a Git repository.',
      }));
    });
  });
});
