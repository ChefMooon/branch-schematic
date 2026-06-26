import { useEffect, useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import type { CanvasViewScopeState } from '../../../../stores/canvas-store';
import { useCanvasStore } from '../../../../stores/canvas-store';

type WorkspaceScopeRecord = {
  id: string;
  display_name: string;
  alias_name?: string | null;
  available_branches: string[];
};

type TabScopeSettingsProps = {
  isDark: boolean;
  viewId: string;
};

export function TabScopeSettings({ isDark, viewId }: TabScopeSettingsProps) {
  const togglePathVisibility = useCanvasStore((state) => state.togglePathVisibility);
  const toggleBranchVisibility = useCanvasStore((state) => state.toggleBranchVisibility);

  const [repositories, setRepositories] = useState<WorkspaceScopeRecord[]>([]);
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [pathVisibility, setPathVisibility] = useState<Record<string, boolean>>({});
  const [branchVisibility, setBranchVisibility] = useState<Record<string, boolean>>({});
  const [branchIdMap, setBranchIdMap] = useState<Record<string, string>>({});

  const applyScopeState = (workspaceRows: WorkspaceScopeRecord[], scopeState: CanvasViewScopeState) => {
    const nextPathVisibility: Record<string, boolean> = {};
    const nextBranchVisibility: Record<string, boolean> = {};

    const visiblePaths = new Set(scopeState.visible_path_ids ?? []);
    const hiddenPaths = new Set(scopeState.hidden_path_ids ?? []);
    const strictBranchVisibility = scopeState.branch_visibility ?? {};

    for (const repo of workspaceRows) {
      nextPathVisibility[repo.id] = visiblePaths.has(repo.id) && !hiddenPaths.has(repo.id);

      for (const branchName of repo.available_branches ?? []) {
        const key = `${repo.id}::${branchName}`;
        nextBranchVisibility[key] = strictBranchVisibility[key] === true;
      }
    }

    setPathVisibility(nextPathVisibility);
    setBranchVisibility(nextBranchVisibility);
  };

  const hydrateScope = async () => {
    const [workspaceRows, scopeState, workspaceNodes] = await Promise.all([
      invoke<WorkspaceScopeRecord[]>('get_tracked_workspaces'),
      invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId }),
      invoke<Array<{ repo_path_id?: string; path_id?: string; branch_name: string; branch_id: string }>>('get_workspace_nodes', { viewId }),
    ]);

    const nextBranchIdMap: Record<string, string> = {};

    applyScopeState(workspaceRows, scopeState);

    for (const node of workspaceNodes) {
      const repoPathId = node.repo_path_id ?? node.path_id;
      if (!repoPathId || !node.branch_name || !node.branch_id) continue;
      nextBranchIdMap[`${repoPathId}::${node.branch_name}`] = node.branch_id;
    }

    setRepositories(workspaceRows);
    setBranchIdMap(nextBranchIdMap);
    setExpandedRepos((prev) => {
      const next = { ...prev };
      for (const repo of workspaceRows) {
        if (!(repo.id in next)) next[repo.id] = false;
      }
      return next;
    });
  };

  useEffect(() => {
    void hydrateScope().catch((error) => {
      console.error('Failed to hydrate strict canvas scope state:', error);
      setRepositories([]);
      setPathVisibility({});
      setBranchVisibility({});
      setBranchIdMap({});
    });
  }, [viewId]);

  const sortedRepositories = useMemo(
    () => [...repositories].sort((a, b) => (a.alias_name || a.display_name).localeCompare(b.alias_name || b.display_name)),
    [repositories],
  );

  const toggleRepoExpansion = (repoId: string) => {
    setExpandedRepos((prev) => ({ ...prev, [repoId]: !prev[repoId] }));
  };

  const handlePathVisibilityChange = async (repoId: string, checked: boolean) => {
    const scopeState = await togglePathVisibility(viewId, repoId, checked);
    if (!scopeState) {
      await hydrateScope();
      return;
    }

    applyScopeState(repositories, scopeState);
  };

  const handleBranchVisibilityChange = async (repoId: string, branchName: string, checked: boolean) => {
    const key = `${repoId}::${branchName}`;
    const branchId = branchIdMap[key] ?? key;
    const scopeState = await toggleBranchVisibility(viewId, branchId, checked);
    if (!scopeState) {
      await hydrateScope();
      return;
    }

    applyScopeState(repositories, scopeState);
  };

  return (
    <div
      style={{
        border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`,
        borderRadius: 10,
        background: isDark ? '#111111' : '#ffffff',
        minHeight: 260,
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      <div style={{ padding: 12, borderBottom: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}` }}>
        <h4 style={{ margin: 0, fontSize: 13, color: isDark ? '#f5f5f5' : '#0f172a' }}>Scope Selection</h4>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>
          Control visible repositories and explicit branch overrides for this view.
        </p>
      </div>

      <div style={{ padding: 10, display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
        {sortedRepositories.map((repo) => {
          const repoVisible = pathVisibility[repo.id] === true;
          const title = repo.alias_name || repo.display_name;
          const isExpanded = expandedRepos[repo.id] ?? false;

          return (
            <div
              key={repo.id}
              style={{
                border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`,
                borderRadius: 8,
                background: isDark ? '#0f0f10' : '#f8fafc',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <button
                  onClick={() => toggleRepoExpansion(repo.id)}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                  style={{ border: 'none', background: 'transparent', color: isDark ? '#d4d4d8' : '#475569', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, color: isDark ? '#f5f5f5' : '#0f172a', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={repoVisible}
                    onChange={(event) => void handlePathVisibilityChange(repo.id, event.target.checked)}
                  />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                </label>
              </div>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`, padding: '6px 10px 10px 28px', display: 'grid', gap: 6 }}>
                  {(repo.available_branches ?? []).length === 0 && (
                    <div style={{ fontSize: 11, color: isDark ? '#a3a3a3' : '#64748b' }}>No branches detected.</div>
                  )}

                  {(repo.available_branches ?? []).map((branchName) => {
                    const key = `${repo.id}::${branchName}`;
                    const visible = branchVisibility[key] === true;
                    return (
                      <label
                        key={key}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 12, color: isDark ? '#d4d4d8' : '#334155' }}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(event) => void handleBranchVisibilityChange(repo.id, branchName, event.target.checked)}
                        />
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branchName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
