import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasStore } from './canvas-store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('canvas store hydration', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useCanvasStore.setState({
      views: [],
      archivedViews: [],
      activeViewId: null,
      isBranchMapActive: false,
      isViewHydrating: false,
      sessionViewportByViewId: {},
      openedViewIds: {},
      nodes: [],
      edges: [],
      activeTagFilters: [],
      canUndoSavedCardLocationRestore: false,
      savedCardLocationUndo: null,
    });
  });

  it('hydrates viewport, persisted nodes, branch sync data, topology, and manual edges', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'get_canvas_views') {
        return [{
          view_id: 'view-1',
          view_name: 'Release View',
          zoom_level: 1.25,
          pan_x: 80,
          pan_y: -40,
          is_favorite: 1,
          display_order: 0,
        }];
      }

      if (command === 'get_active_tracked_paths') {
        return [{ id: 'repo-1', absolute_path: 'C:/repos/repo-1' }];
      }

      if (command === 'get_workspace_nodes') {
        return [
          {
            repo_path_id: 'repo-1',
            display_name: 'Release Repo',
            explode_branches: 1,
            is_explicit_branch: 1,
            branch_id: 'branch-main',
            branch_name: 'main',
            is_head: 1,
            ahead_count: 2,
            behind_count: 0,
            last_commit_hash: 'main-hash',
            pos_x: 120,
            pos_y: 240,
            view_mode: 'EXPANDED',
            commit_density: 4,
            theme_color_hex: '#123456',
            tags_json: '[]',
          },
          {
            repo_path_id: 'repo-1',
            display_name: 'Release Repo',
            explode_branches: 1,
            is_explicit_branch: 1,
            branch_id: 'branch-feature',
            branch_name: 'feature',
            is_head: 0,
            ahead_count: 1,
            behind_count: 3,
            last_commit_hash: 'feature-hash',
            pos_x: 520,
            pos_y: 240,
            view_mode: 'EXPANDED',
            commit_density: 2,
            theme_color_hex: '#123456',
            tags_json: '[]',
          },
        ];
      }

      if (command === 'determine_branch_topology') {
        return {
          source_branch: 'main',
          target_branch: 'feature',
          common_ancestor: 'base-hash',
          distance_from_ancestor: 1,
        };
      }

      if (command === 'get_manual_edges') {
        return [{
          id: 'edge-node-directed::repo-1__main::repo-1__feature',
          source_repo_id: 'repo-1',
          target_repo_id: 'repo-1',
          edge_style: 'solid',
        }];
      }

      return undefined;
    });

    await useCanvasStore.getState().hydrateViewsList();
    await useCanvasStore.getState().setBranchMapActive(true);
    await useCanvasStore.getState().setActiveView('view-1');

    const state = useCanvasStore.getState();
    expect(state.sessionViewportByViewId['view-1']).toEqual({ zoom: 1.25, x: 80, y: -40 });
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0]).toMatchObject({
      id: 'repo-1__main',
      position: { x: 120, y: 240 },
      data: { branchId: 'branch-main', aheadCount: 2, behindCount: 0 },
    });
    expect(state.nodes[1]).toMatchObject({
      id: 'repo-1__feature',
      position: { x: 520, y: 240 },
      data: { branchId: 'branch-feature', aheadCount: 1, behindCount: 3 },
    });
    expect(state.edges.map((edge) => edge.id)).toEqual(expect.arrayContaining([
      'topo-repo-1__main-repo-1__feature',
      'edge-node-directed::repo-1__main::repo-1__feature',
    ]));
    expect(invoke).toHaveBeenCalledWith('set_branch_map_visible_repositories_command', {
      repositoryIds: ['repo-1'],
    });
  });
});