import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import {
  Edge,
  addEdge,
  type EdgeMouseHandler,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { BranchCardNode } from '../features/branch-map/components/BranchCard';
import type { RepoTag } from '../types/git';

export interface CanvasViewRecord {
  id: string;
  name: string;
  zoom_level: number;
  pan_x: number;
  pan_y: number;
  is_favorite: number;
  display_order: number;
  card_state_json?: string;
  baseline_zoom?: number;
  baseline_pan_x?: number;
  baseline_pan_y?: number;
}

export interface WorkspaceNodeRecord {
  repo_path_id?: string;
  path_id?: string;
  display_name?: string | null;
  explode_branches: number;
  branch_id: string;
  branch_name: string;
  is_head: number;
  ahead_count: number;
  behind_count: number;
  last_commit_hash: string;
  commit_message?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  view_mode: 'COMPACT' | 'EXPANDED';
  commit_density: number;
  theme_color_hex: string;
  group_theme_color_hex?: string | null;
  tags_json?: string | null;
}

function parseNodeTags(tagsJson: string | null | undefined): RepoTag[] {
  if (!tagsJson || typeof tagsJson !== 'string') return [];

  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RepoTag => {
      return Boolean(
        entry &&
          typeof entry.id === 'string' &&
          typeof entry.tag_name === 'string' &&
          typeof entry.color_hex === 'string'
      );
    });
  } catch {
    return [];
  }
}

export interface CanvasViewScopeState {
  visible_path_ids: string[];
  hidden_path_ids: string[];
  branch_visibility: Record<string, boolean>;
}

interface CanvasEdgeRecord {
  id: string;
  source_repo_id: string;
  target_repo_id: string;
  edge_style: string;
}

interface GitTopologyRelation {
  source_branch: string;
  target_branch: string;
  common_ancestor: string;
  distance_from_ancestor: number;
}

function buildManualEdgeId(nodeA: string, nodeB: string) {
  const left = encodeURIComponent(nodeA);
  const right = encodeURIComponent(nodeB);
  return `edge-node-directed::${left}::${right}`;
}

function parseManualEdgeNodePair(edgeId: string): [string, string] | null {
  const directedPrefix = 'edge-node-directed::';
  const legacyPrefix = 'edge-node::';
  const prefix = edgeId.startsWith(directedPrefix)
    ? directedPrefix
    : (edgeId.startsWith(legacyPrefix) ? legacyPrefix : null);
  if (!prefix) return null;

  const payload = edgeId.slice(prefix.length);
  const parts = payload.split('::');
  if (parts.length !== 2) return null;

  try {
    return [decodeURIComponent(parts[0]), decodeURIComponent(parts[1])];
  } catch {
    return null;
  }
}

