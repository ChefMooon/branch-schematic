import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { RepositoryScopeSelector } from './RepositoryScopeSelector';
import { getRepositoryBranchSelection, type WorkspaceScopeRecord } from './scopeSelection';
import { Button } from '../../../components/button/Button';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import './canvasViews.css';

type CreateViewModalProps = {
  isDark?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (options: {
    name: string;
    isFavorite: boolean;
    viewportDefaults: {
      zoomLevel: number;
      panX: number;
      panY: number;
    };
    scope?: {
      visiblePathIds?: string[];
      branchVisibility?: Record<string, string[]>;
    };
  }) => Promise<void> | void;
};

export function CreateViewModal({
  isDark = false,
  isOpen,
  onClose,
  onCreate,
}: CreateViewModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [repositories, setRepositories] = useState<WorkspaceScopeRecord[]>([]);
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [selectedBranchNames, setSelectedBranchNames] = useState<Record<string, string[]>>({});
  const [defaultZoom, setDefaultZoom] = useState(1);
  const [defaultPanX, setDefaultPanX] = useState(0);
  const [defaultPanY, setDefaultPanY] = useState(0);
  const backdropDismiss = useBackdropDismiss(dialogRef, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setIsFavorite(false);
    setSelectedPathIds([]);
    setSelectedBranchNames({});
    setExpandedRepos({});
    setDefaultZoom(1);
    setDefaultPanX(0);
    setDefaultPanY(0);

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    let isCancelled = false;

    const hydrateScope = async () => {
      try {
        const rows = await invoke<WorkspaceScopeRecord[]>('get_tracked_workspaces');
        if (isCancelled) return;

        const orderedRows = [...rows].sort((left, right) => {
          const leftLabel = left.alias_name || left.display_name;
          const rightLabel = right.alias_name || right.display_name;
          return leftLabel.localeCompare(rightLabel);
        });

        const nextPathIds = orderedRows.map((repo) => repo.id);
        const nextBranchSelection = Object.fromEntries(
          orderedRows.map((repo) => [repo.id, [...(repo.available_branches ?? [])]]),
        );

        setRepositories(orderedRows);
        setSelectedPathIds(nextPathIds);
        setSelectedBranchNames(nextBranchSelection);
        setExpandedRepos(Object.fromEntries(orderedRows.map((repo) => [repo.id, false])));
      } catch (error) {
        console.error('Failed to load tracked workspaces for create view modal:', error);
      }
    };

    void hydrateScope();

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      isCancelled = true;
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;
  const repositoryVisibility = Object.fromEntries(
    repositories.map((repository) => [repository.id, selectedPathIds.includes(repository.id)]),
  );

  const handleSelectAll = () => {
    if (repositories.length === 0) return;

    const nextPathIds = repositories.map((repo) => repo.id);
    const nextBranchSelection = Object.fromEntries(
      repositories.map((repo) => [repo.id, [...(repo.available_branches ?? [])]]),
    );

    setSelectedPathIds(nextPathIds);
    setSelectedBranchNames(nextBranchSelection);
  };

  const handleClearAll = () => {
    setSelectedPathIds([]);
    setSelectedBranchNames({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isNameValid) return;

    await onCreate({
      name: trimmedName,
      isFavorite,
      viewportDefaults: {
        zoomLevel: defaultZoom,
        panX: defaultPanX,
        panY: defaultPanY,
      },
      scope: {
        visiblePathIds: selectedPathIds,
        branchVisibility: selectedBranchNames,
      },
    });

    onClose();
  };

  const toggleRepoSelection = (repoId: string, checked: boolean) => {
    const repository = repositories.find((entry) => entry.id === repoId);
    if (!repository) return;

    setSelectedPathIds((current) => (
      checked
        ? [...new Set([...current, repoId])]
        : current.filter((id) => id !== repoId)
    ));
    setSelectedBranchNames((current) => ({
      ...current,
      [repoId]: getRepositoryBranchSelection(repository, checked),
    }));
  };

  const toggleBranchSelection = (repoId: string, branchName: string, checked: boolean) => {
    const existing = selectedBranchNames[repoId] ?? [];
    const next = checked
      ? [...new Set([...existing, branchName])]
      : existing.filter((nameEntry) => nameEntry !== branchName);

    setSelectedBranchNames((current) => ({
      ...current,
      [repoId]: next,
    }));
    setSelectedPathIds((current) => (
      next.length > 0
        ? [...new Set([...current, repoId])]
        : current.filter((id) => id !== repoId)
    ));
  };

  if (!isOpen) return null;

  return (
    <div
      className="canvas-create-view-overlay"
      onMouseDown={backdropDismiss.handleMouseDown}
      onMouseUp={backdropDismiss.handleMouseUp}
      onMouseLeave={backdropDismiss.handleMouseLeave}
      onTouchStart={backdropDismiss.handleTouchStart}
      onTouchEnd={backdropDismiss.handleTouchEnd}
    >
      <div
        ref={dialogRef}
        className="canvas-create-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-view-modal-title"
        data-theme-mode={isDark ? 'dark' : 'light'}
      >
        <header className="canvas-create-view-modal__header">
          <div>
            <p className="canvas-view-manager__eyebrow">Canvas environments</p>
            <h2 className="canvas-create-view-modal__title" id="create-view-modal-title">Create view</h2>
            <p className="canvas-create-view-modal__description">
              Add a saved canvas environment with its own starting viewport and repository scope.
            </p>
          </div>
          <Button type="button" variant="close" onClick={onClose} aria-label="Close create view modal" title="Close">
            <X size={16} weight="bold" />
          </Button>
        </header>

        <form className="canvas-create-view-modal__form" onSubmit={handleSubmit}>
          <div className="canvas-create-view-modal__content">
            <label className="canvas-view-manager__field">
              <span>View name</span>
              <input
                ref={inputRef}
                className="canvas-view-manager__input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My new view"
                maxLength={100}
              />
              {!isNameValid && name.length > 0 && (
                <span className="canvas-view-manager__error" role="alert">A view name is required.</span>
              )}
            </label>

            <section className="canvas-view-manager__panel">
              <div className="canvas-view-manager__panel-heading">
                <h3 className="canvas-view-manager__panel-title">Default viewport</h3>
                <p className="canvas-view-manager__panel-description">
                  Set the starting zoom and pan values for the new view.
                </p>
              </div>
              <div className="canvas-view-manager__viewport-grid">
                <NumericField label="Zoom" value={defaultZoom} onChange={setDefaultZoom} step="0.01" />
                <NumericField label="Pan X" value={defaultPanX} onChange={setDefaultPanX} step="0.01" />
                <NumericField label="Pan Y" value={defaultPanY} onChange={setDefaultPanY} step="0.01" />
              </div>
            </section>

            <label className="canvas-create-view-modal__favorite">
              <span>Favorite view</span>
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(event) => setIsFavorite(event.target.checked)}
              />
            </label>

            <RepositoryScopeSelector
              repositories={repositories}
              repositoryVisibility={repositoryVisibility}
              selectedBranches={selectedBranchNames}
              expandedRepositories={expandedRepos}
              onToggleRepository={toggleRepoSelection}
              onToggleBranch={toggleBranchSelection}
              onToggleExpansion={(repoId) => {
                setExpandedRepos((current) => ({ ...current, [repoId]: !current[repoId] }));
              }}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
              emptyMessage="No tracked repositories are available yet."
            />
          </div>

          <footer className="canvas-create-view-modal__footer">
            <Button type="button" variant="basic" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isNameValid} variant="submit">
              Create view
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
};

function NumericField({ label, value, onChange, step = '1' }: NumericFieldProps) {
  return (
    <label className="canvas-view-manager__field">
      <span>{label}</span>
      <input
        className="canvas-view-manager__input"
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
