import { Archive, ArrowCounterClockwise, ArrowDown, ArrowUp, CaretDown, CaretRight, CopySimple, PencilSimple, Star, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { Button } from '../../../components/button/Button';
import './canvasViews.css';

type ViewManagerSidebarProps = {
  views: CanvasViewRecord[];
  archivedViews?: CanvasViewRecord[];
  selectedViewId: string | null;
  onSelect: (viewId: string) => void;
  onCreate: () => void;
  onDuplicate: (view: CanvasViewRecord) => void;
  onRename: (view: CanvasViewRecord) => void;
  onDelete: (view: CanvasViewRecord) => void;
  onRestore?: (view: CanvasViewRecord) => void;
  onPurge?: (view: CanvasViewRecord) => void;
  onToggleFavorite: (viewId: string, favorite: boolean) => Promise<void>;
  onMoveUp: (viewId: string) => Promise<void>;
  onMoveDown: (viewId: string) => Promise<void>;
};

export function ViewManagerSidebar({
  views,
  archivedViews = [],
  selectedViewId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  onRestore = () => undefined,
  onPurge = () => undefined,
  onToggleFavorite,
  onMoveUp,
  onMoveDown,
}: ViewManagerSidebarProps) {
  const canDelete = views.length > 1;
  const [isArchiveSectionOpen, setIsArchiveSectionOpen] = useState(false);
  const archivedViewCountLabel = `${archivedViews.length} ${archivedViews.length === 1 ? 'view' : 'views'}`;

  return (
    <aside className="canvas-view-manager__sidebar">
      <div className="canvas-view-manager__sidebar-header">
        <Button type="button" variant="submit" className="canvas-view-manager__create-button" onClick={onCreate}>
          Create view
        </Button>
        <p className="canvas-view-manager__selected-label">
          Selected: {views.find((view) => view.id === selectedViewId)?.name ?? 'None'}
        </p>
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
                  <span className="canvas-view-manager__view-name" title={view.name}>{view.name}</span>
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
                  title={canDelete ? `Archive ${view.name}` : 'At least one view must remain'}
                  aria-label={canDelete ? `Archive ${view.name}` : 'Archive unavailable because this is the only view'}
                >
                  <Trash size={15} weight="bold" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <section
        className={`canvas-view-manager__archive-section${isArchiveSectionOpen ? ' is-open' : ' is-collapsed'}`}
        aria-labelledby="archived-views-title"
      >
        <button
          type="button"
          className="canvas-view-manager__archive-heading"
          aria-expanded={isArchiveSectionOpen}
          aria-controls="archived-views-panel"
          onClick={() => setIsArchiveSectionOpen((open) => !open)}
        >
          <Archive size={16} weight="bold" />
          <span className="canvas-view-manager__archive-label">
            <span id="archived-views-title">Archived views</span>
            <span className="canvas-view-manager__archive-count">{archivedViewCountLabel}</span>
          </span>
          <span className="canvas-view-manager__archive-chevron" aria-hidden="true">
            {isArchiveSectionOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
          </span>
        </button>
        {isArchiveSectionOpen && (
          <div id="archived-views-panel" className="canvas-view-manager__archive-panel">
            {archivedViews.length === 0 ? (
              <p className="canvas-view-manager__empty">No archived views.</p>
            ) : (
              <div className="canvas-view-manager__archived-list">
                {archivedViews.map((view) => (
                  <div className="canvas-view-manager__archived-row" key={view.id}>
                    <span className="canvas-view-manager__view-name" title={view.name}>{view.name}</span>
                    <div className="canvas-view-manager__view-actions" aria-label={`Archive actions for ${view.name}`}>
                      <Button type="button" variant="basic" className="canvas-view-manager__icon-button" onClick={() => onRestore(view)} title={`Restore ${view.name}`} aria-label={`Restore ${view.name}`}>
                        <ArrowCounterClockwise size={15} weight="bold" />
                      </Button>
                      <Button type="button" variant="danger" className="canvas-view-manager__icon-button is-danger" onClick={() => onPurge(view)} title={`Permanently purge ${view.name}`} aria-label={`Permanently purge ${view.name}`}>
                        <Trash size={15} weight="bold" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

    </aside>
  );
}
