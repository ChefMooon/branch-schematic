import { Node, Edge } from '@xyflow/react';

export const initialNodes: Node[] = [
  {
    id: '1',
    type: 'branchCard',
    position: { x: 100, y: 150 },
    data: { 
      title: 'Main Pipeline', 
      status: 'Active', 
      content: 'The core architecture execution layer for tracking application processes.' 
    },
  },
  {
    id: '2',
    type: 'branchCard',
    position: { x: 450, y: 50 },
    data: { 
      title: 'Sub-Module Alpha', 
      status: 'Draft', 
      content: 'Isolated prototyping module meant for local sandboxed features.' 
    },
  },
  {
    id: '3',
    type: 'branchCard',
    position: { x: 450, y: 300 },
    data: { 
      title: 'Legacy Engine', 
      status: 'Archived', 
      content: 'Deprecating soon once the local SQLite migration finishes completely.' 
    },
  },
  {
    id: '4',
    type: 'branchCard',
    position: { x: 800, y: 175 },
    data: { 
      title: 'Data Sink', 
      status: 'Active', 
      content: 'Aggregates outputs from pipelines and handles local storage persistence layer.' 
    },
  },
];

export const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e3-4', source: '3', target: '4', animated: true },
];