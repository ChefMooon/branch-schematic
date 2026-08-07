export type WorkspaceScopeTag = {
  id: string;
  tag_name: string;
  color_hex: string;
};

export type WorkspaceScopeRecord = {
  id: string;
  display_name: string;
  alias_name?: string | null;
  available_branches: string[];
  custom_group?: string | null;
  tags?: WorkspaceScopeTag[];
};

export type RawWorkspaceScopeRecord = Omit<WorkspaceScopeRecord, 'tags'> & {
  tags?: WorkspaceScopeTag[];
  tags_json?: unknown;
};

function parseScopeTags(tagsJson: unknown): WorkspaceScopeTag[] {
  if (typeof tagsJson !== 'string' || tagsJson.trim().length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is WorkspaceScopeTag => Boolean(
        entry
        && typeof entry === 'object'
        && typeof (entry as WorkspaceScopeTag).id === 'string'
        && typeof (entry as WorkspaceScopeTag).tag_name === 'string'
        && typeof (entry as WorkspaceScopeTag).color_hex === 'string',
      ))
      .map(({ id, tag_name, color_hex }) => ({ id, tag_name, color_hex }))
      .sort((left, right) => left.tag_name.localeCompare(right.tag_name, undefined, { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

export function normalizeWorkspaceScopeRecords(rows: RawWorkspaceScopeRecord[]): WorkspaceScopeRecord[] {
  return rows.map((row) => ({
    id: row.id,
    display_name: row.display_name,
    alias_name: row.alias_name,
    available_branches: row.available_branches ?? [],
    custom_group: row.custom_group ?? null,
    tags: Array.isArray(row.tags) ? row.tags : parseScopeTags(row.tags_json),
  }));
}

export type RepositorySelectionState = 'checked' | 'mixed' | 'unchecked';

export function getRepositorySelectionState(
  repository: WorkspaceScopeRecord,
  selectedBranches: string[],
  repositoryVisible: boolean,
): RepositorySelectionState {
  const availableBranches = repository.available_branches ?? [];
  
  if (!repositoryVisible) return 'unchecked';

  if (availableBranches.length === 0) {
    return repositoryVisible ? 'checked' : 'unchecked';
  }

  const selectedBranchSet = new Set(selectedBranches);
  const selectedCount = availableBranches.filter((branchName) => selectedBranchSet.has(branchName)).length;

  if (selectedCount === 0) return 'unchecked';
  if (selectedCount === availableBranches.length) return 'checked';
  return 'mixed';
}

export function normalizeSelectedBranches(
  repository: WorkspaceScopeRecord,
  selectedBranches: string[],
): string[] {
  const availableBranches = new Set(repository.available_branches ?? []);
  return [...new Set(selectedBranches)].filter((branchName) => availableBranches.has(branchName));
}

export function getRepositoryBranchSelection(
  repository: WorkspaceScopeRecord,
  checked: boolean,
): string[] {
  return checked ? [...(repository.available_branches ?? [])] : [];
}
