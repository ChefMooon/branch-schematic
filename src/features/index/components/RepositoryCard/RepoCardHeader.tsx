import { PencilSimple, Star, Trash } from '@phosphor-icons/react';
import type { TrackedPath } from '../../../../types/git';
import { AliasEditPopover } from './AliasEditPopover';

type RepoCardHeaderProps = {
  repo: TrackedPath;
  originType: 'OWNED' | 'FORK' | 'LOCAL_ONLY';
  isEditingAlias: boolean;
  aliasInput: string;
  isAnyLoading: boolean;
  onAliasInputChange: (value: string) => void;
  onStartEditing: () => void;
  onSaveAlias: () => Promise<void>;
  onResetAlias: () => void;
  onStopEditing: () => void;
  onUntrack: (event: React.MouseEvent) => void;
  onFavoriteToggle: () => void;
};

export function RepoCardHeader({
  repo,
  originType,
  isEditingAlias,
  aliasInput,
  isAnyLoading,
  onAliasInputChange,
  onStartEditing,
  onSaveAlias,
  onResetAlias,
  onStopEditing,
  onUntrack,
  onFavoriteToggle,
}: RepoCardHeaderProps) {
  const isFavorite = (repo.is_favorite ?? 0) === 1;
  const primaryTitle = repo.alias_name || repo.display_name;

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
    </div>
  );
}
