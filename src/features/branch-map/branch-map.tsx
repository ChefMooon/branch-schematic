import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';

// Mandatory core structural styles
import '@xyflow/react/dist/style.css';

import { BranchCard } from './components/branch-card';
import { MapToolbar } from './components/map-toolbar';
import { initialEdges, initialNodes } from './mock-data';

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

  return (
    <div 
      style={{
        position: 'fixed',
        top: '60px',
        left: '0px',
        width: '100vw',
        height: 'calc(100vh - 60px)',
        backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
        overflow: 'hidden',
        zIndex: 1
      }}
    >
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
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
          color={isDark ? '#525252' : '#cbd5e1'} 
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