import { useEffect, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretUp,
  Desktop,
  FolderOpen,
  MagnifyingGlass,
  PencilSimple,
  PushPin,
  SlidersHorizontal,
  Star,
  Terminal,
  Trash,
} from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { TextInputModal } from '../../../components/Modal/TextInputModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import type { TrackedPath } from '../../../types/git';
import { RepoThemeModal } from '../../dashboard/components/RepositoryCard/RepoThemeModal';
import { OpenWithModal } from '../../repository-open/components/OpenWithModal';
import { useRepositoryOpenActions } from '../../repository-open/hooks/useRepositoryOpenActions';

type LoadingAction = 'refresh' | 'fetch' | 'pull' | 'push' | 'alias' | 'archive' | null;

interface RepositoryDetailActionsMenuProps {
  repo: TrackedPath;
  onClose: () => void;
  onHistoryChanged?: () => void;
}

type ActionMenuItemProps = {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
};

function ActionMenuItem({ icon, label, onSelect, disabled = false, danger = false, title }: ActionMenuItemProps) {
  return (
    <button
      type="button"
      className={`repository-view-action-item${danger ? ' repository-view-action-item-danger' : ''}`}
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function RepositoryDetailActionsMenu({ repo, onClose, onHistoryChanged }: RepositoryDetailActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useNotifications();
  const repositoryOpenActions = useRepositoryOpenActions(repo.absolute_path);

  const refreshRepositoryGitStatus = useWorkspaceStore((state) => state.refreshRepositoryGitStatus);
  const setRepositoryFavorite = useWorkspaceStore((state) => state.setRepositoryFavorite);
  const setRepositoryPinned = useWorkspaceStore((state) => state.setRepositoryPinned);
  const updateRepositoryTheme = useWorkspaceStore((state) => state.updateRepositoryTheme);
  const markRepositoryResolved = useWorkspaceStore((state) => state.markRepositoryResolved);
  const setRepositoriesStatus = useWorkspaceStore((state) => state.setRepositoriesStatus);
  const hydrateFromBackend = useWorkspaceStore((state) => state.hydrateFromBackend);
  const removeRepo = useWorkspaceStore((state) => state.removeRepo);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isBusy = loadingAction !== null;
  const isFavorite = (repo.is_favorite ?? 0) === 1;
  const isPinned = (repo.is_pinned ?? 0) === 1;
  const canUseRemoteActions = repo.repo_origin_type !== 'LOCAL_ONLY';
  const isMissing = repo.status === 'missing';

  const closeMenu = () => setIsOpen(false);

  const syncGitStatus = async () => {
    try {
      await refreshRepositoryGitStatus(repo.id, repo.absolute_path);
    } catch (error) {
      console.error('Failed to refresh repository git status:', error);
    }
  };

  const handleRefreshGitStatus = () => {
    if (repo.status === 'verifying') return;
    closeMenu();
    setLoadingAction('refresh');
    void (async () => {
      try {
        await refreshRepositoryGitStatus(repo.id, repo.absolute_path);
      } catch (error) {
        console.error('Failed to refresh branch & sync status:', error);
        addToast({
          variant: 'error',
          title: 'Refresh Failed',
          message: `Could not refresh branch status for ${repo.display_name}.`,
        });
      } finally {
        setLoadingAction(null);
        onHistoryChanged?.();
      }
    })();
  };

  const executeGitOperation = (operation: 'fetch' | 'pull' | 'push') => {
    if (repo.status === 'verifying') return;
    closeMenu();
    setLoadingAction(operation);
    void (async () => {
      try {
        const message = await invoke<string>(`git_${operation}_operation`, { pathId: repo.id });
        addToast({
          variant: 'success',
          title: operation === 'fetch' ? 'Fetch Complete' : operation === 'pull' ? 'Pull Complete' : 'Push Complete',
          message: message || 'Operation completed successfully.',
        });
      } catch (error) {
        console.error(`Git execution failure during ${operation}:`, error);
        addToast({
          variant: 'error',
          title: operation === 'fetch' ? 'Fetch Failed' : operation === 'pull' ? 'Pull Failed' : 'Push Failed',
          message: typeof error === 'string' ? error : `Could not ${operation} ${repo.display_name}.`,
        });
      } finally {
        setLoadingAction(null);
        await syncGitStatus();
        onHistoryChanged?.();
      }
    })();
  };

  const handleNativeAction = (action: () => Promise<void>) => {
    closeMenu();
    void action().catch((error: unknown) => {
      addToast({
        variant: 'error',
        title: 'Repository action failed',
        message: error instanceof Error ? error.message : 'The repository could not be opened.',
      });
    });
  };

  const handleRenameAliasClick = () => {
    closeMenu();
    setIsRenameModalOpen(true);
  };

  const handleAliasClear = async () => {
    if ((repo.alias_name ?? '') === '') {
      setIsRenameModalOpen(false);
      return;
    }

    setLoadingAction('alias');
    try {
      await invoke('set_repository_alias', { pathId: repo.id, alias: '' });
      setIsRenameModalOpen(false);
      addToast({
        variant: 'success',
        title: 'Alias Cleared',
        message: `${repo.display_name} now uses the default repository name.`,
      });
    } catch (error) {
      console.error('Failed to safely commit alias name alteration:', error);
      addToast({
        variant: 'error',
        title: 'Alias Update Failed',
        message: `Could not update alias for ${repo.display_name}.`,
      });
    } finally {
      setLoadingAction(null);
      await hydrateFromBackend();
    }
  };

  const handleAliasSave = async (nextAliasInput: string) => {
    const cleanInput = nextAliasInput.trim();
    const currentAlias = repo.alias_name ?? '';
    const matchesRepoName = cleanInput === repo.display_name;

    if (cleanInput === currentAlias) {
      setIsRenameModalOpen(false);
      return;
    }

    if (matchesRepoName && currentAlias === '') {
      setIsRenameModalOpen(false);
      addToast({
        variant: 'warning',
        title: 'Alias Matches Repository Name',
        message: 'No custom alias was saved because it matches the repository name.',
      });
      return;
    }

    const aliasToPersist = matchesRepoName ? '' : cleanInput;
    setLoadingAction('alias');
    try {
      await invoke('set_repository_alias', { pathId: repo.id, alias: aliasToPersist });
      setIsRenameModalOpen(false);
      if (matchesRepoName) {
        addToast({
          variant: 'warning',
          title: 'Alias Matches Repository Name',
          message: 'Custom alias was removed and the repository name is now used.',
        });
      } else {
        addToast({
          variant: 'success',
          title: 'Alias Updated',
          message: `Alias saved as "${aliasToPersist}".`,
        });
      }
    } catch (error) {
      console.error('Failed to safely commit alias name alteration:', error);
      addToast({
        variant: 'error',
        title: 'Alias Update Failed',
        message: `Could not update alias for ${repo.display_name}.`,
      });
    } finally {
      setLoadingAction(null);
      await hydrateFromBackend();
    }
  };

  const handleToggleFavorite = () => {
    closeMenu();
    void setRepositoryFavorite(repo.id, !isFavorite);
  };

  const handleTogglePinned = () => {
    closeMenu();
    void setRepositoryPinned(repo.id, !isPinned);
  };

  const handleValidateRepository = async () => {
    closeMenu();
    try {
      const isValid = await invoke<boolean>('validate_repository_path', { path: repo.absolute_path });
      if (isValid) {
        markRepositoryResolved(repo.id, repo.absolute_path);
        addToast({
          variant: 'success',
          title: 'Repository verified',
          message: `${repo.display_name} still points to a valid Git repository.`,
        });
      } else {
        setRepositoriesStatus([repo.id], 'missing');
        addToast({
          variant: 'warning',
          title: 'Repository invalid',
          message: `${repo.display_name} no longer points to a valid Git repository.`,
        });
      }
    } catch (error) {
      console.error('Failed to validate repository path:', error);
      addToast({
        variant: 'error',
        title: 'Validation failed',
        message: 'The repository path could not be validated right now.',
      });
    }
  };

  const handleEditThemeClick = () => {
    closeMenu();
    setIsThemeModalOpen(true);
  };

  const handleThemeChange = (colorHex: string | null, iconName: string | null) => {
    void updateRepositoryTheme(repo.id, colorHex, iconName);
  };

  const handleArchiveClick = () => {
    closeMenu();
    setIsArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = async () => {
    setLoadingAction('archive');
    try {
      await invoke('untrack_repository', { pathId: repo.id });
      removeRepo(repo.id);
      setIsArchiveConfirmOpen(false);
      onClose();
    } catch (error) {
      console.error('Failed to archive repository:', error);
      addToast({
        variant: 'error',
        title: 'Archive failed',
        message: `Could not archive ${repo.display_name} from the workspace.`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="repository-view-actions-picker" ref={containerRef}>
      <button
        type="button"
        className="repository-view-actions-trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Repository actions"
        title="Repository actions"
        disabled={isBusy}
      >
        <SlidersHorizontal size={14} weight="bold" />
        <span>Actions</span>
        {isOpen ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
      </button>

      {isOpen ? (
        <div className="repository-view-actions-menu" role="menu" aria-label="Repository actions">
          <div className="repository-view-action-section">
            <div className="repository-view-action-section-title">Git Operations</div>
            <ActionMenuItem
              icon={<ArrowClockwise size={14} />}
              label="Refresh status"
              onSelect={handleRefreshGitStatus}
              disabled={isBusy}
            />
            <ActionMenuItem
              icon={<ArrowClockwise size={14} />}
              label="Fetch origin"
              onSelect={() => executeGitOperation('fetch')}
              disabled={isBusy}
            />
            {canUseRemoteActions ? (
              <>
                <ActionMenuItem
                  icon={<ArrowDown size={14} />}
                  label="Pull upstream"
                  onSelect={() => executeGitOperation('pull')}
                  disabled={isBusy}
                />
                <ActionMenuItem
                  icon={<ArrowUp size={14} />}
                  label="Push changes"
                  onSelect={() => executeGitOperation('push')}
                  disabled={isBusy}
                />
              </>
            ) : null}
          </div>

          <div className="repository-view-action-divider" />

          <div className="repository-view-action-section">
            <ActionMenuItem
              icon={<FolderOpen size={14} />}
              label="Open in File Explorer"
              onSelect={() => handleNativeAction(repositoryOpenActions.openFileExplorer)}
              disabled={isBusy || isMissing}
              title={isMissing ? 'Repository path is unavailable' : undefined}
            />
            <ActionMenuItem
              icon={<Terminal size={14} />}
              label="Open in terminal"
              onSelect={() => handleNativeAction(repositoryOpenActions.openTerminal)}
              disabled={isBusy || isMissing}
              title={isMissing ? 'Repository path is unavailable' : undefined}
            />
            <ActionMenuItem
              icon={<Desktop size={14} />}
              label="Open in default editor"
              onSelect={() => handleNativeAction(repositoryOpenActions.openDefaultApplication)}
              disabled={isBusy || isMissing}
              title={isMissing ? 'Repository path is unavailable' : undefined}
            />
            <ActionMenuItem
              icon={<PencilSimple size={14} />}
              label="Open with..."
              onSelect={() => {
                closeMenu();
                repositoryOpenActions.openWith();
              }}
              disabled={isBusy || isMissing}
              title={isMissing ? 'Repository path is unavailable' : undefined}
            />
          </div>

          <div className="repository-view-action-divider" />

          <div className="repository-view-action-section">
            <div className="repository-view-action-section-title">Workspace Management</div>
            <ActionMenuItem
              icon={<PencilSimple size={14} />}
              label="Rename alias"
              onSelect={handleRenameAliasClick}
              disabled={isBusy}
            />
            <ActionMenuItem
              icon={<Star size={14} weight={isFavorite ? 'fill' : 'regular'} />}
              label={isFavorite ? 'Remove favorite' : 'Add favorite'}
              onSelect={handleToggleFavorite}
              disabled={isBusy}
            />
            <ActionMenuItem
              icon={<MagnifyingGlass size={14} />}
              label="Validate repository"
              onSelect={() => void handleValidateRepository()}
              disabled={isBusy}
            />
            <ActionMenuItem
              icon={<PushPin size={14} weight={isPinned ? 'fill' : 'regular'} />}
              label={isPinned ? 'Unpin repository' : 'Pin repository'}
              onSelect={handleTogglePinned}
              disabled={isBusy}
            />
          </div>

          <div className="repository-view-action-divider" />

          <div className="repository-view-action-section">
            <ActionMenuItem
              icon={<PencilSimple size={14} />}
              label="Edit theme"
              onSelect={handleEditThemeClick}
            />
          </div>

          <div className="repository-view-action-divider" />

          <div className="repository-view-action-section">
            <ActionMenuItem
              icon={<Trash size={14} />}
              label="Archive repository"
              onSelect={handleArchiveClick}
              disabled={isBusy}
              danger
            />
          </div>
        </div>
      ) : null}

      <TextInputModal
        isOpen={isRenameModalOpen}
        title="Rename alias"
        description={`Set a display alias for ${repo.display_name}.`}
        inputLabel="Alias"
        inputValue={repo.alias_name ?? ''}
        placeholder={repo.display_name}
        confirmLabel="Save alias"
        cancelLabel="Cancel"
        resetLabel={repo.alias_name ? 'Clear alias' : undefined}
        isBusy={isBusy}
        onConfirm={(value) => void handleAliasSave(value)}
        onCancel={() => setIsRenameModalOpen(false)}
        onReset={repo.alias_name ? () => void handleAliasClear() : undefined}
      />

      <RepoThemeModal
        isOpen={isThemeModalOpen}
        isBusy={isBusy}
        currentThemeColor={repo.theme_color_hex ?? null}
        currentIconName={repo.icon_name ?? null}
        onClose={() => setIsThemeModalOpen(false)}
        onThemeChange={handleThemeChange}
      />

      <ConfirmationModal
        isOpen={isArchiveConfirmOpen}
        title="Archive repository"
        message={
          <>
            This will archive the repository from your workspace. You can restore it later.
          </>
        }
        confirmLabel="Archive"
        cancelLabel="Cancel"
        variant="danger"
        isBusy={isBusy}
        onConfirm={() => void handleArchiveConfirm()}
        onCancel={() => setIsArchiveConfirmOpen(false)}
      />

      <OpenWithModal
        isOpen={repositoryOpenActions.isOpenWithOpen}
        repositoryPath={repo.absolute_path}
        onClose={repositoryOpenActions.closeOpenWith}
        onError={(message) => addToast({ variant: 'error', title: 'Repository action failed', message })}
        detectEditors={repositoryOpenActions.detectEditors}
      />
    </div>
  );
}
