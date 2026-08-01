import type { RepositoryChangeItem } from '../../../types/git';

export const CHANGE_GROUPS = ['staged', 'changes', 'untracked', 'conflicts'] as const;

export type ChangeGroupKey = (typeof CHANGE_GROUPS)[number];

export type GroupedChanges = Record<ChangeGroupKey, RepositoryChangeItem[]>;

export function formatStatusLabel(status: RepositoryChangeItem['status']) {
  switch (status) {
    case 'added':
      return 'added';
    case 'deleted':
      return 'deleted';
    case 'renamed':
      return 'renamed';
    case 'conflicted':
      return 'conflicted';
    case 'untracked':
      return 'untracked';
    default:
      return 'modified';
  }
}

export function getGroupTitle(group: ChangeGroupKey) {
  switch (group) {
    case 'staged':
      return 'Staged changes';
    case 'changes':
      return 'Changes';
    case 'untracked':
      return 'Untracked files';
    default:
      return 'Conflicts';
  }
}

export function groupChanges(entries: RepositoryChangeItem[] | undefined): GroupedChanges {
  const groups: GroupedChanges = {
    staged: [],
    changes: [],
    untracked: [],
    conflicts: [],
  };

  entries?.forEach((entry) => {
    if (entry.isConflicted || entry.status === 'conflicted') {
      groups.conflicts.push(entry);
    } else if (entry.status === 'untracked') {
      groups.untracked.push(entry);
    } else if (entry.staged) {
      groups.staged.push(entry);
    } else {
      groups.changes.push(entry);
    }
  });

  return groups;
}
