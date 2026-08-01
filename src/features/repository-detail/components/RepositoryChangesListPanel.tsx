import { GitBranch, WarningCircle } from '@phosphor-icons/react';
import type { RepositoryChangeItem, RepositoryChangesSnapshot, TrackedPath } from '../../../types/git';
import { CHANGE_GROUPS, type ChangeGroupKey, type GroupedChanges } from '../types/repositoryChanges';
import { RepositoryChangeGroup } from './RepositoryChangeGroup';

interface RepositoryChangesListPanelProps {
  repo: TrackedPath | null;
  splitRatio: number;
  isLoading: boolean;
  error: string | null;
  snapshot: RepositoryChangesSnapshot | null;
  statusMessage: string | null;
  groupedChanges: GroupedChanges;
  expandedGroups: Record<ChangeGroupKey, boolean>;
  selectedEntry: RepositoryChangeItem | null;
  onToggleGroup: (group: ChangeGroupKey) => void;
  onSelectPath: (path: string) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  children: React.ReactNode;
}

export function RepositoryChangesListPanel({
  repo,
  splitRatio,
  isLoading,
  error,
  snapshot,
  statusMessage,
  groupedChanges,
  expandedGroups,
  selectedEntry,
  onToggleGroup,
  onSelectPath,
  onStage,
  onUnstage,
  children,
}: RepositoryChangesListPanelProps) {
  return (
    <div
      className="repository-view-changes-panel repository-view-changes-panel--list"
      style={{ flexBasis: `${splitRatio * 100}%` }}
    >
      <div className="repository-view-changes-panel-header">
        <div>
          <p className="repository-view-eyebrow">Local changes</p>
          <h3>Changes workspace</h3>
        </div>
        <div className="repository-view-changes-header-actions">
          <div className="repository-view-changes-pill">
            <GitBranch size={14} weight="fill" />
            {repo?.current_branch ?? 'main'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="repository-view-empty-state">Loading repository changes…</div>
      ) : error ? (
        <div className="repository-view-empty-state repository-view-empty-state--error">{error}</div>
      ) : !snapshot ? (
        <div className="repository-view-empty-state">No change snapshot available yet.</div>
      ) : (
        <>
          <div className="repository-view-changes-scroll-region">
            {statusMessage ? (
              <div className="repository-view-status-banner">
                <WarningCircle size={14} />
                <span>{statusMessage}</span>
              </div>
            ) : null}

            <div className="repository-view-changes-groups" role="list">
              {CHANGE_GROUPS.map((group) => (
                <RepositoryChangeGroup
                  key={group}
                  group={group}
                  entries={groupedChanges[group]}
                  isExpanded={expandedGroups[group]}
                  selectedPath={selectedEntry?.path ?? null}
                  onToggle={onToggleGroup}
                  onSelectPath={onSelectPath}
                  onStage={onStage}
                  onUnstage={onUnstage}
                />
              ))}
            </div>
          </div>

          {children}
        </>
      )}
    </div>
  );
}
