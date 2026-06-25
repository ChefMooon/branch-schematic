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

interface WorkspaceNodeRecord {
  branch_id: string;
  branch_name: string;
  is_head: number;
  last_commit_hash: string;
  commit_message?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
}

interface CanvasEdgeRecord {
  id: string;
  source_branch_id: string;
  target_branch_id: string;
  edge_style: string;
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
}

function mapWorkspaceNodeToCanvasNode(record: WorkspaceNodeRecord, index: number): BranchCardNode {
  return {
    id: record.branch_id,
    type: 'branchCard',
    position: {
      x: record.pos_x ?? 160 + index * 336,
      y: record.pos_y ?? 180,
    },
    data: {
      title: record.branch_name,
      status: record.is_head === 1 ? 'Active' : 'Draft',
      content: record.commit_message ?? 'No cached commit summary yet.',
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
    const newEdge: Edge = {
      id: newEdgeId,
      source: connection.source,
      target: connection.target,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    };

    // Optimistically update React Flow Viewport state loop
    set({ edges: addEdge(newEdge, get().edges) });

    try {
      // Direct SQLite transactional durability persistence lock
      await invoke('save_manual_edge', {
        id: newEdgeId,
        source: connection.source,
        target: connection.target,
      });
    } catch (error) {
      console.error('Failed to commit structural manually overridden edge connection:', error);
    }
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  hydrateWorkspaceNodes: async () => {
    try {
      // 1. Fetch persistent coordinate nodes from the Db State
      const dbNodes = await invoke<WorkspaceNodeRecord[]>('get_workspace_nodes');
      const formattedNodes = dbNodes.map((node, index) => mapWorkspaceNodeToCanvasNode(node, index));

      // 2. Fetch manual persistent visual edges override mappings
      const dbEdges = await invoke<CanvasEdgeRecord[]>('get_manual_edges');
      const formattedEdges: Edge[] = dbEdges.map((edge) => ({
        id: edge.id,
        source: edge.source_branch_id,
        target: edge.target_branch_id,
        animated: true,
        style: { stroke: '#4f46e5', strokeWidth: 2 },
      }));

      set({ nodes: formattedNodes, edges: formattedEdges });
    } catch (error) {
      console.error('Failed to execute graph node and edge hydration loops:', error);
    }
  },
}));