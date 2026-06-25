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
import type { BranchCardNode } from '../features/branch-map/components/branch-card'; // Make sure to export this type from branch-card.tsx

interface WorkspaceNodeRecord {
  branch_id: string;
  branch_name: string;
  is_head: number;
  last_commit_hash: string;
  commit_message?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
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

// Temporary fallback data until Step 4 (Hydration) is complete
const initialNodes: BranchCardNode[] = [
  { id: '1', type: 'branchCard', position: { x: 250, y: 150 }, data: { title: 'main', status: 'Active', content: 'Production branch' } }
];

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
  nodes: initialNodes,
  edges: [],
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as BranchCardNode[] });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  hydrateWorkspaceNodes: async () => {
    try {
      const rows = await invoke<WorkspaceNodeRecord[]>('get_workspace_nodes');
      const hydratedNodes = rows.map(mapWorkspaceNodeToCanvasNode);

      set({ nodes: hydratedNodes.length > 0 ? hydratedNodes : initialNodes });
    } catch (error) {
      console.error('Failed to hydrate workspace nodes:', error);
      set({ nodes: initialNodes });
    }
  },
}));