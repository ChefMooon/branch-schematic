import type { TrackedPath } from '../../../../types/git';
import { AliasEditPopover } from './AliasEditPopover';
import { RepoCardOverflowMenu } from './RepoCardActionMenu';

type RepoCardHeaderProps = {
  repo: TrackedPath;
  originType: 'OWNED' | 'FORK' | 'LOCAL_ONLY' | 'CONTRIBUTOR';
  isSelected?: boolean;
  onToggleSelection?: () => void;
  isEditingAlias: boolean;
  aliasInput: string;
  isAnyLoading: boolean;
  onAliasInputChange: (value: string) => void;
  onStartEditing: () => void;
  onSaveAlias: () => Promise<void>;
  onResetAlias: () => void;
  onStopEditing: () => void;
  onRefreshStatus: () => void | Promise<void>;
  onFetch: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onToggleFavorite: () => void | Promise<void>;
  onUntrack: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onThemeChange: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
};

export function RepoCardHeader({
  repo,
  originType,
  isSelected = false,
  onToggleSelection,
  isEditingAlias,
  aliasInput,
  isAnyLoading,
  onAliasInputChange,
  onStartEditing,
  onSaveAlias,
  onResetAlias,
  onStopEditing,
  onRefreshStatus,
  onFetch,
  onPull,
  onPush,
  onToggleFavorite,
  onUntrack,
  onThemeChange,
}: RepoCardHeaderProps) {
  const isFavorite = (repo.is_favorite ?? 0) === 1;
  const primaryTitle = repo.alias_name || repo.display_name;
  const formatOriginType = (value: string) => value === 'CONTRIBUTOR' ? 'Contributor' : value.replace('_', ' ');

  return (
    <div className="repo-meta-details">
      <div className="repo-title-row">
        <div className="repo-title-shell">
          <div className="repo-title-inline-row" title="Double click to add alias context">
            <h3 onDoubleClick={onStartEditing} title={primaryTitle}>{primaryTitle}</h3>
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
          <label className="repo-card-selection-control" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection?.()}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          </label>
          <RepoCardOverflowMenu
            isFavorite={isFavorite}
            isBusy={isAnyLoading}
            canUseRemoteActions={originType !== 'LOCAL_ONLY'}
            onRefreshStatus={onRefreshStatus}
            onFetch={onFetch}
            onPull={onPull}
            onPush={onPush}
            onRenameAlias={onStartEditing}
            onToggleFavorite={onToggleFavorite}
            onUntrack={onUntrack}
            currentThemeColor={repo.theme_color_hex ?? null}
            currentIconName={repo.icon_name ?? null}
            onThemeChange={onThemeChange}
          />
        </div>
      </div>

      {repo.alias_name ? (
        <span className="repo-title-alias" title={repo.display_name}>{repo.display_name}</span>
      ) : null}

      <div className="repo-path-row">
        <span className="repo-absolute-path" title={repo.absolute_path}>
          {repo.absolute_path}
        </span>
        <span className="badge-origin-type badge-origin-type-inline">{formatOriginType(originType)}</span>
      </div>
    </div>
  );
}
