import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretRight,
  CaretDown,
  CopySimple,
  PencilSimple,
  Star,
  Trash,
} from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { TextInputModal } from '../../../components/Modal/TextInputModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { useCanvasStore } from '../../../stores/canvas-store';
import { Button } from '../../../components/button/Button';
import { useClickOutside } from '../../../hooks/useClickOutside';

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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<'order' | 'state-options' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = isOpenProp ?? internalOpen;
  const { addToast } = useNotifications();

  const setIsOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (isOpenProp === undefined) {
      setInternalOpen(nextOpen);
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
  const getSavedCardLocationSnapshot = useCanvasStore((state) => state.getSavedCardLocationSnapshot);
  const restoreSavedCardLocations = useCanvasStore((state) => state.restoreSavedCardLocations);
  const undoSavedCardLocationRestore = useCanvasStore((state) => state.undoSavedCardLocationRestore);
  const canUndoSavedCardLocationRestore = useCanvasStore((state) => state.canUndoSavedCardLocationRestore);

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

    const handleResize = () => {
      updateMenuPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  useClickOutside(menuRef, () => setIsOpen(false), isOpen && !isRenameOpen);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isOpen || isRenameOpen) return;
      setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isRenameOpen]);

  const cardStatePayload = useMemo(() => {
    return JSON.stringify({
      schemaVersion: 1,
      viewId: activeView?.id ?? null,
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
      locations: nodes.map((node) => ({
        kind: node.data.branchId && node.id !== node.data.repoPathId ? 'branch' : 'repository',
        repoPathId: node.data.repoPathId,
        branchId: node.data.branchId,
        x: node.position.x,
        y: node.position.y,
      })),
      capturedAt: new Date().toISOString(),
    });
  }, [activeView?.id, nodes, viewport.x, viewport.y, viewport.zoom]);

  const hasSavedCardLocations = Boolean(activeView && getSavedCardLocationSnapshot(activeView.id));

  const handleDuplicate = async () => {
    if (!activeView) return;
    const suggestedName = `${activeView.name} Copy`;
    const name = window.prompt('Duplicate view name:', suggestedName);
    if (!name || !name.trim()) return;

    await duplicateView(activeView.id, name.trim());
    setIsOpen(false);
  };

  const handleRename = async (name: string) => {
    if (!activeView) return;

    try {
      await renameView(activeView.id, name);
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Rename failed',
        message: error instanceof Error ? error.message : 'The view could not be renamed.',
      });
      return;
    }

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

  const handleRestoreConfirm = async () => {
    if (!activeView) return;
    const restored = await restoreSavedCardLocations(activeView.id);
    if (restored) {
      setIsRestoreConfirmOpen(false);
      setIsOpen(false);
    }
  };

  const handleUndoRestore = async () => {
    const undone = await undoSavedCardLocationRestore();
    if (undone) setIsOpen(false);
  };

  const quickActions: Array<{
    key: string;
    label: string;
    title: string;
    icon: typeof Star;
    disabled: boolean;
    onClick: () => void;
    danger?: boolean;
  }> = [
    {
      key: 'favorite',
      label: activeView && (activeView.is_favorite ?? 0) === 1 ? 'Unfavorite view' : 'Favorite view',
      title: activeView && (activeView.is_favorite ?? 0) === 1 ? 'Unfavorite view' : 'Favorite view',
      icon: Star,
      disabled: !activeView,
      onClick: handleFavoriteToggle,
    },
    {
      key: 'duplicate',
      label: 'Duplicate view',
      title: 'Duplicate view',
      icon: CopySimple,
      disabled: !activeView,
      onClick: handleDuplicate,
    },
    {
      key: 'rename',
      label: 'Rename view',
      title: 'Rename view',
      icon: PencilSimple,
      disabled: !activeView,
      onClick: () => {
        setIsRenameOpen(true);
      },
    },
    {
      key: 'delete',
      label: 'Delete view',
      title: 'Archive view',
      icon: Trash,
      disabled: !activeView || !canDelete,
      onClick: handleDelete,
      danger: true,
    },
  ];

  const submenuButtonStyle = (isDanger = false) => ({
    ...menuButtonStyle(),
    justifyContent: 'space-between',
    color: isDanger ? 'var(--app-danger)' : undefined,
    ...(isDanger ? { backgroundColor: 'transparent' } : {}),
  });

  const toggleSubmenu = (section: 'order' | 'state-options') => {
    setOpenSubmenu((current) => (current === section ? null : section));
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <Button
        type="button"
        variant="basic"
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
          fontSize: '16px',
          lineHeight: 1,
          padding: 0,
        }}
      >
        ⋯
      </Button>

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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '2px 2px 8px',
              borderBottom: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
              marginBottom: '8px',
            }}
          >
            {quickActions.map(({ key, label, title, icon: Icon, disabled, onClick, danger }) => {
              const isFavoriteAction = key === 'favorite';
              const favoriteWeight = activeView && (activeView.is_favorite ?? 0) === 1 ? 'fill' : 'bold';

              return (
                <Button
                  key={key}
                  type="button"
                  variant={danger ? 'menu-item-danger' : 'menu-item'}
                  aria-label={label}
                  title={title}
                  onClick={onClick}
                  disabled={disabled}
                  style={{
                    ...menuButtonStyle(),
                    width: '32px',
                    minWidth: '32px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0',
                    marginBottom: 0,
                    flex: '1 1 0',
                    maxWidth: '32px',
                    color: danger ? 'var(--app-danger)' : undefined,
                  }}
                >
                  <Icon size={15} weight={isFavoriteAction ? favoriteWeight : 'bold'} />
                </Button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="menu-item"
            onClick={() => {
              onOpenCreateView?.();
              setIsOpen(false);
            }}
            style={menuButtonStyle()}
          >
            New View
          </Button>

          <div
            style={{
              margin: '8px 0 4px',
              paddingTop: '4px',
              borderTop: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
            }}
          >
            <Button
              type="button"
              variant="menu-item"
              aria-expanded={openSubmenu === 'order'}
              onClick={() => toggleSubmenu('order')}
              style={submenuButtonStyle()}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Order</span>
              <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {openSubmenu === 'order' ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
              </span>
            </Button>

            {openSubmenu === 'order' && (
              <div style={{ display: 'grid', gap: '2px', paddingLeft: '8px', marginTop: '2px' }}>
                <Button
                  type="button"
                  variant="menu-item"
                  onClick={handleMoveUp}
                  style={menuButtonStyle()}
                  disabled={!activeView || !canMoveUp}
                >
                  Move Up
                </Button>

                <Button
                  type="button"
                  variant="menu-item"
                  onClick={handleMoveDown}
                  style={menuButtonStyle()}
                  disabled={!activeView || !canMoveDown}
                >
                  Move Down
                </Button>
              </div>
            )}
          </div>

          <div
            style={{
              margin: '8px 0 4px',
              paddingTop: '4px',
              borderTop: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
            }}
          >
            <Button
              type="button"
              variant="menu-item"
              aria-expanded={openSubmenu === 'state-options'}
              onClick={() => toggleSubmenu('state-options')}
              style={submenuButtonStyle()}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>State Options</span>
              <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {openSubmenu === 'state-options' ? (
                  <CaretDown size={12} weight="bold" />
                ) : (
                  <CaretRight size={12} weight="bold" />
                )}
              </span>
            </Button>

            {openSubmenu === 'state-options' && (
              <div style={{ display: 'grid', gap: '2px', paddingLeft: '8px', marginTop: '2px' }}>
                <Button
                  type="button"
                  variant="menu-item"
                  onClick={handleSaveBaseline}
                  style={menuButtonStyle()}
                  disabled={!activeView}
                >
                  Save View as Base View
                </Button>

                <Button
                  type="button"
                  variant="menu-item"
                  onClick={handleSaveCardState}
                  style={menuButtonStyle()}
                  disabled={!activeView}
                >
                  Save Card State
                </Button>

                <Button
                  type="button"
                  variant="menu-item"
                  onClick={() => setIsRestoreConfirmOpen(true)}
                  style={menuButtonStyle()}
                  disabled={!activeView || !hasSavedCardLocations}
                  title={hasSavedCardLocations ? 'Restore saved repository and branch card locations' : 'Save Card State first'}
                >
                  Restore Saved Card Locations
                </Button>

                {canUndoSavedCardLocationRestore && (
                  <Button
                    type="button"
                    variant="menu-item"
                    onClick={handleUndoRestore}
                    style={menuButtonStyle()}
                  >
                    Undo Restore
                  </Button>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              height: '1px',
              margin: '8px 4px',
              background: isDark ? '#27272a' : '#e2e8f0',
            }}
          />

          <Button
            type="button"
            variant="menu-item"
            onClick={() => {
              onOpenManager();
              setIsOpen(false);
            }}
            style={menuButtonStyle()}
          >
            Open View Manager
          </Button>

        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        title="Archive view"
        message={
          <>
            Archive view <strong>{activeView?.name ?? 'this view'}</strong>? The next view in order
            will become active. The saved layout will be kept for recovery.
          </>
        }
        confirmLabel="Archive view"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      <ConfirmationModal
        isOpen={isRestoreConfirmOpen}
        title="Restore saved card locations"
        message={
          <>
            Restore the saved repository and branch card locations for{' '}
            <strong>{activeView?.name ?? 'this view'}</strong>? The current card positions will be
            replaced. The viewport and card settings will not change.
          </>
        }
        confirmLabel="Restore locations"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRestoreConfirm}
        onCancel={() => setIsRestoreConfirmOpen(false)}
      />

      <TextInputModal
        isOpen={isRenameOpen && Boolean(activeView)}
        title="Rename view"
        description="Choose a new name for the current view."
        inputLabel="View name"
        inputValue={activeView?.name ?? ''}
        placeholder="View name"
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={handleRename}
        onCancel={() => setIsRenameOpen(false)}
      />
    </div>
  );
}

function menuButtonStyle() {
  return {
    width: '100%',
    textAlign: 'left' as const,
    justifyContent: 'flex-start' as const,
    marginBottom: '2px',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '7px 8px',
  };
}
