import { useEffect, useMemo, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { ViewManagerSidebar } from './ViewManagerSidebar';
import { ViewDetailsConfigurator } from './ViewDetailsConfigurator';

function sortViews(views: ReturnType<typeof useCanvasStore.getState>['views']) {
  return [...views].sort((left, right) => {
    const favoriteDelta = (right.is_favorite ?? 0) - (left.is_favorite ?? 0);
    if (favoriteDelta !== 0) return favoriteDelta;

    const displayOrderDelta = (left.display_order ?? 0) - (right.display_order ?? 0);
    if (displayOrderDelta !== 0) return displayOrderDelta;

    return left.name.localeCompare(right.name);
  });
}

type ViewManagerModalProps = {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function ViewManagerModal({ isDark, isOpen, onClose }: ViewManagerModalProps) {
  const views = useCanvasStore((state) => state.views);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const setActiveView = useCanvasStore((state) => state.setActiveView);
  const deleteView = useCanvasStore((state) => state.deleteView);
  const renameView = useCanvasStore((state) => state.renameView);
  const duplicateView = useCanvasStore((state) => state.duplicateView);
  const createNewView = useCanvasStore((state) => state.createNewView);
  const setViewFavorite = useCanvasStore((state) => state.setViewFavorite);
  const moveViewOrder = useCanvasStore((state) => state.moveViewOrder);

  const [selectedViewId, setSelectedViewId] = useState<string | null>(activeViewId);

  useEffect(() => {
    if (!isOpen) return;
    if (activeViewId) {
      setSelectedViewId(activeViewId);
      return;
    }
    if (views.length > 0) {
      setSelectedViewId(views[0].id);
    }
  }, [isOpen, activeViewId, views]);

  const orderedViews = useMemo(() => sortViews(views), [views]);

  const selectedView = useMemo(
    () => orderedViews.find((view) => view.id === selectedViewId) ?? null,
    [orderedViews, selectedViewId],
  );

  if (!isOpen) return null;

  const handleCreate = async () => {
    const name = window.prompt('Enter a name for your new canvas view layer:');
    if (!name || !name.trim()) return;
    await createNewView(name.trim());
  };

  const handleSelect = async (viewId: string) => {
    setSelectedViewId(viewId);
    await setActiveView(viewId);
  };

  const handleDelete = async (view: { id: string; name: string }) => {
    if (!window.confirm(`Delete view "${view.name}"?`)) return;
    await deleteView(view.id);
    const remaining = views.filter((v) => v.id !== view.id);
    setSelectedViewId(remaining[0]?.id ?? null);
  };

  const handleDuplicate = async (view: { id: string; name: string }) => {
    const suggested = `${view.name} Copy`;
    const entered = window.prompt('Enter a name for the duplicated view:', suggested);
    if (!entered || !entered.trim()) return;
    await duplicateView(view.id, entered.trim());
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.52)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1100px, 96vw)',
          height: 'min(520px, 80vh)',
          borderRadius: 14,
          overflow: 'hidden',
          background: isDark ? '#0d0d0f' : '#ffffff',
          border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
          boxShadow: '0 30px 70px -30px rgba(15, 23, 42, 0.65)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${isDark ? '#262626' : '#e2e8f0'}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: isDark ? '#f5f5f5' : '#0f172a' }}>View Manager</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>
              Configure decoupled environments with baseline viewport and scoped visibility.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
            style={{
              border: 'none',
              background: 'transparent',
              color: isDark ? '#d4d4d8' : '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              width: 28,
              height: 28,
              borderRadius: 6,
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, clamp(220px, 30vw, 320px)) minmax(0, 1fr)',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <ViewManagerSidebar
            isDark={isDark}
            views={orderedViews}
            selectedViewId={selectedViewId}
            onSelect={(viewId) => void handleSelect(viewId)}
            onCreate={() => void handleCreate()}
            onRename={renameView}
            onDuplicate={(view) => void handleDuplicate(view)}
            onDelete={(view) => handleDelete(view)}
            onToggleFavorite={async (viewId, favorite) => {
              await setViewFavorite(viewId, favorite);
            }}
            onMoveUp={async (viewId) => {
              await moveViewOrder(viewId, -1);
            }}
            onMoveDown={async (viewId) => {
              await moveViewOrder(viewId, 1);
            }}
          />

          <ViewDetailsConfigurator isDark={isDark} view={selectedView} />
        </div>
      </div>
    </div>
  );
}
