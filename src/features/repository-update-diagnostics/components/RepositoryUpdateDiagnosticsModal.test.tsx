import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryUpdateDiagnosticsModal } from './RepositoryUpdateDiagnosticsModal';

const snapshot = {
  capturedAt: '2026-08-06T12:00:00.000Z',
  diagnostics: {
    activeEntries: 2,
    runningRefreshes: 1,
    coalescedRequests: 0,
    shuttingDown: false,
    watcherCount: 1,
    pollingCount: 1,
    degradedEntries: 0,
  },
  repositories: [
    {
      repositoryId: 'repo-alpha',
      priority: 'foreground' as const,
      detailActive: true,
      running: true,
      followUp: false,
      failureCount: 0,
      triggerReason: 'manual',
      monitorMode: 'watcher' as const,
      generation: 3,
    },
    {
      repositoryId: 'repo-beta',
      priority: 'background' as const,
      detailActive: false,
      running: false,
      followUp: false,
      failureCount: 0,
      triggerReason: '',
      monitorMode: 'polling' as const,
      generation: 2,
    },
  ],
};

vi.mock('../hooks/useRepositoryUpdateDiagnostics', () => ({
  useRepositoryUpdateDiagnostics: () => ({
    snapshot,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: (selector: (state: { repos: Array<Record<string, string>> }) => unknown) => selector({
    repos: [
      { id: 'repo-alpha', alias_name: 'Alpha', display_name: 'Alpha Repository' },
      { id: 'repo-beta', alias_name: '', display_name: 'Beta' },
    ],
  }),
}));

describe('RepositoryUpdateDiagnosticsModal', () => {
  it('filters repositories and clears the search', async () => {
    const user = userEvent.setup();

    render(<RepositoryUpdateDiagnosticsModal isOpen onClose={vi.fn()} />);

    const searchInput = screen.getByRole('textbox', { name: 'Search repository or ID' });
    await user.type(searchInput, 'alpha');

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('clears search on the first Escape and closes on the next Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<RepositoryUpdateDiagnosticsModal isOpen onClose={onClose} />);

    const searchInput = screen.getByRole('textbox', { name: 'Search repository or ID' });
    await user.type(searchInput, 'alpha');
    await user.keyboard('{Escape}');

    expect(searchInput).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses from a backdrop press but not when a press starts inside the dialog', () => {
    const onClose = vi.fn();

    render(<RepositoryUpdateDiagnosticsModal isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();

    fireEvent.mouseDown(backdrop!);
    fireEvent.mouseUp(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });
});