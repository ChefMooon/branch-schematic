import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { TextInputModal } from '../../../components/Modal/TextInputModal';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { useCanvasStore, sortCanvasViews, type CanvasViewRecord } from '../../../stores/canvas-store';
import { ViewManagerSidebar } from './ViewManagerSidebar';
import { ViewDetailsConfigurator } from './ViewDetailsConfigurator';
import './canvasViews.css';

type ViewManagerModalProps = {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
};

type InputDialogState = {
  mode: 'create' | 'rename' | 'duplicate';
  title: string;
  description: string;
  inputLabel: string;
  confirmLabel: string;
  value: string;
  viewId?: string;
};

export function ViewManagerModal({ isDark, isOpen, onClose }: ViewManagerModalProps) {
  const views = useCanvasStore((state) => state.views);
  const archivedViews = useCanvasStore((state) => state.archivedViews);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const setActiveView = useCanvasStore((state) => state.setActiveView);
  const deleteView = useCanvasStore((state) => state.deleteView);
  const hydrateArchivedViews = useCanvasStore((state) => state.hydrateArchivedViews);
  const restoreView = useCanvasStore((state) => state.restoreView);
  const purgeView = useCanvasStore((state) => state.purgeView);
  const renameView = useCanvasStore((state) => state.renameView);
  const duplicateView = useCanvasStore((state) => state.duplicateView);
  const createNewView = useCanvasStore((state) => state.createNewView);
  const setViewFavorite = useCanvasStore((state) => state.setViewFavorite);
  const moveViewOrder = useCanvasStore((state) => state.moveViewOrder);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(activeViewId);
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null);
  const [viewToDelete, setViewToDelete] = useState<CanvasViewRecord | null>(null);
  const [viewToPurge, setViewToPurge] = useState<CanvasViewRecord | null>(null);

  const backdropDismiss = useBackdropDismiss(dialogRef, onClose, isOpen);
  const orderedViews = useMemo(() => sortCanvasViews(views), [views]);
  const selectedView = orderedViews.find((view) => view.id === selectedViewId) ?? null;

  useEffect(() => {
    if (!isOpen) return;

    void hydrateArchivedViews();

    if (activeViewId && views.some((view) => view.id === activeViewId)) {
      setSelectedViewId(activeViewId);
      return;
    }

    setSelectedViewId(orderedViews[0]?.id ?? null);
  }, [activeViewId, isOpen, orderedViews, views]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (inputDialog || viewToDelete || viewToPurge) return;
      onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputDialog, isOpen, onClose, viewToDelete, viewToPurge]);

  if (!isOpen) return null;

  const handleCreate = () => {
    setInputDialog({
      mode: 'create',
      title: 'Create view',
      description: 'Add a named canvas environment with the current repository scope defaults.',
      inputLabel: 'View name',
      confirmLabel: 'Create view',
      value: '',
    });
  };

  const handleRename = (view: CanvasViewRecord) => {
    setInputDialog({
      mode: 'rename',
      title: 'Rename view',
      description: 'Choose a clear name for this saved canvas environment.',
      inputLabel: 'View name',
      confirmLabel: 'Save name',
      value: view.name,
      viewId: view.id,
    });
  };

  const handleDuplicate = (view: CanvasViewRecord) => {
    setInputDialog({
      mode: 'duplicate',
      title: 'Duplicate view',
      description: 'Create a copy of this view, including its scope and viewport settings.',
      inputLabel: 'New view name',
      confirmLabel: 'Duplicate view',
      value: `${view.name} Copy`,
      viewId: view.id,
    });
  };

  const handleInputConfirm = async (value: string) => {
    if (!inputDialog) return;

    if (inputDialog.mode === 'create') {
      await createNewView({ name: value });
    } else if (inputDialog.mode === 'rename' && inputDialog.viewId) {
      await renameView(inputDialog.viewId, value);
    } else if (inputDialog.mode === 'duplicate' && inputDialog.viewId) {
      await duplicateView(inputDialog.viewId, value);
    }

    setInputDialog(null);
  };

  const handleDeleteConfirm = async () => {
    if (!viewToDelete || views.length <= 1) return;

    await deleteView(viewToDelete.id);
    setViewToDelete(null);

    const nextViews = sortCanvasViews(useCanvasStore.getState().views);
    setSelectedViewId(nextViews[0]?.id ?? null);
  };

  const handleSelect = async (viewId: string) => {
    setSelectedViewId(viewId);
    await setActiveView(viewId);
  };

  const handleRestore = async (view: CanvasViewRecord) => {
    await restoreView(view.id);
  };

  const handlePurgeConfirm = async () => {
    if (!viewToPurge) return;
    await purgeView(viewToPurge.id);
    setViewToPurge(null);
  };

  return (
    <>
      <div
        className="canvas-view-manager-overlay"
        onMouseDown={backdropDismiss.handleMouseDown}
        onMouseUp={backdropDismiss.handleMouseUp}
        onMouseLeave={backdropDismiss.handleMouseLeave}
        onTouchStart={backdropDismiss.handleTouchStart}
        onTouchEnd={backdropDismiss.handleTouchEnd}
      >
        <div
          ref={dialogRef}
          className="canvas-view-manager"
          role="dialog"
          aria-modal="true"
          aria-labelledby="canvas-view-manager-title"
          data-theme-mode={isDark ? 'dark' : 'light'}
        >
          <header className="canvas-view-manager__header">
            <div>
              <h1 className="canvas-view-manager__title" id="canvas-view-manager-title">View Manager</h1>
              <p className="canvas-view-manager__description">
                Organize saved canvases, baseline viewports, and the repositories or branches each environment shows.
              </p>
            </div>
            <Button type="button" variant="close" onClick={onClose} aria-label="Close view manager" title="Close">
              <X size={17} weight="bold" />
            </Button>
          </header>

          <div className="canvas-view-manager__body">
            <ViewManagerSidebar
              views={orderedViews}
              archivedViews={archivedViews}
              selectedViewId={selectedViewId}
              onSelect={(viewId) => void handleSelect(viewId)}
              onCreate={handleCreate}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={setViewToDelete}
              onRestore={(view) => void handleRestore(view)}
              onPurge={setViewToPurge}
              onToggleFavorite={(viewId, favorite) => setViewFavorite(viewId, favorite)}
              onMoveUp={(viewId) => moveViewOrder(viewId, -1)}
              onMoveDown={(viewId) => moveViewOrder(viewId, 1)}
            />
            <ViewDetailsConfigurator isDark={isDark} view={selectedView} />
          </div>
        </div>
      </div>

      <TextInputModal
        isOpen={inputDialog !== null}
        title={inputDialog?.title ?? ''}
        description={inputDialog?.description}
        inputLabel={inputDialog?.inputLabel}
        inputValue={inputDialog?.value ?? ''}
        confirmLabel={inputDialog?.confirmLabel}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputDialog(null)}
      />

      <ConfirmationModal
        isOpen={viewToDelete !== null}
        title="Archive view?"
        message={viewToDelete ? `Archive “${viewToDelete.name}”? The saved environment and its layout will be kept for recovery.` : null}
        confirmLabel="Archive view"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setViewToDelete(null)}
      />

      <ConfirmationModal
        isOpen={viewToPurge !== null}
        title="Permanently purge view?"
        message={viewToPurge ? `Permanently purge “${viewToPurge.name}”? Its saved layout and history will be removed and cannot be recovered.` : null}
        confirmLabel="Permanently purge"
        variant="danger"
        onConfirm={handlePurgeConfirm}
        onCancel={() => setViewToPurge(null)}
      />
    </>
  );
}
