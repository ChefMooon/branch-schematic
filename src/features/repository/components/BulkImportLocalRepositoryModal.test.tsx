import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkImportLocalRepositoryModal } from './BulkImportLocalRepositryModal';
import { useImportStore } from '../stores/import-store';

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
  useWorkspaceStore: Object.assign(
    () => ({
      hydrateFromBackend: hydrateFromBackendMock,
      hydrateQuickFilterMetadata: hydrateQuickFilterMetadataMock,
    }),
    { getState: () => ({ reconcileImportedRepository: reconcileImportedRepositoryMock }) },
  ),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: addToastMock }),
}));

describe('BulkImportLocalRepositoryModal notifications', () => {
  const discoveredRepository = {
    display_name: 'Example',
    absolute_path: 'C:/repos/example',
    is_git_repository: true,
  };

  beforeEach(() => {
    invokeMock.mockReset();
    addToastMock.mockReset();
    hydrateFromBackendMock.mockClear();
    hydrateQuickFilterMetadataMock.mockClear();
    reconcileImportedRepositoryMock.mockClear();
    useImportStore.setState({ job: null });
  });

  async function prepareImport() {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'crawl_repositories_command') return Promise.resolve([discoveredRepository]);
      return Promise.resolve({ outcome: 'added', message: 'Repository added.' });
    });

    render(<BulkImportLocalRepositoryModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Scan root path' }), 'C:/repos');
    await userEvent.click(screen.getByRole('button', { name: 'Scan' }));
    await screen.findByText('Example');
  }

  it('uses a toast-only notification when repositories are imported', async () => {
    await prepareImport();
    await userEvent.click(screen.getByRole('button', { name: 'Import selected' }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Repositories imported',
        variant: 'success',
        target: 'toast',
      }));
    });
  });

  it('keeps bulk-import failures in the notification inbox', async () => {
    await prepareImport();
    invokeMock.mockImplementation((command: string) => {
      if (command === 'add_new_tracked_path') return Promise.reject(new Error('Import failed.'));
      return Promise.resolve([discoveredRepository]);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Import selected' }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Bulk import failed',
        variant: 'error',
        target: 'both',
        message: 'Imported 0 repositories. Skipped 0. Failed 1.',
      }));
    });
  });
});
