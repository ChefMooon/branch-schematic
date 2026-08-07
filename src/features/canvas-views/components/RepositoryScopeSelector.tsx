import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { SearchBar } from '../../../components/search-bar/SearchBar';
import {
  getRepositoryBranchSelection,
  getRepositorySelectionState,
  normalizeSelectedBranches,
  type WorkspaceScopeRecord,
} from './scopeSelection';
import './canvasViews.css';

type RepositoryScopeSelectorProps = {
  repositories: WorkspaceScopeRecord[];
  repositoryVisibility: Record<string, boolean>;
  selectedBranches: Record<string, string[]>;
  expandedRepositories: Record<string, boolean>;
  busyRepositories?: Record<string, boolean>;
  onToggleRepository: (repositoryId: string, checked: boolean) => void;
  onToggleBranch: (repositoryId: string, branchName: string, checked: boolean) => void;
  onToggleExpansion: (repositoryId: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  bulkActionsDisabled?: boolean;
  emptyMessage?: string;
  scrollableList?: boolean;
};

function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      className="canvas-scope-selector__checkbox"
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-checked={indeterminate ? 'mixed' : checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export function RepositoryScopeSelector({
  repositories,
  repositoryVisibility,
  selectedBranches,
  expandedRepositories,
  busyRepositories = {},
  onToggleRepository,
  onToggleBranch,
  onToggleExpansion,
  onSelectAll,
  onClearAll,
  bulkActionsDisabled = false,
  emptyMessage = 'No tracked repositories available.',
  scrollableList = false,
}: RepositoryScopeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const orderedRepositories = useMemo(
    () => [...repositories].sort((left, right) => {
      const leftLabel = left.alias_name || left.display_name;
      const rightLabel = right.alias_name || right.display_name;
      return leftLabel.localeCompare(rightLabel);
    }),
    [repositories],
  );
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const groupOptions = useMemo(
    () => [...new Set(orderedRepositories.map((repository) => repository.custom_group).filter(Boolean))]
      .sort((left, right) => left!.localeCompare(right!, undefined, { sensitivity: 'base' })) as string[],
    [orderedRepositories],
  );
  const tagOptions = useMemo(
    () => orderedRepositories
      .flatMap((repository) => repository.tags ?? [])
      .filter((tag, index, tags) => tags.findIndex((candidate) => candidate.id === tag.id) === index)
      .sort((left, right) => left.tag_name.localeCompare(right.tag_name, undefined, { sensitivity: 'base' })),
    [orderedRepositories],
  );
  const filteredRepositories = useMemo(
    () => orderedRepositories.filter((repository) => {
      const alias = repository.alias_name?.toLocaleLowerCase() ?? '';
      const displayName = repository.display_name.toLocaleLowerCase();
      const matchesSearch = normalizedSearchQuery.length === 0
        || alias.includes(normalizedSearchQuery)
        || displayName.includes(normalizedSearchQuery);
      const matchesGroup = selectedGroup.length === 0 || repository.custom_group === selectedGroup;
      const matchesTag = selectedTag.length === 0 || (repository.tags ?? []).some((tag) => tag.id === selectedTag);
      return matchesSearch && matchesGroup && matchesTag;
    }),
    [normalizedSearchQuery, orderedRepositories, selectedGroup, selectedTag],
  );
  const hasSearchResults = filteredRepositories.length > 0;
  const hasRepositories = orderedRepositories.length > 0;

  return (
    <section
      className={`canvas-scope-selector${scrollableList ? ' canvas-scope-selector--scrollable' : ''}`}
      aria-label="Tracked repository and branch visibility"
    >
      <div className="canvas-scope-selector__header">
        <div>
          <h4 className="canvas-scope-selector__title">Tracked repositories</h4>
          <p className="canvas-scope-selector__description">
            Select a repository to include all of its branches, or expand it to choose individual branches.
          </p>
        </div>
        {(onSelectAll || onClearAll) && (
          <div className="canvas-scope-selector__toolbar">
            {onSelectAll && (
              <Button type="button" variant="basic" onClick={onSelectAll} disabled={bulkActionsDisabled}>
                Select all repositories
              </Button>
            )}
            {onClearAll && (
              <Button type="button" variant="basic" onClick={onClearAll} disabled={bulkActionsDisabled}>
                Clear all repositories
              </Button>
            )}
          </div>
        )}
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        placeholder="Search tracked repositories"
        ariaLabel="Search tracked repositories"
        size="compact"
      />

      {(groupOptions.length > 0 || tagOptions.length > 0) && (
        <div className="canvas-scope-selector__filters">
          {groupOptions.length > 0 && (
            <label className="canvas-scope-selector__filter">
              <span>Group</span>
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                aria-label="Filter repositories by group"
              >
                <option value="">All groups</option>
                {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
          )}
          {tagOptions.length > 0 && (
            <label className="canvas-scope-selector__filter">
              <span>Tag</span>
              <select
                value={selectedTag}
                onChange={(event) => setSelectedTag(event.target.value)}
                aria-label="Filter repositories by tag"
              >
                <option value="">All tags</option>
                {tagOptions.map((tag) => <option key={tag.id} value={tag.id}>{tag.tag_name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="canvas-scope-selector__list">
        {!hasRepositories && (
          <div className="canvas-scope-selector__empty">{emptyMessage}</div>
        )}

        {hasRepositories && !hasSearchResults && (
          <div className="canvas-scope-selector__empty">No repositories match the current search or filters.</div>
        )}

        {filteredRepositories.map((repository) => {
          const branches = repository.available_branches ?? [];
          const selected = normalizeSelectedBranches(repository, selectedBranches[repository.id] ?? []);
          const selectionState = getRepositorySelectionState(
            repository,
            selected,
            repositoryVisibility[repository.id] === true,
          );
          const isBusy = busyRepositories[repository.id] === true;
          const isExpanded = expandedRepositories[repository.id] === true;
          const title = repository.alias_name || repository.display_name;
          const selectedCount = selected.length;
          const branchSummary = branches.length === 0
            ? 'No branches detected'
            : selectionState === 'checked'
              ? `${branches.length} branches selected`
              : `${selectedCount} of ${branches.length} branches selected`;

          return (
            <div className="canvas-scope-selector__repository" key={repository.id}>
              <div className="canvas-scope-selector__repository-row">
                <Button
                  type="button"
                  variant="basic"
                  className="canvas-scope-selector__expand"
                  onClick={() => onToggleExpansion(repository.id)}
                  title={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
                  aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
                  aria-expanded={isExpanded}
                  disabled={isBusy}
                >
                  {isExpanded ? <CaretDown size={15} weight="bold" /> : <CaretRight size={15} weight="bold" />}
                </Button>

                <IndeterminateCheckbox
                  checked={selectionState === 'checked'}
                  indeterminate={selectionState === 'mixed'}
                  disabled={isBusy}
                  ariaLabel={`Select repository ${title}`}
                  onChange={(checked) => onToggleRepository(repository.id, checked)}
                />

                <div className="canvas-scope-selector__repository-label">
                  <span className="canvas-scope-selector__repository-name" title={title}>{title}</span>
                  <span className="canvas-scope-selector__repository-meta">{branchSummary}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="canvas-scope-selector__branches">
                  {branches.length === 0 && (
                    <div className="canvas-scope-selector__branch-empty">No branches detected for this repository.</div>
                  )}

                  {branches.map((branchName) => {
                    const checked = selected.includes(branchName);
                    return (
                      <label className="canvas-scope-selector__branch-row" key={`${repository.id}::${branchName}`}>
                        <input
                          className="canvas-scope-selector__checkbox"
                          type="checkbox"
                          checked={checked}
                          disabled={isBusy}
                          aria-label={`Select branch ${branchName} in ${title}`}
                          onChange={(event) => onToggleBranch(repository.id, branchName, event.target.checked)}
                        />
                        <span className="canvas-scope-selector__branch-name" title={branchName}>{branchName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { getRepositoryBranchSelection };
