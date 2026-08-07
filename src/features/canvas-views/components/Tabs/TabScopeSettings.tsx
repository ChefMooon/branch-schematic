import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasStore, type CanvasViewScopeState } from '../../../../stores/canvas-store';
import { RepositoryScopeSelector } from '../RepositoryScopeSelector';
import {
  getRepositoryBranchSelection,
  normalizeSelectedBranches,
  normalizeWorkspaceScopeRecords,
  type RawWorkspaceScopeRecord,
  type WorkspaceScopeRecord,
} from '../scopeSelection';
import '../canvasViews.css';

type TabScopeSettingsProps = {
  viewId: string;
};

export function TabScopeSettings({ viewId }: TabScopeSettingsProps) {
  const setRepositoryScope = useCanvasStore((state) => state.setRepositoryScope);
  const setCanvasViewScope = useCanvasStore((state) => state.setCanvasViewScope);

  const [repositories, setRepositories] = useState<WorkspaceScopeRecord[]>([]);
  const [expandedRepositories, setExpandedRepositories] = useState<Record<string, boolean>>({});
  const [repositoryVisibility, setRepositoryVisibility] = useState<Record<string, boolean>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string[]>>({});
  const [busyRepositories, setBusyRepositories] = useState<Record<string, boolean>>({});
  const scopeRequestRef = useRef(0);

  const applyScopeState = (workspaceRows: WorkspaceScopeRecord[], scopeState: CanvasViewScopeState) => {
    const visiblePaths = new Set(scopeState.visible_path_ids ?? []);
    const hiddenPaths = new Set(scopeState.hidden_path_ids ?? []);
    const branchVisibility = scopeState.branch_visibility ?? {};
    const nextRepositoryVisibility: Record<string, boolean> = {};
    const nextSelectedBranches: Record<string, string[]> = {};

    for (const repository of workspaceRows) {
      nextRepositoryVisibility[repository.id] = visiblePaths.has(repository.id) && !hiddenPaths.has(repository.id);
      nextSelectedBranches[repository.id] = (repository.available_branches ?? []).filter(
        (branchName) => branchVisibility[`${repository.id}::${branchName}`] !== false,
      );
    }

    setRepositoryVisibility(nextRepositoryVisibility);
    setSelectedBranches(nextSelectedBranches);
  };

  const hydrateScope = async (requestId = scopeRequestRef.current) => {
    const [workspaceRows, scopeState] = await Promise.all([
      invoke<RawWorkspaceScopeRecord[]>('get_tracked_workspaces').then(normalizeWorkspaceScopeRecords),
      invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId }),
    ]);

    if (requestId !== scopeRequestRef.current) return;

    const orderedRows = [...workspaceRows].sort((left, right) => {
      const leftLabel = left.alias_name || left.display_name;
      const rightLabel = right.alias_name || right.display_name;
      return leftLabel.localeCompare(rightLabel);
    });

    setRepositories(orderedRows);
    applyScopeState(orderedRows, scopeState);
    setExpandedRepositories((current) => {
      const next = { ...current };
      for (const repository of orderedRows) {
        if (!(repository.id in next)) next[repository.id] = false;
      }
      return next;
    });
  };

  useEffect(() => {
    let isCancelled = false;
    const requestId = ++scopeRequestRef.current;

    void hydrateScope(requestId).catch((error) => {
      if (isCancelled) return;
      console.error('Failed to hydrate canvas view scope state:', error);
      setRepositories([]);
      setRepositoryVisibility({});
      setSelectedBranches({});
    });

    return () => {
      isCancelled = true;
    };
  }, [viewId]);

  const updateRepositoryScope = async (
    repository: WorkspaceScopeRecord,
    visible: boolean,
    nextBranches: string[],
  ) => {
    const requestId = ++scopeRequestRef.current;
    const normalizedBranches = normalizeSelectedBranches(repository, nextBranches);
    const branchVisibility = Object.fromEntries(
      (repository.available_branches ?? []).map((branchName) => [
        `${repository.id}::${branchName}`,
        normalizedBranches.includes(branchName),
      ]),
    );

    setRepositoryVisibility((current) => ({ ...current, [repository.id]: visible }));
    setSelectedBranches((current) => ({ ...current, [repository.id]: normalizedBranches }));
    setBusyRepositories((current) => ({ ...current, [repository.id]: true }));

    try {
      const scopeState = await setRepositoryScope(viewId, repository.id, visible, branchVisibility);
      if (scopeState && requestId === scopeRequestRef.current) {
        applyScopeState(repositories, scopeState);
      } else if (!scopeState && requestId === scopeRequestRef.current) {
        await hydrateScope(requestId);
      }
    } finally {
      setBusyRepositories((current) => ({ ...current, [repository.id]: false }));
    }
  };

  const handleRepositoryChange = (repositoryId: string, checked: boolean) => {
    const repository = repositories.find((entry) => entry.id === repositoryId);
    if (!repository) return;

    void updateRepositoryScope(
      repository,
      checked,
      getRepositoryBranchSelection(repository, checked),
    );
  };

  const handleBranchChange = (repositoryId: string, branchName: string, checked: boolean) => {
    const repository = repositories.find((entry) => entry.id === repositoryId);
    if (!repository) return;

    const currentBranches = normalizeSelectedBranches(repository, selectedBranches[repositoryId] ?? []);
    const nextBranches = checked
      ? [...currentBranches, branchName]
      : currentBranches.filter((entry) => entry !== branchName);
    const visible = (repository.available_branches ?? []).length === 0
      ? repositoryVisibility[repositoryId] === true
      : nextBranches.length > 0;

    void updateRepositoryScope(repository, visible, nextBranches);
  };

  const updateAllRepositories = async (visible: boolean) => {
    const nextPathVisibility = Object.fromEntries(
      repositories.map((repository) => [repository.id, visible]),
    );
    const nextBranchVisibility = Object.fromEntries(
      repositories.flatMap((repository) => (
        repository.available_branches ?? []
      ).map((branchName) => [`${repository.id}::${branchName}`, visible])),
    );
    const busyState = Object.fromEntries(repositories.map((repository) => [repository.id, true]));
    const nextSelectedBranches = Object.fromEntries(
      repositories.map((repository) => [
        repository.id,
        visible ? [...(repository.available_branches ?? [])] : [],
      ]),
    );

    setRepositoryVisibility(Object.fromEntries(repositories.map((repository) => [repository.id, visible])));
    setSelectedBranches(nextSelectedBranches);
    setBusyRepositories(busyState);
    try {
      const scopeState = await setCanvasViewScope(
        viewId,
        nextPathVisibility,
        nextBranchVisibility,
      );
      if (scopeState) {
        applyScopeState(repositories, scopeState);
      } else {
        await hydrateScope();
      }
    } finally {
      setBusyRepositories({});
    }
  };

  return (
    <RepositoryScopeSelector
      repositories={repositories}
      repositoryVisibility={repositoryVisibility}
      selectedBranches={selectedBranches}
      expandedRepositories={expandedRepositories}
      busyRepositories={busyRepositories}
      onToggleRepository={handleRepositoryChange}
      onToggleBranch={handleBranchChange}
      onToggleExpansion={(repositoryId) => {
        setExpandedRepositories((current) => ({
          ...current,
          [repositoryId]: !current[repositoryId],
        }));
      }}
      onSelectAll={() => { void updateAllRepositories(true); }}
      onClearAll={() => { void updateAllRepositories(false); }}
      bulkActionsDisabled={Object.values(busyRepositories).some(Boolean)}
      scrollableList
      emptyMessage="No tracked repositories are available yet."
    />
  );
}
