import { useMemo, useState } from 'react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import type { QuickFilterMetadata } from '../../../types/git';
import { FilterDropdown } from './common/FilterDropdown';
import { useGroupOptions } from './common/useGroupOptions';

export const OWNER_GROUPING_FILTER_VALUE = '__group_by_owner__';

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
  const { options: fetchedGroupOptions } = useGroupOptions();
  const availableGroupOptions = (metadata?.groups?.length ? metadata.groups : groupOptions) ?? [];
  const hasTags = (metadata?.tags?.length ?? 0) > 0;
  const favoritesCount = metadata?.favorites_count ?? 0;
  const danglingTags = metadata?.dangling_tags ?? [];
  const tagOptions = metadata?.tags ?? [];

  const groupDropdownOptions = useMemo(() => {
    const ownerGroupingOption = {
      label: 'Group by owner',
      value: OWNER_GROUPING_FILTER_VALUE,
    };
    const fromHook = fetchedGroupOptions.map((option) => ({ label: option.label, value: option.value }));
    const fromMetadata = availableGroupOptions.map((group) => ({ label: group, value: group }));
    const merged = [ownerGroupingOption, ...fromHook, ...fromMetadata];
    const seen = new Set<string>();

    return merged.filter((option) => {
      if (!option.value || seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [availableGroupOptions, fetchedGroupOptions]);

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

        <FilterDropdown
          value={selectedGroup ?? null}
          options={groupDropdownOptions}
          onChange={(value) => onGroupChange(typeof value === 'string' ? value : null)}
          placeholder="All groups"
          aria-label="Filter by group"
          className="filter-dropdown-fixed"
        />

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
