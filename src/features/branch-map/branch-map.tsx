import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BranchCard } from './components/branch-card';
import type { BranchCardNode } from './components/branch-card';
import { MapToolbar } from './components/map-toolbar';
import { ViewSelectorTabs } from './components/view-selector-tabs';
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
  const [isViewManagerOpen, setIsViewManagerOpen] = useState(false);
  const { setViewport } = useReactFlow();

  const views = useCanvasStore((state) => state.views);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const hydrateViewsList = useCanvasStore((state) => state.hydrateViewsList);
  const hydrateWorkspaceNodes = useCanvasStore((state) => state.hydrateWorkspaceNodes);

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const onEdgeClick = useCanvasStore((state) => state.onEdgeClick);
  const saveViewport = useCanvasStore((state) => state.saveViewport);

  // 1. Initial workspace registration and views initialization
  useEffect(() => {
    async function initializeAndHydrate() {
      try {
        const activePaths = await invoke<any[]>('get_active_tracked_paths');
        for (const path of activePaths) {
          try {
            await invoke('watch_project_directory', {
              pathId: path.id,
              absolutePath: path.absolute_path,
            });
          } catch (watchError) {
            console.error(`Failed starting watcher loop for ${path.absolute_path}:`, watchError);
          }
        }
      } catch (err) {
        console.error('Failed to look up active tracked paths:', err);
      } finally {
        await hydrateViewsList();
      }
    }
    initializeAndHydrate();
  }, [hydrateViewsList]);

  // 2. Fetch workspace nodes cleanly whenever the active view channel shifts
  useEffect(() => {
    if (activeViewId) {
      hydrateWorkspaceNodes();
    }
  }, [activeViewId, hydrateWorkspaceNodes]);

  // 3. Background background synchronization loop to update commit metadata without fighting card movement
  useEffect(() => {
    if (!activeViewId) return;
    
    const pollInterval = setInterval(() => {
      hydrateWorkspaceNodes();
    }, 4000); // Poll branch updates smoothly every 4 seconds

    return () => clearInterval(pollInterval);
  }, [activeViewId, hydrateWorkspaceNodes]);

  // 4. Update view offsets when active view layout switches
  useEffect(() => {
    if (activeViewId) {
      const activeViewObj = views.find(v => v.id === activeViewId);
      if (activeViewObj) {
        setViewport({
          zoom: activeViewObj.zoom_level || 1.0,
          x: activeViewObj.pan_x || 0.0,
          y: activeViewObj.pan_y || 0.0,
        }, { duration: 300 });
      }
    }
  }, [activeViewId, views, setViewport]);

  const handleNodeDragStop: OnNodeDrag<BranchCardNode> = async (_event, node) => {
    if (!activeViewId) return;

    const repoPathId = node.data.repoPathId || node.id;
    const isExplodedChildNode = node.data.explodeBranches && node.id !== repoPathId;
    const positionKey = isExplodedChildNode
      ? (node.data.branchId || repoPathId)
      : repoPathId;

    try {
      await invoke('update_card_position', {
        viewId: activeViewId,
        id: positionKey,
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
        top: '60px',
        left: '0px',
        width: '100vw',
        height: 'calc(100vh - 60px)',
        backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
        overflow: 'hidden',
        zIndex: 1
      }}
    >
      <ViewSelectorTabs
        isDark={isDark}
        isModalOpen={isViewManagerOpen}
        onModalOpenChange={setIsViewManagerOpen}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={(_event, viewport) => {
          if (activeViewId) {
            saveViewport(viewport.zoom, viewport.x, viewport.y);
          }
        }}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={3}
        edgesFocusable={true}
        nodesDraggable={true} // Explicitly enables global viewport dragging interactivity
        nodesConnectable={true}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5} 
          color={isDark ? '#404040' : '#cbd5e1'} 
        />
      </ReactFlow>

      <MapToolbar isDark={isDark} hidden={isViewManagerOpen} />
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