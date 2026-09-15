import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDetailActionsMenu } from './RepositoryDetailActionsMenu';
import type { TrackedPath } from '../../../types/git';

const invokeMock = vi.fn();
const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast: addToastMock }),
}));

describe('RepositoryDetailActionsMenu', () => {
  const baseRepo: TrackedPath = {
    id: 'repo-1',
    display_name: 'Branch Schematic',
    absolute_path: '/tmp/branch-schematic',
    current_branch: 'main',
    repo_origin_type: 'OWNED',
    has_upstream: true,
  };

  const renderMenu = (repoOverrides: Partial<TrackedPath> = {}, onClose: () => void = () => undefined) => {
    render(<RepositoryDetailActionsMenu repo={{ ...baseRepo, ...repoOverrides }} onClose={onClose} />);
  };

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    addToastMock.mockClear();
  });

  it('opens the grouped action menu and hides remote actions for local-only repositories', async () => {
    renderMenu({ repo_origin_type: 'LOCAL_ONLY' });

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));

    expect(screen.getByRole('menuitem', { name: /refresh status/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /fetch origin/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /pull upstream/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /push changes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /open in terminal/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /rename alias/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /archive repository/i })).toBeInTheDocument();
  });

  it('shows pull and push for repositories with a remote', async () => {
    renderMenu({ repo_origin_type: 'OWNED' });

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));

    expect(screen.getByRole('menuitem', { name: /pull upstream/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /push changes/i })).toBeInTheDocument();
  });

  it('labels the push action as publication when the branch has no upstream', async () => {
    renderMenu({ has_upstream: false });

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));

    expect(screen.getByRole('menuitem', { name: /publish branch/i })).toBeInTheDocument();
  });

  it('requires explicit confirmation before replacing an existing remote branch', async () => {
    invokeMock.mockRejectedValueOnce(
      "Branch 'main' already exists on origin [publication_conflict]. Publishing over it requires explicit destructive confirmation.",
    );
    renderMenu({ has_upstream: false });

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /publish branch/i }));

    expect(await screen.findByRole('dialog', { name: /replace remote branch/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /replace branch/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_push_operation', {
        pathId: 'repo-1',
        replaceExisting: true,
      });
    });
  });

  it('runs fetch through the backend and syncs git status afterwards', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /fetch origin/i }));

    expect(screen.queryByRole('menuitem', { name: /fetch origin/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_fetch_operation', { pathId: 'repo-1' });
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('refresh_repository_git_status', {
        pathId: 'repo-1',
        absolutePath: '/tmp/branch-schematic',
      });
    });
  });

  it('propagates backend push errors to the toast unchanged', async () => {
    const backendMessage = 'Git authentication [authentication]. The selected profile has no readable keyring token.';
    invokeMock.mockRejectedValueOnce(backendMessage);
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /push changes/i }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith({
        variant: 'error',
        title: 'Push Failed',
        message: backendMessage,
      });
    });
  });

  it('completes a push and reports the backend message', async () => {
    invokeMock.mockResolvedValueOnce('Pushed main.');
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /push changes/i }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'success',
        message: 'Pushed main.',
      }));
    });
  });

  it('renames the alias through the text input modal', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename alias/i }));

    const aliasInput = await screen.findByRole('textbox', { name: 'Alias' });
    await userEvent.clear(aliasInput);
    await userEvent.type(aliasInput, 'BS');
    await userEvent.click(screen.getByRole('button', { name: /save alias/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('set_repository_alias', { pathId: 'repo-1', alias: 'BS' });
    });
  });

  it('clears the alias through the modal reset action', async () => {
    renderMenu({ alias_name: 'Existing Alias' });

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename alias/i }));

    await screen.findByRole('textbox', { name: 'Alias' });
    await userEvent.click(screen.getByRole('button', { name: /clear alias/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('set_repository_alias', { pathId: 'repo-1', alias: '' });
    });
  });

  it('hides the clear alias action when the repository has no alias', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename alias/i }));

    await screen.findByRole('textbox', { name: 'Alias' });
    expect(screen.queryByRole('button', { name: /clear alias/i })).not.toBeInTheDocument();
  });

  it('notifies history listeners after a git operation completes', async () => {
    const onHistoryChanged = vi.fn();
    render(<RepositoryDetailActionsMenu repo={{ ...baseRepo }} onClose={() => undefined} onHistoryChanged={onHistoryChanged} />);

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /fetch origin/i }));

    await waitFor(() => {
      expect(onHistoryChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('archives through the confirmation modal and closes the detail view', async () => {
    const onClose = vi.fn();
    renderMenu({}, onClose);

    await userEvent.click(screen.getByRole('button', { name: /repository actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /archive repository/i }));

    expect(await screen.findByText(/archive the repository from your workspace/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('untrack_repository', { pathId: 'repo-1' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
