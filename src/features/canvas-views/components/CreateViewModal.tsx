import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { RepositoryScopeRow } from './RepositoryScopeRow';

type WorkspaceScopeRecord = {
  id: string;
  display_name: string;
  alias_name?: string | null;
  available_branches: string[];
};

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
  const [name, setName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [repositories, setRepositories] = useState<WorkspaceScopeRecord[]>([]);
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [selectedBranchNames, setSelectedBranchNames] = useState<Record<string, string[]>>({});
  const [defaultZoom, setDefaultZoom] = useState(1);
  const [defaultPanX, setDefaultPanX] = useState(0);
  const [defaultPanY, setDefaultPanY] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

    return () => {
      isCancelled = true;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;
  const sortedRepositories = useMemo(
    () => [...repositories].sort((left, right) => {
      const leftLabel = left.alias_name || left.display_name;
      const rightLabel = right.alias_name || right.display_name;
      return leftLabel.localeCompare(rightLabel);
    }),
    [repositories],
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

    const nextScope = {
      visiblePathIds: selectedPathIds,
      branchVisibility: selectedBranchNames,
    };

    await onCreate({
      name: trimmedName,
      isFavorite,
      viewportDefaults: {
        zoomLevel: defaultZoom,
        panX: defaultPanX,
        panY: defaultPanY,
      },
      scope: nextScope,
    });

    onClose();
  };

  const toggleRepoSelection = (repoId: string, checked: boolean) => {
    setSelectedPathIds((current) => (checked ? [...current, repoId] : current.filter((id) => id !== repoId)));
  };

  const toggleBranchSelection = (repoId: string, branchName: string, checked: boolean) => {
    setSelectedBranchNames((current) => {
      const existing = current[repoId] ?? [];
      const next = checked
        ? [...existing, branchName]
        : existing.filter((name) => name !== branchName);

      return {
        ...current,
        [repoId]: next,
      };
    });
  };

  const toggleRepoExpansion = (repoId: string) => {
    setExpandedRepos((current) => ({
      ...current,
      [repoId]: !current[repoId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.54)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(460px, 92vw)',
          height: 'min(90vh, 820px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          overflow: 'hidden',
          border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
          background: isDark ? '#0d0d0f' : '#ffffff',
          boxShadow: '0 30px 70px -30px rgba(15, 23, 42, 0.65)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: isDark ? '#f5f5f5' : '#0f172a' }}>Create View</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>
              Add a new canvas view with optional favorites and viewport sync.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              border: 'none',
              background: 'transparent',
              color: isDark ? '#d4d4d8' : '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              width: 28,
              height: 28,
              borderRadius: 6,
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              padding: '12px 12px 0',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: 10,
                scrollPaddingBottom: 24,
                paddingRight: 4,
                paddingBottom: 24,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#f5f5f5' : '#0f172a' }}>Name</span>
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="My new view"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    border: `1px solid ${isDark ? '#404040' : '#cbd5e1'}`,
                    padding: '8px 10px',
                    fontSize: 13,
                    background: isDark ? '#111111' : '#ffffff',
                    color: isDark ? '#f5f5f5' : '#0f172a',
                  }}
                />
                {!isNameValid && name.length > 0 && (
                  <span style={{ fontSize: 12, color: '#ef4444' }}>Name is required.</span>
                )}
              </label>

              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
                  background: isDark ? '#111111' : '#f8fafc',
                  padding: 8,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#f5f5f5' : '#0f172a' }}>Default viewport</div>
                  <div style={{ fontSize: 11, color: isDark ? '#a3a3a3' : '#64748b' }}>
                    Set the starting zoom and pan values for the new view.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  <NumericField label="Zoom" value={defaultZoom} onChange={setDefaultZoom} isDark={isDark} step="0.01" />
                  <NumericField label="Pan X" value={defaultPanX} onChange={setDefaultPanX} isDark={isDark} step="0.01" />
                  <NumericField label="Pan Y" value={defaultPanY} onChange={setDefaultPanY} isDark={isDark} step="0.01" />
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
                  background: isDark ? '#111111' : '#f8fafc',
                }}
              >
                <span style={{ fontSize: 13, color: isDark ? '#f5f5f5' : '#0f172a' }}>Favorite view</span>
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(event) => setIsFavorite(event.target.checked)}
                />
              </label>

              <div
                style={{
                  border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
                  borderRadius: 10,
                  background: isDark ? '#111111' : '#f8fafc',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#f5f5f5' : '#0f172a' }}>Tracked projects & branches</div>
                    <div style={{ fontSize: 11, color: isDark ? '#a3a3a3' : '#64748b' }}>
                      Choose which repositories and branches should appear in the new view.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        border: `1px solid ${isDark ? '#404040' : '#cbd5e1'}`,
                        background: isDark ? '#1a1a1d' : '#ffffff',
                        color: isDark ? '#f5f5f5' : '#0f172a',
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        border: `1px solid ${isDark ? '#404040' : '#cbd5e1'}`,
                        background: isDark ? '#1a1a1d' : '#ffffff',
                        color: isDark ? '#f5f5f5' : '#0f172a',
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}>
                  {sortedRepositories.length === 0 && (
                    <div style={{ fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>No tracked projects available yet.</div>
                  )}

                  {sortedRepositories.map((repo) => (
                    <RepositoryScopeRow
                      key={repo.id}
                      repo={repo}
                      isDark={isDark}
                      repoSelected={selectedPathIds.includes(repo.id)}
                      isExpanded={expandedRepos[repo.id] ?? false}
                      selectedBranches={selectedBranchNames[repo.id] ?? []}
                      onToggleExpand={toggleRepoExpansion}
                      onToggleRepo={toggleRepoSelection}
                      onToggleBranch={toggleBranchSelection}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              flexShrink: 0,
              padding: '10px 12px 12px',
              borderTop: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
              background: isDark ? '#0d0d0f' : '#ffffff',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid ${isDark ? '#404040' : '#cbd5e1'}`,
                background: 'transparent',
                color: isDark ? '#f5f5f5' : '#0f172a',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isNameValid}
              style={{
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: isNameValid ? 'pointer' : 'not-allowed',
                opacity: isNameValid ? 1 : 0.65,
              }}
            >
              Create View
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type NumericFieldProps = {
  isDark: boolean;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
};

function NumericField({ isDark, label, value, onChange, step = '1' }: NumericFieldProps) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 12, color: isDark ? '#d4d4d8' : '#334155', minWidth: 0 }}>
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          borderRadius: 8,
          border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
          background: isDark ? '#0f0f10' : '#fff',
          color: isDark ? '#f5f5f5' : '#0f172a',
          padding: '8px 10px',
          fontSize: 12,
        }}
      />
    </label>
  );
}
