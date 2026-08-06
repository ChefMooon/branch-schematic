import { ArrowDown, ArrowUp, CopySimple, PencilSimple, Star, Trash } from '@phosphor-icons/react';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { Button } from '../../../components/button/Button';
import './canvasViews.css';

type ViewManagerSidebarProps = {
  views: CanvasViewRecord[];
  selectedViewId: string | null;
  onSelect: (viewId: string) => void;
  onCreate: () => void;
  onDuplicate: (view: CanvasViewRecord) => void;
  onRename: (view: CanvasViewRecord) => void;
  onDelete: (view: CanvasViewRecord) => void;
  onToggleFavorite: (viewId: string, favorite: boolean) => Promise<void>;
  onMoveUp: (viewId: string) => Promise<void>;
  onMoveDown: (viewId: string) => Promise<void>;
};

export function ViewManagerSidebar({
  views,
  selectedViewId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  onToggleFavorite,
  onMoveUp,
  onMoveDown,
}: ViewManagerSidebarProps) {
  const selectedView = views.find((view) => view.id === selectedViewId) ?? null;
  const canDelete = views.length > 1;

  return (
    <aside className="canvas-view-manager__sidebar">
      <div className="canvas-view-manager__sidebar-header">
        <Button type="button" variant="submit" className="canvas-view-manager__create-button" onClick={onCreate}>
          Create view
        </Button>
      </div>

      <div className="canvas-view-manager__view-list">
        {views.length === 0 && (
          <div className="canvas-view-manager__empty">No saved views are available.</div>
        )}

        {views.map((view, index) => {
          const selected = view.id === selectedViewId;
          const isFavorite = (view.is_favorite ?? 0) === 1;
          const canMoveUp = index > 0;
          const canMoveDown = index < views.length - 1;
          const zoom = (view.baseline_zoom ?? view.zoom_level).toFixed(2);

          return (
            <article
              className={`canvas-view-manager__view-card${selected ? ' is-selected' : ''}`}
              key={view.id}
              aria-current={selected ? 'true' : undefined}
              aria-label={`Open view ${view.name}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(view.id)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelect(view.id);
              }}
            >
              <div className="canvas-view-manager__view-card-header">
                <div className="canvas-view-manager__view-summary">
                  <span className="canvas-view-manager__view-name">{view.name}</span>
                  <span className="canvas-view-manager__view-meta">Baseline zoom {zoom}</span>
                </div>
                <Button
                  type="button"
                  variant="basic"
                  className={`canvas-view-manager__icon-button${isFavorite ? ' is-favorite' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onToggleFavorite(view.id, !isFavorite);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  title={isFavorite ? `Remove ${view.name} from favorites` : `Favorite ${view.name}`}
                  aria-label={isFavorite ? `Remove ${view.name} from favorites` : `Favorite ${view.name}`}
                  aria-pressed={isFavorite}
                >
                  <Star size={16} weight={isFavorite ? 'fill' : 'regular'} />
                </Button>
              </div>

              <div
                className="canvas-view-manager__view-actions"
                aria-label={`Actions for ${view.name}`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="basic"
                  className="canvas-view-manager__icon-button"
                  onClick={() => void onMoveUp(view.id)}
                  disabled={!canMoveUp}
                  title={`Move ${view.name} up`}
                  aria-label={`Move ${view.name} up`}
                >
                  <ArrowUp size={15} weight="bold" />
                </Button>
                <Button
                  type="button"
                  variant="basic"
                  className="canvas-view-manager__icon-button"
                  onClick={() => void onMoveDown(view.id)}
                  disabled={!canMoveDown}
                  title={`Move ${view.name} down`}
                  aria-label={`Move ${view.name} down`}
                >
                  <ArrowDown size={15} weight="bold" />
                </Button>
                <Button
                  type="button"
                  variant="basic"
                  className="canvas-view-manager__icon-button"
                  onClick={() => onDuplicate(view)}
                  title={`Duplicate ${view.name}`}
                  aria-label={`Duplicate ${view.name}`}
                >
                  <CopySimple size={15} weight="bold" />
                </Button>
                <Button
                  type="button"
                  variant="basic"
                  className="canvas-view-manager__icon-button"
                  onClick={() => onRename(view)}
                  title={`Rename ${view.name}`}
                  aria-label={`Rename ${view.name}`}
                >
                  <PencilSimple size={15} weight="bold" />
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="canvas-view-manager__icon-button is-danger"
                  onClick={() => onDelete(view)}
                  disabled={!canDelete}
                  title={canDelete ? `Delete ${view.name}` : 'At least one view must remain'}
                  aria-label={canDelete ? `Delete ${view.name}` : 'Delete unavailable because this is the only view'}
                >
                  <Trash size={15} weight="bold" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {selectedView && (
        <div className="canvas-view-manager__sidebar-footer">
          <span className="canvas-view-manager__active-label">Selected: {selectedView.name}</span>
        </div>
      )}
    </aside>
  );
}
