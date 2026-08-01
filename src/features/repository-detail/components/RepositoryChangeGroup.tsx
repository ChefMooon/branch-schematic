import { CaretDown, CaretUp, Minus, Plus } from '@phosphor-icons/react';
import type { RepositoryChangeItem } from '../../../types/git';
import { formatStatusLabel, getGroupTitle, type ChangeGroupKey } from '../types/repositoryChanges';

interface RepositoryChangeGroupProps {
  group: ChangeGroupKey;
  entries: RepositoryChangeItem[];
  isExpanded: boolean;
  selectedPath: string | null;
  onToggle: (group: ChangeGroupKey) => void;
  onSelectPath: (path: string) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
}

export function RepositoryChangeGroup({
  group,
  entries,
  isExpanded,
  selectedPath,
  onToggle,
  onSelectPath,
  onStage,
  onUnstage,
}: RepositoryChangeGroupProps) {
  const actionLabel = group === 'changes'
    ? 'Stage all unstaged'
    : group === 'untracked'
      ? 'Add all untracked'
      : null;

  if (entries.length === 0) return null;

  return (
    <section className="repository-view-changes-group" aria-label={getGroupTitle(group)}>
      <div className="repository-view-changes-group-header">
        <button
          type="button"
          className="repository-view-changes-group-toggle"
          onClick={() => onToggle(group)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
          <span>{getGroupTitle(group)}</span>
          <span className="repository-view-changes-group-count">{entries.length}</span>
        </button>
        {actionLabel ? (
          <button type="button" className="repository-view-changes-inline-action" onClick={() => onStage(entries.map((entry) => entry.path))}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <ul className="repository-view-change-list">
          {entries.map((entry) => {
            const isSelected = selectedPath === entry.path;
            return (
              <li key={`${entry.path}-${entry.status}`} className="repository-view-change-item">
                <button
                  type="button"
                  className={`repository-view-change-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectPath(entry.path)}
                >
                  <div className="repository-view-change-details">
                    <span className="repository-view-change-path">{entry.path}</span>
                    <span className="repository-view-change-meta">
                      <span className={`repository-view-change-badge repository-view-change-badge--${entry.status}`}>
                        {formatStatusLabel(entry.status)}
                      </span>
                      {entry.staged ? <span className="repository-view-change-badge repository-view-change-badge--staged">staged</span> : null}
                      {entry.isBinary ? <span className="repository-view-change-badge repository-view-change-badge--binary">binary</span> : null}
                    </span>
                  </div>
                </button>
                <div className="repository-view-change-actions">
                  {entry.staged ? (
                    <button
                      type="button"
                      className="repository-view-change-action"
                      onClick={() => onUnstage([entry.path])}
                      aria-label="Unstage file"
                      title="Unstage file"
                    >
                      <Minus size={14} weight="bold" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="repository-view-change-action"
                      onClick={() => onStage([entry.path])}
                      aria-label="Stage file"
                      title="Stage file"
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
