export type WorkspaceScopeRecord = {
  id: string;
  display_name: string;
  alias_name?: string | null;
  available_branches: string[];
};

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
