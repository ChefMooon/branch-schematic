import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RepoGroupMenu } from './RepoGroupMenu';

describe('RepoGroupMenu', () => {
  it('shows a popover with the full group name when hovering a truncated badge label', () => {
    const longGroupName = 'A very long group name that should be truncated in the repository card badge';

    render(
      <RepoGroupMenu
        repo={{
          id: 'repo-1',
          display_name: 'Example repo',
          absolute_path: '/tmp/example-repo',
          custom_group: longGroupName,
        } as never}
        availableGroups={[]}
        onGroupChange={() => {}}
        onCreateGroup={() => {}}
      />
    );

    const badge = screen.getByRole('button', { name: new RegExp(longGroupName, 'i') });

    fireEvent.mouseEnter(badge);

    expect(screen.getByTestId('group-label-popover')).toHaveTextContent(longGroupName);
  });
});
