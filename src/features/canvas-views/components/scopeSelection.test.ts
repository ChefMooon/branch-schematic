import { describe, expect, it } from 'vitest';
import {
  getRepositoryBranchSelection,
  getRepositorySelectionState,
  normalizeSelectedBranches,
} from './scopeSelection';

const repository = {
  id: 'repo-1',
  display_name: 'Branch Schematic',
  available_branches: ['main', 'feature/ui'],
};

describe('scope selection helpers', () => {
  it('treats a repository with every branch selected as checked', () => {
    expect(getRepositorySelectionState(repository, ['main', 'feature/ui'], true)).toBe('checked');
  });
  
  it('reports unchecked when the repository path is hidden', () => {
    expect(getRepositorySelectionState(repository, ['main', 'feature/ui'], false)).toBe('unchecked');
  });

  it('treats a repository with some branches selected as mixed', () => {
    expect(getRepositorySelectionState(repository, ['main'], true)).toBe('mixed');
  });

  it('treats a repository with no branches selected as unchecked', () => {
    expect(getRepositorySelectionState(repository, [], true)).toBe('unchecked');
  });

  it('uses repository visibility for repositories without branches', () => {
    const emptyRepository = { ...repository, available_branches: [] };
    expect(getRepositorySelectionState(emptyRepository, [], true)).toBe('checked');
    expect(getRepositorySelectionState(emptyRepository, [], false)).toBe('unchecked');
  });

  it('returns all available branches when a repository is selected', () => {
    expect(getRepositoryBranchSelection(repository, true)).toEqual(['main', 'feature/ui']);
    expect(getRepositoryBranchSelection(repository, false)).toEqual([]);
  });

  it('removes duplicate and stale branch names', () => {
    expect(normalizeSelectedBranches(repository, ['main', 'main', 'missing'])).toEqual(['main']);
  });
});
