import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryScopeSelector } from './RepositoryScopeSelector';
import { normalizeWorkspaceScopeRecords, type WorkspaceScopeRecord } from './scopeSelection';

const repositories: WorkspaceScopeRecord[] = [
  {
    id: 'alpha',
    display_name: 'Alpha Repository',
    alias_name: 'Frontend',
    available_branches: ['main', 'feature/alpha-search'],
  },
  {
    id: 'beta',
    display_name: 'Beta Repository',
    alias_name: 'Backend',
    available_branches: ['main'],
  },
];

function renderSelector(overrides: Partial<React.ComponentProps<typeof RepositoryScopeSelector>> = {}) {
  return render(
    <RepositoryScopeSelector
      repositories={repositories}
      repositoryVisibility={{ alpha: true, beta: true }}
      selectedBranches={{ alpha: ['main', 'feature/alpha-search'], beta: ['main'] }}
      expandedRepositories={{ alpha: false, beta: false }}
      onToggleRepository={vi.fn()}
      onToggleBranch={vi.fn()}
      onToggleExpansion={vi.fn()}
      {...overrides}
    />,
  );
}

describe('RepositoryScopeSelector', () => {
  it('filters by group and tag without changing selection callbacks', async () => {
    const user = userEvent.setup();
    const onToggleRepository = vi.fn();
    renderSelector({
      repositories: [
        { ...repositories[0], custom_group: 'Work', tags: [{ id: 'tag-a', tag_name: 'Active', color_hex: '#00AA88' }] },
        { ...repositories[1], custom_group: 'Personal', tags: [{ id: 'tag-b', tag_name: 'Review', color_hex: '#AA0088' }] },
      ],
      onToggleRepository,
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter repositories by group' }), 'Work');
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter repositories by tag' }), 'tag-a');
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(onToggleRepository).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter repositories by group' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter repositories by tag' }), '');
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('normalizes structured and serialized tags defensively', () => {
    const normalized = normalizeWorkspaceScopeRecords([
      {
        ...repositories[0],
        tags_json: JSON.stringify([
          { id: 'tag-b', tag_name: 'Zed', color_hex: '#222222' },
          { id: 'tag-a', tag_name: 'Active', color_hex: '#111111' },
          { id: 'invalid', tag_name: 4, color_hex: '#333333' },
        ]),
      },
      { ...repositories[1], tags_json: '{invalid' },
    ]);

    expect(normalized[0].tags?.map((tag) => tag.tag_name)).toEqual(['Active', 'Zed']);
    expect(normalized[1].tags).toEqual([]);
  });

  it('filters by display name and alias without matching branch names', async () => {
    const user = userEvent.setup();
    renderSelector();

    const search = screen.getByRole('textbox', { name: 'Search tracked repositories' });

    await user.type(search, 'FRONT');
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'alpha repository');
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'alpha-search');
    expect(screen.queryByText('Frontend')).not.toBeInTheDocument();
    expect(screen.queryByText('Backend')).not.toBeInTheDocument();
  });

  it('shows a distinct message when the search has no matches', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.type(screen.getByRole('textbox', { name: 'Search tracked repositories' }), 'missing');

    expect(screen.getByText('No repositories match the current search or filters.')).toBeInTheDocument();
    expect(screen.queryByText('No tracked repositories available.')).not.toBeInTheDocument();
  });

  it('restores all repositories when the search is cleared', async () => {
    const user = userEvent.setup();
    renderSelector();
    const search = screen.getByRole('textbox', { name: 'Search tracked repositories' });

    await user.type(search, 'backend');
    expect(screen.queryByText('Frontend')).not.toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('keeps bulk actions global while repositories are filtered', async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    const onClearAll = vi.fn();
    renderSelector({ onSelectAll, onClearAll });

    await user.type(screen.getByRole('textbox', { name: 'Search tracked repositories' }), 'frontend');
    await user.click(screen.getByRole('button', { name: 'Select all repositories' }));
    await user.click(screen.getByRole('button', { name: 'Clear all repositories' }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('enables scrolling only when requested by the scope tab', () => {
    const { container } = renderSelector({ scrollableList: true });

    expect(container.querySelector('.canvas-scope-selector--scrollable')).toBeInTheDocument();
  });

  it('keeps scope controls interactive while a repository save is pending', () => {
    renderSelector({
      savingRepositories: { alpha: true },
      onSelectAll: vi.fn(),
      onClearAll: vi.fn(),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Saving view selection...');
    expect(screen.getByRole('checkbox', { name: 'Select repository Frontend' })).toBeEnabled();
  });
});