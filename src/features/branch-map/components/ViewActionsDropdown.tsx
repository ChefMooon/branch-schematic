import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { useCanvasStore } from '../../../stores/canvas-store';

type ViewActionsDropdownProps = {
  isDark?: boolean;
  activeView: CanvasViewRecord | null;
  viewport: {
    zoom: number;
    x: number;
    y: number;
  };
  onOpenManager: () => void;
  onOpenCreateView?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function ViewActionsDropdown({
  isDark = false,
  activeView,
  viewport,
  onOpenManager,
  onOpenCreateView,
  isOpen: isOpenProp,
  onOpenChange,
}: ViewActionsDropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = isOpenProp ?? internalOpen;

  const setIsOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (isOpenProp === undefined) {
      setInternalOpen(nextOpen);
    }
    if (!nextOpen) {
      setIsRenameOpen(false);
    }
  };

  const nodes = useCanvasStore((state) => state.nodes);
  const views = useCanvasStore((state) => state.views);
  const duplicateView = useCanvasStore((state) => state.duplicateView);
  const renameView = useCanvasStore((state) => state.renameView);
  const deleteView = useCanvasStore((state) => state.deleteView);
  const setViewFavorite = useCanvasStore((state) => state.setViewFavorite);
  const moveViewOrder = useCanvasStore((state) => state.moveViewOrder);
  const snapshotBaselineViewport = useCanvasStore((state) => state.snapshotBaselineViewport);
  const saveCardState = useCanvasStore((state) => state.saveCardState);

  const canDelete = (views.length ?? 0) > 1;
  const orderedViews = useMemo(() => {
    return [...views].sort((left, right) => {
      const favoriteDelta = (right.is_favorite ?? 0) - (left.is_favorite ?? 0);
      if (favoriteDelta !== 0) return favoriteDelta;

      const displayOrderDelta = (left.display_order ?? 0) - (right.display_order ?? 0);
      if (displayOrderDelta !== 0) return displayOrderDelta;

      return left.name.localeCompare(right.name);
    });
  }, [views]);
  const activeIndex = activeView
    ? orderedViews.findIndex((view) => view.id === activeView.id)
    : -1;
  const canMoveUp = activeIndex > 0;
  const canMoveDown = activeIndex >= 0 && activeIndex < orderedViews.length - 1;

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      if (!menuRef.current) return;

      const buttonRect = menuRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = Math.min(360, window.innerHeight - 24);
      const left = Math.min(buttonRect.right - menuWidth, window.innerWidth - menuWidth - 8);
      const top = Math.min(buttonRect.bottom + 6, window.innerHeight - menuHeight - 8);

      setMenuPosition({
        top: Math.max(8, top),
        left: Math.max(8, left),
      });
    };

    updateMenuPosition();

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      updateMenuPosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isOpen) return;
      setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  useEffect(() => {
    if (activeView && isRenameOpen) {
      setRenameValue(activeView.name);
    }
  }, [activeView, isRenameOpen]);

  const cardStatePayload = useMemo(() => {
    return JSON.stringify({
      viewport: {
        zoom: viewport.zoom,
        x: viewport.x,
        y: viewport.y,
      },
      nodes: nodes.map((node) => ({
        id: node.id,
        repoPathId: node.data.repoPathId,
        branchId: node.data.branchId,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        viewMode: node.data.viewMode,
        commitDensity: node.data.commitDensity,
        themeColorHex: node.data.themeColorHex,
        explodeBranches: node.data.explodeBranches,
      })),
      capturedAt: new Date().toISOString(),
    });
  }, [nodes, viewport.x, viewport.y, viewport.zoom]);

  const handleDuplicate = async () => {
    if (!activeView) return;
    const suggestedName = `${activeView.name} Copy`;
    const name = window.prompt('Duplicate view name:', suggestedName);
    if (!name || !name.trim()) return;

    await duplicateView(activeView.id, name.trim());
    setIsOpen(false);
  };

  const handleRename = async () => {
    if (!activeView) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName) return;

    await renameView(activeView.id, trimmedName);
    setIsRenameOpen(false);
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (!activeView || !canDelete) return;

    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeView || !canDelete) return;

    await deleteView(activeView.id);
    setIsDeleteConfirmOpen(false);
    setIsOpen(false);
  };

  const handleSaveBaseline = async () => {
    if (!activeView) return;
    await snapshotBaselineViewport(activeView.id, viewport.zoom, viewport.x, viewport.y);
    setIsOpen(false);
  };

  const handleFavoriteToggle = async () => {
    if (!activeView) return;
    await setViewFavorite(activeView.id, (activeView.is_favorite ?? 0) !== 1);
    setIsOpen(false);
  };

  const handleMoveUp = async () => {
    if (!activeView || !canMoveUp) return;
    await moveViewOrder(activeView.id, -1);
    setIsOpen(false);
  };

  const handleMoveDown = async () => {
    if (!activeView || !canMoveDown) return;
    await moveViewOrder(activeView.id, 1);
    setIsOpen(false);
  };

  const handleSaveCardState = async () => {
    if (!activeView) return;
    await saveCardState(activeView.id, cardStatePayload);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View actions"
        title="View actions"
        style={{
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: `1px solid ${isDark ? '#404040' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#111111' : '#ffffff',
          color: isDark ? '#d4d4d4' : '#475569',
          fontSize: '16px',
          lineHeight: 1,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ⋯
      </button>

      {isOpen && menuPosition && (
        <div
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: '220px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'min(360px, calc(100vh - 16px))',
            overflowY: 'auto',
            background: isDark ? '#111111' : '#ffffff',
            border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
            borderRadius: '10px',
            boxShadow: isDark
              ? '0 12px 26px -8px rgba(0, 0, 0, 0.65)'
              : '0 10px 24px -12px rgba(15, 23, 42, 0.35)',
            padding: '8px',
            zIndex: 18,
          }}
        >
          <button
            onClick={() => {
              onOpenCreateView?.();
              setIsOpen(false);
            }}
            style={menuButtonStyle(isDark)}
          >
            New View
          </button>

          <button
            onClick={handleDuplicate}
            style={menuButtonStyle(isDark)}
            disabled={!activeView}
          >
            Duplicate
          </button>

          <button
            onClick={handleFavoriteToggle}
            style={menuButtonStyle(isDark)}
            disabled={!activeView}
          >
            {activeView && (activeView.is_favorite ?? 0) === 1 ? 'Unfavorite' : 'Favorite'}
          </button>

          <button
            onClick={handleMoveUp}
            style={menuButtonStyle(isDark)}
            disabled={!activeView || !canMoveUp}
          >
            Move Up
          </button>

          <button
            onClick={handleMoveDown}
            style={menuButtonStyle(isDark)}
            disabled={!activeView || !canMoveDown}
          >
            Move Down
          </button>

          {!isRenameOpen ? (
            <button
              onClick={() => setIsRenameOpen(true)}
              style={menuButtonStyle(isDark)}
              disabled={!activeView}
            >
              Rename
            </button>
          ) : (
            <div style={{ margin: '6px 0', display: 'grid', gap: '6px' }}>
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="View name"
                style={{
                  width: '100%',
                  minWidth: '180px',
                  maxWidth: '220px',
                  boxSizing: 'border-box',
                  borderRadius: '6px',
                  border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
                  background: isDark ? '#0a0a0a' : '#f8fafc',
                  color: isDark ? '#f4f4f5' : '#0f172a',
                  padding: '6px 8px',
                  fontSize: '12px',
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleRename} style={{ ...menuButtonStyle(isDark), flex: 1 }}>
                  Save
                </button>
                <button
                  onClick={() => setIsRenameOpen(false)}
                  style={{ ...menuButtonStyle(isDark), flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleDelete}
            style={menuButtonStyle(isDark, true)}
            disabled={!activeView || !canDelete}
            title={canDelete ? 'Delete active view' : 'At least one view must remain'}
          >
            Delete
          </button>

          <button
            onClick={handleSaveBaseline}
            style={menuButtonStyle(isDark)}
            disabled={!activeView}
          >
            Save View as Base View
          </button>

          <button
            onClick={handleSaveCardState}
            style={menuButtonStyle(isDark)}
            disabled={!activeView}
          >
            Save Card State
          </button>

          <div
            style={{
              height: '1px',
              margin: '8px 4px',
              background: isDark ? '#27272a' : '#e2e8f0',
            }}
          />

          <button
            onClick={() => {
              onOpenManager();
              setIsOpen(false);
            }}
            style={menuButtonStyle(isDark)}
          >
            Open View Manager
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        title="Delete view"
        message={
          <>
            Delete view <strong>{activeView?.name ?? 'this view'}</strong>? The next view in order
            will become active. This action cannot be undone.
          </>
        }
        confirmLabel="Delete view"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
}

function menuButtonStyle(isDark: boolean, isDanger = false) {
  return {
    width: '100%',
    textAlign: 'left' as const,
    border: 'none',
    borderRadius: '7px',
    background: 'transparent',
    color: isDanger
      ? (isDark ? '#fca5a5' : '#dc2626')
      : (isDark ? '#e4e4e7' : '#334155'),
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '7px 8px',
  };
}
