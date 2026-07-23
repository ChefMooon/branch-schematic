import { useEffect, useMemo, useState } from 'react';
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

import { BranchCard } from './components/BranchCard';
import type { BranchCardNode } from './components/BranchCard';
import { MapToolbar } from './components/MapToolbar';
import { ViewSelectorTabs } from './components/ViewSelectorTabs';
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
  const { setViewport, zoomIn, zoomOut, fitView } = useReactFlow();

  const views = useCanvasStore((state) => state.views);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const hydrateViewsList = useCanvasStore((state) => state.hydrateViewsList);
  const initializeBranchMapSession = useCanvasStore((state) => state.initializeBranchMapSession);
  const hydrateWorkspaceNodes = useCanvasStore((state) => state.hydrateWorkspaceNodes);

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const onEdgeClick = useCanvasStore((state) => state.onEdgeClick);
  const saveViewport = useCanvasStore((state) => state.saveViewport);
  const isViewHydrating = useCanvasStore((state) => state.isViewHydrating);
  const activeViewObj = useMemo(
    () => views.find((view) => view.id === activeViewId) ?? null,
    [views, activeViewId],
  );
  const isCanvasReady = views.length === 0 || Boolean(activeViewObj);

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
        await initializeBranchMapSession();
      }
    }
    initializeAndHydrate();
  }, [hydrateViewsList, initializeBranchMapSession]);

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

  // 4. Sync the viewport only when the active view selection changes so metadata-only actions
  // do not reapply the stored camera state and cause a visible jump.
  useEffect(() => {
    if (!activeViewId) return;

    if (!activeViewObj) return;

    setViewport({
      zoom: activeViewObj.zoom_level || 1.0,
      x: activeViewObj.pan_x || 0.0,
      y: activeViewObj.pan_y || 0.0,
    });
  }, [activeViewId, activeViewObj, setViewport]);

  const handleViewportReset = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 });
    if (activeViewId) {
      saveViewport(1, 0, 0);
    }
  };

  const handleFitView = () => {
    const attemptFit = (attempt = 0) => {
      fitView({
        duration: attempt === 0 ? 0 : 400,
        padding: 0.16,
        maxZoom: 1.6,
      });

      if (attempt < 2 && nodes.length > 0) {
        window.setTimeout(() => attemptFit(attempt + 1), 160);
      }
    };

    window.requestAnimationFrame(() => attemptFit());
  };

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
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
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

      {isCanvasReady && (
        <>
          <ReactFlow
            defaultViewport={
              activeViewObj
                ? {
                    zoom: activeViewObj.zoom_level || 1.0,
                    x: activeViewObj.pan_x || 0.0,
                    y: activeViewObj.pan_y || 0.0,
                  }
                : {
                    zoom: 1.0,
                    x: 0.0,
                    y: 0.0,
                  }
            }
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

          {isViewHydrating && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 15,
                pointerEvents: 'none',
                background: isDark ? 'rgba(10, 10, 10, 0.42)' : 'rgba(248, 250, 252, 0.5)',
                backdropFilter: 'blur(1px)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: isDark
                    ? 'linear-gradient(120deg, transparent 25%, rgba(255, 255, 255, 0.04) 50%, transparent 75%)'
                    : 'linear-gradient(120deg, transparent 25%, rgba(15, 23, 42, 0.04) 50%, transparent 75%)',
                  backgroundSize: '220% 100%',
                  animation: 'branchMapHydrateShimmer 900ms ease-in-out infinite',
                }}
              />

              <style>
                {`@keyframes branchMapHydrateShimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -20% 0; }
                }`}
              </style>
            </div>
          )}
        </>
      )}

      <MapToolbar
        hidden={isViewManagerOpen}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onResetViewport={handleViewportReset}
        onFitView={handleFitView}
      />
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