interface CanvasState {
  views: CanvasViewRecord[];
  activeViewId: string | null;
  nodes: BranchCardNode[];
  edges: Edge[];
  activeTagFilters: string[];
  onNodesChange: OnNodesChange<BranchCardNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onEdgeClick: EdgeMouseHandler;
  setNodes: (nodes: BranchCardNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;
  setActiveView: (viewId: string) => Promise<void>;
  createNewView: (options: { name: string; isFavorite?: boolean; viewportDefaults?: { zoomLevel: number; panX: number; panY: number }; scope?: { visiblePathIds?: string[]; branchVisibility?: Record<string, string[]> } }) => Promise<void>;
  duplicateView: (sourceId: string, newName: string) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  renameView: (viewId: string, name: string) => Promise<void>;
  setViewFavorite: (viewId: string, favorite: boolean) => Promise<void>;
  moveViewOrder: (viewId: string, direction: -1 | 1) => Promise<void>;
  togglePathVisibility: (viewId: string, repoPathId: string, visible: boolean) => Promise<CanvasViewScopeState | null>;
  toggleBranchVisibility: (viewId: string, branchId: string, visible: boolean) => Promise<CanvasViewScopeState | null>;
  snapshotBaselineViewport: (viewId: string, zoom: number, x: number, y: number) => Promise<void>;
  saveCardState: (viewId: string, cardStateJson: string) => Promise<void>;
  hydrateViewsList: () => Promise<void>;
  hydrateWorkspaceNodes: () => Promise<void>;
  updateNodeConfig: (repoPathId: string, viewMode: 'COMPACT' | 'EXPANDED', density: number, hex: string, explodeBranches: boolean) => Promise<void>;
  removeManualEdge: (edgeId: string) => Promise<void>;
  saveViewport: (zoom: number, x: number, y: number) => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  views: [],
  activeViewId: null,
  nodes: [],
  edges: [],
  activeTagFilters: [],
  
  onNodesChange: (changes) => {
    // Explicitly process structural changes (like position updates from dragging) directly into store state
    set({ nodes: applyNodeChanges(changes, get().nodes) as BranchCardNode[] });
  },
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: async (connection) => {
    if (!connection.source || !connection.target) return;
    const viewId = get().activeViewId;
    if (!viewId) return;

    if (connection.source === connection.target) return;

    const sourceNode = get().nodes.find(n => n.id === connection.source);
    const targetNode = get().nodes.find(n => n.id === connection.target);
    const sourceRepoId = sourceNode?.data.repoPathId || connection.source;
    const targetRepoId = targetNode?.data.repoPathId || connection.target;
    const newEdgeId = buildManualEdgeId(connection.source, connection.target);
    const reverseEdgeId = buildManualEdgeId(connection.target, connection.source);

    const edgeIdExists = get().edges.some((edge) => edge.id === newEdgeId);
    const reverseEdgeIdExists = get().edges.some((edge) => edge.id === reverseEdgeId);
    if (edgeIdExists || reverseEdgeIdExists) return;

    const accentColor = sourceNode ? sourceNode.data.themeColorHex : '#4f46e5';

    const newEdge: Edge = {
      id: newEdgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      animated: true,
      data: { kind: 'manual' },
      style: { stroke: accentColor, strokeWidth: 2.5 },
    };

    set({ edges: addEdge(newEdge, get().edges) });

    try {
      await invoke('save_manual_edge', {
        viewId,
        id: newEdgeId,
        source: sourceRepoId,
        target: targetRepoId,
      });
    } catch (error) {
      console.error('Failed to save manual edge override:', error);
    }
  },

  onEdgeClick: (_event, edge) => {
    if (edge.id.startsWith('topo-')) return;
    void get().removeManualEdge(edge.id);
  },
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  toggleTagFilter: (tagId) => {
    const current = get().activeTagFilters;
    const nextFilters = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];

    set({
      activeTagFilters: nextFilters,
      nodes: get().nodes.map((node) => {
        const nodeTags = node.data.tags ?? [];
        const matches =
          nextFilters.length === 0 ||
          nodeTags.some((tag) => nextFilters.includes(tag.id));
        return {
          ...node,
          data: {
            ...node.data,
            isDimmedByTagFilter: !matches,
          },
        };
      }),
    });
  },

