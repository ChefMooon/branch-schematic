import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RepositoryDetailHeader } from './RepositoryDetailHeader';
import type { TrackedPath } from '../../../types/git';

describe('RepositoryDetailHeader', () => {
  it('renders repository title and summary details', () => {
    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main', 'feature/ui'],
      ahead_count: 1,
      behind_count: 0,
      has_upstream: true,
      uncommitted_changes_count: 2,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    render(
      <RepositoryDetailHeader
        repo={repo}
        activeBranch="main"
        previewBranch="main"
        onSelectPreviewBranch={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: /branch schematic/i })).toBeInTheDocument();
    expect(screen.getByText('Repository details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select preview branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close repository details/i })).toBeInTheDocument();
  });
});
