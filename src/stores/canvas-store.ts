import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import {
  Edge,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { BranchCardNode } from '../features/branch-map/components/branch-card';

export interface WorkspaceNodeRecord {
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
}

interface CanvasEdgeRecord {
  id: string;
  source_branch_id: string;
  target_branch_id: string;
  edge_style: string;
}

interface GitTopologyRelation {
  source_branch: string;
  target_branch: string;
  common_ancestor: string;
  distance_from_ancestor: number;
}

interface CanvasState {
  nodes: BranchCardNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<BranchCardNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: BranchCardNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  hydrateWorkspaceNodes: () => Promise<void>;
  updateNodeConfig: (branchId: string, viewMode: 'COMPACT' | 'EXPANDED', density: number, hex: string) => Promise<void>;
}

function mapWorkspaceNodeToCanvasNode(record: WorkspaceNodeRecord, index: number): BranchCardNode {
  const isDefaultPos = 
    record.pos_x === null || 
    record.pos_y === null || 
    (Math.abs((record.pos_x ?? 0) - 100.0) < 0.01 && Math.abs((record.pos_y ?? 0) - 100.0) < 0.01);

  const columns = 3;
  const colIndex = index % columns;
  const rowIndex = Math.floor(index / columns);

  const fallbackX = 150 + colIndex * 380;
  const fallbackY = 150 + rowIndex * 340;

  return {
    id: record.branch_id,
    type: 'branchCard',
    position: {
      x: isDefaultPos ? fallbackX : (record.pos_x ?? fallbackX),
      y: isDefaultPos ? fallbackY : (record.pos_y ?? fallbackY),
    },
    data: {
      title: record.branch_name,
      status: record.is_head === 1 ? 'Active' : 'Draft',
      aheadCount: record.ahead_count,
      behindCount: record.behind_count,
      viewMode: record.view_mode as 'COMPACT' | 'EXPANDED',
      commitDensity: record.commit_density,
      themeColorHex: record.theme_color_hex || '#4f46e5',
    },
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as BranchCardNode[] });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: async (connection) => {
    if (!connection.source || !connection.target) return;

    const newEdgeId = `edge-${connection.source}-${connection.target}`;
    const sourceNode = get().nodes.find(n => n.id === connection.source);
    const accentColor = sourceNode ? sourceNode.data.themeColorHex : '#4f46e5';

    const newEdge: Edge = {
      id: newEdgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      animated: true,
      style: { stroke: accentColor, strokeWidth: 2.5 },
    };

    set({ edges: addEdge(newEdge, get().edges) });

    try {
      await invoke('save_manual_edge', {
        id: newEdgeId,
        source: connection.source,
        target: connection.target,
      });
    } catch (error) {
      console.error('Failed to save manual edge override:', error);
    }
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  hydrateWorkspaceNodes: async () => {
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

      const dbNodes = await invoke<WorkspaceNodeRecord[]>('get_workspace_nodes');
      const formattedNodes = dbNodes.map((node, index) => mapWorkspaceNodeToCanvasNode(node, index));

      const processedEdgeIds = new Set<string>();
      const combinedEdges: Edge[] = [];

      // Improved topology string cleaning logic
      topology.forEach((relation) => {
        const cleanSrc = relation.source_branch.replace('refs/heads/', '').trim();
        const cleanTgt = relation.target_branch.replace('refs/heads/', '').trim();

        const sourceNode = dbNodes.find(n => n.branch_name.replace('refs/heads/', '').trim() === cleanSrc);
        const targetNode = dbNodes.find(n => n.branch_name.replace('refs/heads/', '').trim() === cleanTgt);

        if (sourceNode && targetNode && sourceNode.branch_id !== targetNode.branch_id) {
          const edgeId = `topo-${sourceNode.branch_id}-${targetNode.branch_id}`;
          processedEdgeIds.add(edgeId);
          
          combinedEdges.push({
            id: edgeId,
            source: sourceNode.branch_id,
            target: targetNode.branch_id,
            sourceHandle: 'source-right', // Routes out of the right handle
            targetHandle: 'target-left',  // Routes into the left handle
            animated: false,
            label: `+${relation.distance_from_ancestor} commits`,
            labelStyle: { fill: '#71717a', fontSize: 10, fontWeight: 500 },
            style: { 
              stroke: sourceNode.theme_color_hex || '#6366f1', 
              strokeWidth: 2, 
              strokeDasharray: '5 5' 
            },
          });
        }
      });

      const dbEdges = await invoke<CanvasEdgeRecord[]>('get_manual_edges');
      dbEdges.forEach((edge) => {
        const matchingNode = dbNodes.find(n => n.branch_id === edge.source_branch_id);
        const accentColor = matchingNode ? matchingNode.theme_color_hex : '#4f46e5';
        const manualEdgeId = edge.id;

        if (!processedEdgeIds.has(manualEdgeId)) {
          combinedEdges.push({
            id: manualEdgeId,
            source: edge.source_branch_id,
            target: edge.target_branch_id,
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            animated: true,
            style: { stroke: accentColor, strokeWidth: 2.5 },
          });
        }
      });

      set({ nodes: formattedNodes, edges: combinedEdges });
    } catch (error) {
      console.error('Failed graph workspace hydration sequence:', error);
    }
  },

  updateNodeConfig: async (branchId, viewMode, density, hex) => {
    set({
      nodes: get().nodes.map(node => 
        node.id === branchId 
          ? { ...node, data: { ...node.data, viewMode, commitDensity: density, themeColorHex: hex } }
          : node
      )
    });

    try {
      await invoke('update_branch_card_config', {
        branchId,
        viewMode,
        commitDensity: density,
        themeColorHex: hex,
      });

      const currentEdges = get().edges.map(edge => {
        if (edge.source === branchId) {
          return { ...edge, style: { ...edge.style, stroke: hex } };
        }
        return edge;
      });
      set({ edges: currentEdges });
    } catch (error) {
      console.error('Failed to persist node appearance overrides:', error);
    }
  }
}));