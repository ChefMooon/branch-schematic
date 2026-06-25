import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BranchCard } from './components/branch-card';
import type { BranchCardNode } from './components/branch-card';
import { MapToolbar } from './components/map-toolbar';
import { useCanvasStore } from '../../stores/canvas-store';

const nodeTypes = {
  branchCard: BranchCard,
};

function useAppThemeMode() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const updateTheme = () => {
      setThemeMode(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return themeMode;
}

function MapWorkspace() {
  const themeMode = useAppThemeMode();
  const isDark = themeMode === 'dark';

  // Pull spatial state and handlers from Zustand
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const hydrateWorkspaceNodes = useCanvasStore((state) => state.hydrateWorkspaceNodes);

  useEffect(() => {
    void hydrateWorkspaceNodes();
  }, [hydrateWorkspaceNodes]);

  const handleNodeDragStop: OnNodeDrag<BranchCardNode> = async (_event, node) => {
    try {
      await invoke('update_card_position', {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      });
    } catch (error) {
      console.error('Failed to persist branch card position:', error);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: '60px', // Matches your layout offset
        left: '0px',
        width: '100vw',
        height: 'calc(100vh - 60px)',
        backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
        overflow: 'hidden',
        zIndex: 1
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
        fitView
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5} 
          color={isDark ? '#404040' : '#cbd5e1'} 
        />
      </ReactFlow>

      <MapToolbar isDark={isDark} />
    </div>
  );
}

export function BranchMap() {
  return (
    <ReactFlowProvider>
      <MapWorkspace />
    </ReactFlowProvider>
  );
}