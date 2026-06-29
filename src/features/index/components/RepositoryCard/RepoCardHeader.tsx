import { useEffect, useRef, useState } from 'react';
import { PencilSimple, Star, Trash } from '@phosphor-icons/react';
import type { GroupSummary, TrackedPath } from '../../../../types/git';
import { AliasEditPopover } from '../../../repositories/components/RepositoryCard/AliasEditPopover';

type RepoCardHeaderProps = {
  repo: TrackedPath;
  originType: 'OWNED' | 'FORK' | 'LOCAL_ONLY';
  isEditingAlias: boolean;
  aliasInput: string;
  isAnyLoading: boolean;
  availableGroups: GroupSummary[];
  onAliasInputChange: (value: string) => void;
  onStartEditing: () => void;
  onSaveAlias: () => Promise<void>;
  onResetAlias: () => void;
  onStopEditing: () => void;
  onUntrack: (event: React.MouseEvent) => void;
  onFavoriteToggle: () => void;
  onGroupChange: (groupId: string | null) => void;
  onCreateGroup: () => void;
  onOpenManagement: () => void;
};

export function RepoCardHeader({
  repo,
  originType,
  isEditingAlias,
  aliasInput,
  isAnyLoading,
  availableGroups,
  onAliasInputChange,
  onStartEditing,
  onSaveAlias,
  onResetAlias,
  onStopEditing,
  onUntrack,
  onFavoriteToggle,
  onGroupChange,
  onCreateGroup,
  onOpenManagement,
}: RepoCardHeaderProps) {
  const isFavorite = (repo.is_favorite ?? 0) === 1;
  const groupLabel = repo.custom_group ?? 'No Group';
  const primaryTitle = repo.alias_name || repo.display_name;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const handleGroupSelect = (groupId: string | null) => {
    onGroupChange(groupId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="repo-meta-details">
      <div className="repo-title-row">
        <div className="repo-title-shell">
          <div className="repo-title-inline-row" title="Double click to add alias context">
            <h3 onDoubleClick={onStartEditing} title={primaryTitle}>{primaryTitle}</h3>
            <button type="button" className="repo-card-action-button is-muted" onClick={onStartEditing}>
              <PencilSimple size={14} />
            </button>
          </div>
          <AliasEditPopover
            isOpen={isEditingAlias}
            value={aliasInput}
            isBusy={isAnyLoading}
            hasAlias={Boolean(repo.alias_name)}
            onChange={onAliasInputChange}
            onSave={() => {
              void onSaveAlias();
            }}
            onCancel={onStopEditing}
            onReset={onResetAlias}
          />
        </div>

        <div className="repo-title-actions">
          <button
            type="button"
            onClick={onFavoriteToggle}
            className={`favorite-toggle repo-card-action-button ${isFavorite ? 'active' : ''}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <Star size={16} weight="fill" className="favorite-star-icon" />
            ) : (
              <Star size={16} weight="regular" className="favorite-star-icon" />
            )}
          </button>
          <span className="badge-origin-type">{originType.replace('_', ' ')}</span>
          <button
            type="button"
            onClick={onUntrack}
            className="repo-card-action-button is-danger"
            title="Untrack Repository"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      {repo.alias_name ? (
        <span className="repo-title-alias" title={repo.display_name}>{repo.display_name}</span>
      ) : null}

      <span className="repo-absolute-path" title={repo.absolute_path}>
        {repo.absolute_path}
      </span>

      <div className="repo-group-menu" ref={dropdownRef}>
        <div className="repo-group-badge-row">
          <button
            type="button"
            className="repo-group-badge"
            style={{ borderColor: availableGroups.find((group) => group.id === repo.group_id)?.color_hex ?? '#cbd5e1' }}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
          >
            {groupLabel}
          </button>
          {repo.group_id ? (
            <button
              type="button"
              className="repo-group-clear"
              onClick={(event) => {
                event.stopPropagation();
                handleGroupSelect(null);
              }}
              title="Remove group"
            >
              ×
            </button>
          ) : null}
        </div>
        {isDropdownOpen ? (
          <div className="repo-group-menu-panel" role="menu">
            <div className="repo-group-menu-panel-marker" aria-hidden="true" />
            <button type="button" className="repo-group-menu-item" onClick={() => handleGroupSelect(null)}>
              No Group
            </button>
            {availableGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`repo-group-menu-item ${repo.group_id === group.id ? 'active' : ''}`}
                onClick={() => handleGroupSelect(group.id)}
              >
                <span className="repo-tag-dot" style={{ backgroundColor: group.color_hex }} />
                {group.group_name}
              </button>
            ))}
            <button type="button" className="repo-group-menu-item" onClick={() => { setIsDropdownOpen(false); onCreateGroup(); }}>
              + Create Group
            </button>
            <button type="button" className="repo-group-menu-item" onClick={() => { setIsDropdownOpen(false); onOpenManagement(); }}>
              Manage Tags and Groups
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
