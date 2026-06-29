import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CaretDown } from '@phosphor-icons/react';
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
}: WorkspaceQuickFiltersProps) {
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

  return (
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

      {danglingTags.length > 0 && (
        <div className="quick-filter-dangling">
          Dangling tags: {danglingTags.map((tag) => tag.tag_name).join(', ')}
        </div>
      )}
    </div>
  );
}
