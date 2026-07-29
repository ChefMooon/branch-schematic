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

  it('keeps the color dot from shrinking when a group name is long', () => {
    const longGroupName = 'A very long group name that should stay readable inside the dropdown';

    render(
      <RepoGroupMenu
        repo={{
          id: 'repo-3',
          display_name: 'Example repo',
          absolute_path: '/tmp/example-repo',
          custom_group: 'Custom Group',
        } as never}
        availableGroups={[
          {
            id: 'group-1',
            group_name: longGroupName,
            color_hex: '#38bdf8',
          },
        ] as never[]}
        onGroupChange={() => {}}
        onCreateGroup={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /custom group/i }));

    const content = screen.getByText(longGroupName).closest('.repo-group-menu-item-content');
    const dot = content?.querySelector('.repo-tag-dot') as HTMLElement | null;
    const label = content?.querySelector('.repo-group-menu-item-label') as HTMLElement | null;

    expect(content).not.toBeNull();
    expect(dot).not.toBeNull();
    expect(label).not.toBeNull();
    expect(getComputedStyle(dot as HTMLElement).flexShrink).toBe('0');
    expect(getComputedStyle(content as HTMLElement).justifyContent).toBe('center');
    expect(parseFloat(getComputedStyle(label as HTMLElement).minWidth)).toBe(0);
  });
});

function parsedLineHeight(lineHeight: string): number {
  if (lineHeight.endsWith('px')) {
    return Number.parseFloat(lineHeight);
  }

  return Number.parseFloat(lineHeight) * 16;
}
