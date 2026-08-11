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
  const setCanvasViewScope = useCanvasStore((state) => state.setCanvasViewScope);

  const [repositories, setRepositories] = useState<WorkspaceScopeRecord[]>([]);
  const [expandedRepositories, setExpandedRepositories] = useState<Record<string, boolean>>({});
  const [repositoryVisibility, setRepositoryVisibility] = useState<Record<string, boolean>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string[]>>({});
  const [savingRepositories, setSavingRepositories] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | null>(null);
  const scopeRequestRef = useRef(0);
  const scopeSnapshotRef = useRef({
    pathVisibility: {} as Record<string, boolean>,
    branchVisibility: {} as Record<string, boolean>,
  });
  const scopeVersionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const hydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const editorViewIdRef = useRef(viewId);

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
    scopeSnapshotRef.current = {
      pathVisibility: nextRepositoryVisibility,
      branchVisibility: Object.fromEntries(
        workspaceRows.flatMap((repository) => (repository.available_branches ?? []).map((branchName) => [
          `${repository.id}::${branchName}`,
          branchVisibility[`${repository.id}::${branchName}`] !== false,
        ])),
      ),
    };
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
    isMountedRef.current = true;
    editorViewIdRef.current = viewId;
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
      if (editorViewIdRef.current === viewId) isMountedRef.current = false;
      scopeRequestRef.current += 1;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (hydrationTimerRef.current) clearTimeout(hydrationTimerRef.current);
      if (saveCompleteTimerRef.current) clearTimeout(saveCompleteTimerRef.current);
    };
  }, [viewId]);

  const scheduleHydration = () => {
    if (hydrationTimerRef.current) clearTimeout(hydrationTimerRef.current);
    hydrationTimerRef.current = setTimeout(() => {
      hydrationTimerRef.current = null;
      void useCanvasStore.getState().hydrateWorkspaceNodes();
    }, 180);
  };

  const scheduleSave = (delay = 180) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void processSave();
    }, delay);
  };

  const processSave = async () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    saveQueuedRef.current = false;
    const version = scopeVersionRef.current;
    const snapshot = scopeSnapshotRef.current;
    const requestId = scopeRequestRef.current;
    const isCurrentEditor = () => isMountedRef.current && editorViewIdRef.current === viewId;

    try {
      const scopeState = await setCanvasViewScope(
        viewId,
        snapshot.pathVisibility,
        snapshot.branchVisibility,
        { hydrate: false },
      );

      if (version !== scopeVersionRef.current || requestId !== scopeRequestRef.current) {
        if (isCurrentEditor()) scheduleSave(0);
        return;
      }

      if (scopeState) {
        applyScopeState(repositories, scopeState);
        if (isCurrentEditor()) {
          setSaveError(null);
          setSaveStatus('saved');
          if (saveCompleteTimerRef.current) clearTimeout(saveCompleteTimerRef.current);
          saveCompleteTimerRef.current = setTimeout(() => {
            saveCompleteTimerRef.current = null;
            if (isCurrentEditor()) setSaveStatus(null);
          }, 800);
        }
        scheduleHydration();
      } else {
        if (isCurrentEditor()) {
          setSaveError('Unable to save the view selection. Reloading the saved selection.');
        }
        await hydrateScope(requestId);
      }
    } finally {
      saveInFlightRef.current = false;
      if (isCurrentEditor() && version === scopeVersionRef.current && requestId === scopeRequestRef.current) {
        setSavingRepositories({});
      } else if (isCurrentEditor() && (saveQueuedRef.current || version !== scopeVersionRef.current)) {
        scheduleSave(0);
      }
    }
  };

  const updateRepositoryScope = (
    repository: WorkspaceScopeRecord,
    visible: boolean,
    nextBranches: string[],
  ) => {
    scopeRequestRef.current += 1;
    scopeVersionRef.current += 1;
    const normalizedBranches = normalizeSelectedBranches(repository, nextBranches);
    const branchVisibility = { ...scopeSnapshotRef.current.branchVisibility };
    for (const branchName of repository.available_branches ?? []) {
      branchVisibility[`${repository.id}::${branchName}`] = normalizedBranches.includes(branchName);
    }

    scopeSnapshotRef.current = {
      pathVisibility: {
        ...scopeSnapshotRef.current.pathVisibility,
        [repository.id]: visible,
      },
      branchVisibility,
    };

    setSaveError(null);
    setSaveStatus('saving');
    if (saveCompleteTimerRef.current) clearTimeout(saveCompleteTimerRef.current);
    setRepositoryVisibility((current) => ({ ...current, [repository.id]: visible }));
    setSelectedBranches((current) => ({ ...current, [repository.id]: normalizedBranches }));
    setSavingRepositories((current) => ({ ...current, [repository.id]: true }));
    scheduleSave();
  };

  const handleRepositoryChange = (repositoryId: string, checked: boolean) => {
    const repository = repositories.find((entry) => entry.id === repositoryId);
    if (!repository) return;

    updateRepositoryScope(
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

    updateRepositoryScope(repository, visible, nextBranches);
  };

  const updateAllRepositories = (visible: boolean) => {
    scopeRequestRef.current += 1;
    scopeVersionRef.current += 1;
    const nextPathVisibility = Object.fromEntries(
      repositories.map((repository) => [repository.id, visible]),
    );
    const nextBranchVisibility = Object.fromEntries(
      repositories.flatMap((repository) => (
        repository.available_branches ?? []
      ).map((branchName) => [`${repository.id}::${branchName}`, visible])),
    );
    const nextSelectedBranches = Object.fromEntries(
      repositories.map((repository) => [
        repository.id,
        visible ? [...(repository.available_branches ?? [])] : [],
      ]),
    );

    scopeSnapshotRef.current = {
      pathVisibility: nextPathVisibility,
      branchVisibility: nextBranchVisibility,
    };
    setSaveError(null);
    setSaveStatus('saving');
    if (saveCompleteTimerRef.current) clearTimeout(saveCompleteTimerRef.current);
    setRepositoryVisibility(nextPathVisibility);
    setSelectedBranches(nextSelectedBranches);
    setSavingRepositories(Object.fromEntries(repositories.map((repository) => [repository.id, true])));
    scheduleSave();
  };

  return (
    <RepositoryScopeSelector
      repositories={repositories}
      repositoryVisibility={repositoryVisibility}
      selectedBranches={selectedBranches}
      expandedRepositories={expandedRepositories}
      savingRepositories={savingRepositories}
      saveStatus={saveStatus}
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
      bulkActionsDisabled={false}
      saveError={saveError}
      scrollableList
      emptyMessage="No tracked repositories are available yet."
    />
  );
}
