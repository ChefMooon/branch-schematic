import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import type { QuickFilterMetadata } from '../../../types/git';

type WorkspaceQuickFiltersProps = {
  metadata: QuickFilterMetadata | null;
  groupOptions?: string[];
  selectedTagIds: string[];
  selectedGroup: string | null;
  favoritesOnly: boolean;
  onToggleTag: (tagId: string) => void;
  onGroupChange: (group: string | null) => void;
  onFavoritesToggle: () => void;
  onCleanupDanglingTags?: () => Promise<number>;
};

export function WorkspaceQuickFilters({
  metadata,
  groupOptions = [],
  selectedTagIds,
  selectedGroup,
  favoritesOnly,
  onToggleTag,
  onGroupChange,
  onFavoritesToggle,
  onCleanupDanglingTags,
}: WorkspaceQuickFiltersProps) {
  const { addToast } = useNotifications();
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const groupSelectRef = useRef<HTMLSelectElement>(null);
  const availableGroupOptions = (metadata?.groups?.length ? metadata.groups : groupOptions) ?? [];
  const hasTags = (metadata?.tags?.length ?? 0) > 0;
  const favoritesCount = metadata?.favorites_count ?? 0;
  const danglingTags = metadata?.dangling_tags ?? [];
  const tagOptions = metadata?.tags ?? [];

  const handleGroupFilterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const select = groupSelectRef.current;
    if (!select) return;

    if (document.activeElement === select) {
      select.blur();
      return;
    }

    select.focus();

    try {
      if (typeof select.showPicker === 'function') {
        void select.showPicker();
      } else {
        select.click();
      }
    } catch {
      select.click();
    }
  };

  const handleCleanupConfirm = async () => {
    setIsCleanupConfirmOpen(false);

    if (!onCleanupDanglingTags) {
      addToast({
        variant: 'warning',
        title: 'Cleanup unavailable',
        message: 'Dangling tag cleanup is not available right now.',
      });
      return;
    }

    setIsCleaningUp(true);
    try {
      const removed = await onCleanupDanglingTags();
      addToast({
        variant: removed > 0 ? 'success' : 'info',
        title: removed > 0 ? 'Dangling tags cleaned up' : 'No dangling tags to clean up',
        message: removed > 0 ? `${removed} unused tags removed.` : 'No dangling tags needed cleanup.',
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'The cleanup could not be completed.',
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <>
      <div className="workspace-quick-filters">
        <button
          type="button"
          className={`quick-filter-chip ${favoritesOnly ? 'active' : ''}`}
          onClick={onFavoritesToggle}
        >
          Favorites ({favoritesCount})
        </button>

        <div
          className="dashboard-select-wrapper quick-filter-group-select-wrapper"
          onPointerDown={handleGroupFilterPointerDown}
        >
          <select
            ref={groupSelectRef}
            className="dashboard-select quick-filter-group-select"
            value={selectedGroup ?? ''}
            onChange={(event) => onGroupChange(event.target.value || null)}
          >
            <option value="">All Groups</option>
            {availableGroupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <CaretDown size={14} className="dashboard-select-icon" />
        </div>

        {danglingTags.length > 0 && (
          <div className="quick-filter-dangling">
            <div className="quick-filter-dangling__content">
              <span className="quick-filter-dangling__text">
                Dangling tags: {danglingTags.map((tag) => tag.tag_name).join(', ')}
              </span>
              <button
                type="button"
                className="quick-filter-dangling__action"
                onClick={() => setIsCleanupConfirmOpen(true)}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? 'Cleaning…' : 'Clean up'}
              </button>
            </div>
          </div>
        )}

      {hasTags && (
        <div className="quick-filter-tags-row">
          {tagOptions.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={`quick-filter-tag ${active ? 'active' : ''}`}
                style={{
                  borderColor: tag.color_hex,
                  backgroundColor: active ? `${tag.color_hex}22` : 'transparent',
                }}
                onClick={() => onToggleTag(tag.id)}
              >
                <span className="quick-filter-tag-dot" style={{ backgroundColor: tag.color_hex }} />
                {tag.tag_name} ({tag.repo_count})
              </button>
            );
          })}
        </div>
      )}

    </div>

      <ConfirmationModal
        isOpen={isCleanupConfirmOpen}
        title="Cleanup unused tags"
        message={
          <>
            Remove dangling tags that are no longer associated with any repositories? This action cannot be undone.
          </>
        }
        confirmLabel="Cleanup tags"
        cancelLabel="Cancel"
        variant="danger"
        isBusy={isCleaningUp}
        onConfirm={() => {
          void handleCleanupConfirm();
        }}
        onCancel={() => setIsCleanupConfirmOpen(false)}
      />
    </>
  );
}
