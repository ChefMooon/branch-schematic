import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../Dashboard.css';
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

  it('uses a comfortable line-height for the badge label so the text is not clipped', () => {
    const groupName = 'Launch Team';

    render(
      <RepoGroupMenu
        repo={{
          id: 'repo-2',
          display_name: 'Example repo',
          absolute_path: '/tmp/example-repo',
          custom_group: groupName,
        } as never}
        availableGroups={[]}
        onGroupChange={() => {}}
        onCreateGroup={() => {}}
      />
    );

    const badgeLabel = screen.getByText(groupName).closest('.repo-group-badge-label');

    expect(badgeLabel).not.toBeNull();
    const computed = getComputedStyle(badgeLabel as HTMLElement);
    expect(parsedLineHeight(computed.lineHeight)).toBeGreaterThan(13.5);
  });
});

function parsedLineHeight(lineHeight: string): number {
  if (lineHeight.endsWith('px')) {
    return Number.parseFloat(lineHeight);
  }

  return Number.parseFloat(lineHeight) * 16;
}