  clearTagFilters: () => {
    set({
      activeTagFilters: [],
      nodes: get().nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isDimmedByTagFilter: false,
        },
      })),
    });
  },

  hydrateViewsList: async () => {
    try {
      const rawBackendViews = await invoke<any[]>('get_canvas_views');
      
      const mappedViews: CanvasViewRecord[] = rawBackendViews.map((v) => ({
        id: v.view_id || v.id,
        name: v.view_name || v.name || "Unnamed View",
        zoom_level: v.zoom_level ?? 1.0,
        pan_x: v.pan_x ?? 0.0,
        pan_y: v.pan_y ?? 0.0,
        is_favorite: v.is_favorite ?? 0,
        display_order: v.display_order ?? 0,
        card_state_json: v.card_state_json ?? undefined,
        baseline_zoom: v.baseline_zoom ?? undefined,
        baseline_pan_x: v.baseline_pan_x ?? undefined,
        baseline_pan_y: v.baseline_pan_y ?? undefined,
      }));

      set({ views: mappedViews });
      if (mappedViews.length > 0 && !get().activeViewId) {
        set({ activeViewId: mappedViews[0].id });
      }
    } catch (error) {
      console.error('Failed to fetch views collection:', error);
    }
  },

  setActiveView: async (viewId) => {
    const targetView = get().views.find((view) => view.id === viewId);
    const hasBaseline =
      targetView?.baseline_zoom !== undefined &&
      targetView?.baseline_pan_x !== undefined &&
      targetView?.baseline_pan_y !== undefined;

    if (targetView && hasBaseline) {
      set({
        activeViewId: viewId,
        views: get().views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                zoom_level: targetView.baseline_zoom as number,
                pan_x: targetView.baseline_pan_x as number,
                pan_y: targetView.baseline_pan_y as number,
              }
            : view,
        ),
      });
    } else {
      set({ activeViewId: viewId });
    }

    await get().hydrateWorkspaceNodes();
  },

  createNewView: async ({ name, isFavorite = false, viewportDefaults, scope }) => {
    const viewId = `view-${crypto.randomUUID()}`;
    try {
      await invoke('create_canvas_view', {
        id: viewId,
        name,
        zoomLevel: viewportDefaults?.zoomLevel ?? 1,
        panX: viewportDefaults?.panX ?? 0,
        panY: viewportDefaults?.panY ?? 0,
      });

      if (scope?.visiblePathIds) {
        const scopeState = await invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId });
        const allPathIds = new Set([...scopeState.visible_path_ids, ...scopeState.hidden_path_ids]);
        const selectedPathIds = new Set(scope.visiblePathIds);

        for (const pathId of allPathIds) {
          await get().togglePathVisibility(viewId, pathId, selectedPathIds.has(pathId));
        }
      }

      if (scope?.branchVisibility) {
        const scopeState = await invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId });
        for (const [branchKey, isVisible] of Object.entries(scopeState.branch_visibility)) {
          const [repoId, branchName] = branchKey.split('::');
          const selectedBranchNames = scope.branchVisibility?.[repoId] ?? [];
          const shouldBeVisible = Boolean(repoId && branchName && selectedBranchNames.includes(branchName));
          if (isVisible !== shouldBeVisible) {
            await get().toggleBranchVisibility(viewId, branchKey, shouldBeVisible);
          }
        }
      }

      if (isFavorite) {
        await get().setViewFavorite(viewId, true);
      }

      await get().hydrateViewsList();
      await get().setActiveView(viewId);
    } catch (error) {
      console.error('Failed creating environment view setup:', error);
    }
  },

  duplicateView: async (sourceId, newName) => {
    const newId = `view-${crypto.randomUUID()}`;
    try {
      await invoke('clone_view', { sourceId, newId, newName });
      await get().hydrateViewsList();
      await get().setActiveView(newId);
    } catch (error) {
      console.error('Failed duplicating environment view:', error);
    }
  },

  deleteView: async (viewId) => {
    try {
      const existingViews = get().views;
      const deleteIndex = existingViews.findIndex((view) => view.id === viewId);
      const fallbackViewId = deleteIndex >= 0
        ? (existingViews[deleteIndex + 1]?.id || existingViews[deleteIndex - 1]?.id || null)
        : null;

      await invoke('delete_canvas_view', { viewId });

      if (get().activeViewId === viewId) {
        set({ activeViewId: null, nodes: [], edges: [] });
      }

      await get().hydrateViewsList();

      if (fallbackViewId && get().views.some((view) => view.id === fallbackViewId)) {
        await get().setActiveView(fallbackViewId);
      }
    } catch (error) {
      console.error('Failed deleting environment view:', error);
    }
  },

  renameView: async (viewId, name) => {
    try {
      await invoke('rename_canvas_view', { viewId, name });
      await get().hydrateViewsList();
    } catch (error) {
      console.error('Failed renaming environment view:', error);
    }
  },

  setViewFavorite: async (viewId, favorite) => {
    try {
      await invoke('set_canvas_view_favorite', {
        viewId,
        isFavorite: favorite,
      });
      await get().hydrateViewsList();
    } catch (error) {
      console.error('Failed setting view favorite state:', error);
    }
  },

  moveViewOrder: async (viewId, direction) => {
    try {
      await invoke('move_canvas_view_display_order', {
        viewId,
        direction,
      });
      await get().hydrateViewsList();
    } catch (error) {
      console.error('Failed moving view display order:', error);
    }
  },

  togglePathVisibility: async (viewId, repoPathId, visible) => {
    try {
      await invoke('set_canvas_view_path_visibility', { viewId, repoPathId, visible });
      const scope = await invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId });
      if (get().activeViewId === viewId) {
        await get().hydrateWorkspaceNodes();
      }
      return scope;
    } catch (error) {
      console.error('Failed updating path visibility state:', error);
      return null;
    }
  },

  toggleBranchVisibility: async (viewId, branchId, visible) => {
    try {
      await invoke('set_canvas_view_branch_visibility', { viewId, branchId, visible });
      const scope = await invoke<CanvasViewScopeState>('get_canvas_view_scope', { viewId });
      if (get().activeViewId === viewId) {
        await get().hydrateWorkspaceNodes();
      }
      return scope;
    } catch (error) {
      console.error('Failed updating branch visibility state:', error);
      return null;
    }
  },

  snapshotBaselineViewport: async (viewId, zoom, x, y) => {
    try {
      await invoke('snapshot_canvas_view_baseline_viewport', {
        viewId,
        baselineZoom: zoom,
        baselinePanX: x,
        baselinePanY: y,
      });

      set({
        views: get().views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                baseline_zoom: zoom,
                baseline_pan_x: x,
                baseline_pan_y: y,
              }
            : view,
        ),
      });
    } catch (error) {
      console.error('Failed to snapshot baseline viewport:', error);
    }
  },

  saveCardState: async (viewId, cardStateJson) => {
    try {
      await invoke('save_canvas_view_card_state', {
        viewId,
        cardStateJson,
      });

      set({
        views: get().views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                card_state_json: cardStateJson,
              }
            : view,
        ),
      });
    } catch (error) {
      console.error('Failed to save view card state payload:', error);
    }
  },
  
  hydrateWorkspaceNodes: async () => {
    const viewId = get().activeViewId;
    if (!viewId) return;

    try {
      const paths = await invoke<{ absolute_path: string }[]>('get_active_tracked_paths');
      let topology: GitTopologyRelation[] = [];
      
      if (paths && paths.length > 0) {
        try {
          topology = await invoke<GitTopologyRelation[]>('determine_branch_topology', {
            absolutePath: paths[0].absolute_path
          });
        } catch (e) {
          console.warn('Topology lookup skipped:', e);
        }
      }

      const dbNodes = await invoke<WorkspaceNodeRecord[]>('get_workspace_nodes', { viewId });
      const currentInMemoryNodes = get().nodes;
      const activeTagFilters = get().activeTagFilters;

      const getNodeRepoPathId = (record: WorkspaceNodeRecord) => record.repo_path_id || record.path_id || record.branch_id || '';
      const normalizeBranchName = (branchName: string) => branchName.replace('refs/heads/', '').trim();
      const repoGroups = new Map<string, WorkspaceNodeRecord[]>();

      dbNodes.forEach((record) => {
        const repoPathId = getNodeRepoPathId(record);
        const group = repoGroups.get(repoPathId);
        if (group) {
          group.push(record);
        } else {
          repoGroups.set(repoPathId, [record]);
        }
      });

      // Map backend database node definitions intelligently
      const formattedNodes: BranchCardNode[] = dbNodes.map((record, index) => {
        const repoPathId = getNodeRepoPathId(record);
        const normalizedBranchName = normalizeBranchName(record.branch_name);
        const nodeId = record.explode_branches === 1 && record.branch_name
          ? `${repoPathId}__${normalizedBranchName}`
          : repoPathId;

        const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(Math.max(dbNodes.length, 1)))));
        const colIndex = index % columns;
        const rowIndex = Math.floor(index / columns);
        const fallbackX = 160 + colIndex * 340;
        const fallbackY = 160 + rowIndex * 260;

        const storedX = record.pos_x ?? 0;
        const storedY = record.pos_y ?? 0;
        const hasStoredPosition = Number.isFinite(storedX) && Number.isFinite(storedY) &&
          !(Math.abs(storedX - 100) < 1e-6 && Math.abs(storedY - 100) < 1e-6);
        const isExplodedChildNode = record.explode_branches === 1 && nodeId !== repoPathId;
        const exactNodeMatch = currentInMemoryNodes.find((node) => node.id === nodeId);
        const repoAnchorMatch = isExplodedChildNode
          ? undefined
          : currentInMemoryNodes.find((node) => node.id === repoPathId || node.data.repoPathId === repoPathId);
        
        let finalX = fallbackX;
        let finalY = fallbackY;

        if (exactNodeMatch) {
          finalX = exactNodeMatch.position.x;
          finalY = exactNodeMatch.position.y;
        } else if (isExplodedChildNode) {
          if (hasStoredPosition) {
            // Persisted child coordinates should be restored exactly after app restart.
            finalX = storedX;
            finalY = storedY;
          } else {
          const group = repoGroups.get(repoPathId) ?? [];
          const sortedGroup = [...group].sort((a, b) => {
            if (a.is_head !== b.is_head) return b.is_head - a.is_head;
            return normalizeBranchName(a.branch_name).localeCompare(normalizeBranchName(b.branch_name));
          });
          const explodedChildren = sortedGroup.filter((entry) => entry.is_head !== 1);
          const childIndex = explodedChildren.findIndex((entry) => normalizeBranchName(entry.branch_name) === normalizedBranchName);

          const anchorX = (repoAnchorMatch?.position.x ?? (hasStoredPosition ? storedX : fallbackX));
          const anchorY = (repoAnchorMatch?.position.y ?? (hasStoredPosition ? storedY : fallbackY));

          if (childIndex >= 0) {
            const centerOffset = childIndex - (explodedChildren.length - 1) / 2;
            const lane = Math.floor(childIndex / 5);
            finalX = anchorX + 300 + lane * 180;
            finalY = anchorY + centerOffset * 120 + ((childIndex % 2 === 0) ? -24 : 24);
          } else {
            finalX = anchorX;
            finalY = anchorY;
          }
          }
        } else if (repoAnchorMatch) {
          finalX = repoAnchorMatch.position.x;
          finalY = repoAnchorMatch.position.y;
        } else if (hasStoredPosition) {
          finalX = storedX;
          finalY = storedY;
        }

        return {
          id: nodeId,
          type: 'branchCard',
          position: { x: finalX, y: finalY },
          draggable: true,
          selectable: true,
          data: {
            title: record.branch_name || getNodeRepoPathId(record) || 'Repository',
            repoPathId,
            repositoryName: record.display_name?.trim() || undefined,
            branchId: record.branch_id,
            branchName: record.branch_name,
            explodeBranches: record.explode_branches === 1,
            status: record.is_head === 1 ? 'Active' : 'Draft',
            aheadCount: record.ahead_count,
            behindCount: record.behind_count,
            viewMode: record.view_mode as 'COMPACT' | 'EXPANDED',
            commitDensity: record.commit_density,
            themeColorHex: record.theme_color_hex || '#4f46e5',
            groupThemeColorHex: record.group_theme_color_hex || null,
            tags: parseNodeTags(record.tags_json),
            isDimmedByTagFilter:
              activeTagFilters.length > 0 &&
              !parseNodeTags(record.tags_json).some((tag) => activeTagFilters.includes(tag.id)),
          },
        };
      });

      const processedEdgeIds = new Set<string>();
      const combinedEdges: Edge[] = [];
      const pickVisibleNodeIdForRepo = (repoId: string) => {
        const candidates = formattedNodes.filter((node) => node.data.repoPathId === repoId);
        if (candidates.length === 0) return null;
        const activeNode = candidates.find((node) => node.data.status === 'Active');
        return (activeNode || candidates[0]).id;
      };

      topology.forEach((relation) => {
        const cleanSrc = relation.source_branch.replace('refs/heads/', '').trim();
        const cleanTgt = relation.target_branch.replace('refs/heads/', '').trim();

        const sourceNode = dbNodes.find((node) => normalizeBranchName(node.branch_name) === cleanSrc);
        const targetNode = dbNodes.find((node) => normalizeBranchName(node.branch_name) === cleanTgt);

        if (sourceNode && targetNode) {
          const sourceNodeId = sourceNode.explode_branches === 1 && sourceNode.branch_name
            ? `${getNodeRepoPathId(sourceNode)}__${normalizeBranchName(sourceNode.branch_name)}`
            : getNodeRepoPathId(sourceNode);
          const targetNodeId = targetNode.explode_branches === 1 && targetNode.branch_name
            ? `${getNodeRepoPathId(targetNode)}__${normalizeBranchName(targetNode.branch_name)}`
            : getNodeRepoPathId(targetNode);

          if (sourceNodeId && targetNodeId && sourceNodeId !== targetNodeId) {
            const edgeId = `topo-${sourceNodeId}-${targetNodeId}`;
            processedEdgeIds.add(edgeId);
            
            combinedEdges.push({
              id: edgeId,
              source: sourceNodeId,
              target: targetNodeId,
              sourceHandle: 'source-right',
              targetHandle: 'target-left',
              animated: false,
              data: { kind: 'topology' },
              label: `+${relation.distance_from_ancestor} commits`,
              labelStyle: { fill: '#71717a', fontSize: 10, fontWeight: 500 },
              style: { 
                stroke: sourceNode.theme_color_hex || '#6366f1', 
                strokeWidth: 2, 
                strokeDasharray: '5 5' 
              },
            });
          }
        }
      });

      const dbEdges = await invoke<CanvasEdgeRecord[]>('get_manual_edges', { viewId });
      dbEdges.forEach((edge) => {
        const matchingNode = dbNodes.find((node) => node.repo_path_id === edge.source_repo_id);
        const accentColor = matchingNode ? matchingNode.theme_color_hex : '#4f46e5';
        const manualEdgeId = edge.id;
        const encodedNodePair = parseManualEdgeNodePair(manualEdgeId);
        const sourceNodeId = encodedNodePair
          ? (formattedNodes.find((node) => node.id === encodedNodePair[0])?.id || pickVisibleNodeIdForRepo(edge.source_repo_id))
          : pickVisibleNodeIdForRepo(edge.source_repo_id);
        const targetNodeId = encodedNodePair
          ? (formattedNodes.find((node) => node.id === encodedNodePair[1])?.id || pickVisibleNodeIdForRepo(edge.target_repo_id))
          : pickVisibleNodeIdForRepo(edge.target_repo_id);

        if (
          !processedEdgeIds.has(manualEdgeId) &&
          sourceNodeId &&
          targetNodeId &&
          sourceNodeId !== targetNodeId
        ) {
          combinedEdges.push({
            id: manualEdgeId,
            source: sourceNodeId,
            target: targetNodeId,
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            animated: true,
            data: { kind: 'manual' },
            style: { stroke: accentColor, strokeWidth: 2.5 },
          });
        }
      });

      set({ nodes: formattedNodes, edges: combinedEdges });
    } catch (error) {
      console.error('Failed graph workspace hydration sequence:', error);
    }
  },

  updateNodeConfig: async (repoPathId, viewMode, density, hex, explodeBranches) => {
    const viewId = get().activeViewId;
    if (!viewId) return;

    set({
      nodes: get().nodes.map((node) => 
        (node.data.repoPathId === repoPathId || node.id === repoPathId)
          ? { ...node, data: { ...node.data, viewMode, commitDensity: density, themeColorHex: hex, explodeBranches } }
          : node
      )
    });

    try {
      await invoke('update_branch_card_config', {
        viewId,
        repoPathId: repoPathId,
        repo_path_id: repoPathId,
        viewMode,
        commitDensity: density,
        themeColorHex: hex,
        explodeBranches: explodeBranches ? 1 : 0,
        explode_branches: explodeBranches ? 1 : 0,
      });

      await get().hydrateWorkspaceNodes();

      const currentEdges = get().edges.map((edge) => {
        if (edge.source === repoPathId || edge.source.startsWith(`${repoPathId}__`)) {
          return { ...edge, style: { ...edge.style, stroke: hex } };
        }
        return edge;
      });
      set({ edges: currentEdges });
    } catch (error) {
      console.error('Failed to persist node appearance overrides:', error);
    }
  },

  removeManualEdge: async (edgeId) => {
    const viewId = get().activeViewId;
    if (!viewId) return;

    set({ edges: get().edges.filter((edge) => edge.id !== edgeId) });

    try {
      await invoke('delete_manual_edge', { viewId, id: edgeId });
    } catch (error) {
      console.error('Failed to delete manual edge:', error);
      await get().hydrateWorkspaceNodes();
    }
  },

  saveViewport: async (zoom, x, y) => {
    const viewId = get().activeViewId;
    if (!viewId) return;
    try {
      await invoke('save_viewport_state', { viewId, zoomLevel: zoom, panX: x, panY: y });
    } catch (error) {
      console.error('Failed to save viewport offset state:', error);
    }
  }
}));