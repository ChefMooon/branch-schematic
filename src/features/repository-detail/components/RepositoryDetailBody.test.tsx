import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryDetailBody } from './RepositoryDetailBody';
import type { TrackedPath } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';

describe('RepositoryDetailBody', () => {
  it('renders repository summary details and commit history state', () => {
    const repo: TrackedPath = {
      id: 'repo-1',
      display_name: 'Branch Schematic',
      absolute_path: '/tmp/branch-schematic',
      current_branch: 'main',
      default_branch_name: 'main',
      available_branches: ['main'],
      ahead_count: 1,
      behind_count: 0,
      has_upstream: true,
      uncommitted_changes_count: 2,
      remote_url: 'https://github.com/example/branch-schematic',
      github_owner_login: 'example',
      repo_origin_type: 'OWNED',
      tags: [],
    };

    const commits: CommitRecord[] = [
      {
        commit_hash: 'abc123',
        author_name: 'Ada Lovelace',
        commit_message: 'Initial commit',
        committed_at: '2024-01-01 10:00:00',
        signature_status: 'verified',
      },
    ];

    render(
      <RepositoryDetailBody
        repo={repo}
        commits={commits}
        selectedCommit={commits[0]}
        isLoadingCommits={false}
        currentBranch="main"
        onSelectCommit={vi.fn()}
      />
    );

    expect(screen.getByText('/tmp/branch-schematic')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/example/branch-schematic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /initial commit/i })).toBeInTheDocument();
  });
});
