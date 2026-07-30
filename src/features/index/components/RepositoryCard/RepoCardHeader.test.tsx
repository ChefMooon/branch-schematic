import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepoCardHeader } from './RepoCardHeader';
import type { TrackedPath } from '../../../../types/git';

vi.mock('./AliasEditPopover', () => ({
  AliasEditPopover: () => null,
}));

vi.mock('./RepoCardActionMenu', () => ({
  RepoCardOverflowMenu: () => null,
}));

const baseRepo = {
  id: 'repo-1',
  display_name: 'sample-repo',
  alias_name: null,
  absolute_path: '/tmp/sample-repo',
  is_favorite: 0,
  tags: [],
} as unknown as TrackedPath;

describe('RepoCardHeader', () => {
  it('renders a human-friendly owned label', () => {
    render(
      <RepoCardHeader
        repo={baseRepo}
        originType="OWNED"
        isEditingAlias={false}
        aliasInput=""
        isAnyLoading={false}
        onAliasInputChange={() => undefined}
        onStartEditing={() => undefined}
        onSaveAlias={async () => undefined}
        onResetAlias={() => undefined}
        onStopEditing={() => undefined}
        onOpenDetails={() => undefined}
        onRefreshStatus={() => undefined}
        onFetch={() => undefined}
        onPull={() => undefined}
        onPush={() => undefined}
        onToggleFavorite={() => undefined}
        onUntrack={() => undefined}
        onThemeChange={() => undefined}
      />
    );

    expect(screen.getByText('Owned')).toBeInTheDocument();
  });
});
