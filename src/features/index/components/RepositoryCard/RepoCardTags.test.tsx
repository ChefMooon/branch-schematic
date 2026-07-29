import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepoCardTags } from './RepoCardTags';

describe('RepoCardTags', () => {
  it('renders the tag remove control as an icon button', () => {
    render(
      <RepoCardTags
        tags={[{ id: 'tag-1', tag_name: 'backend', color_hex: '#4f46e5' }]}
        isAnyLoading={false}
        onOpenTagModal={vi.fn()}
        onRemoveTag={vi.fn()}
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove backend/i });
    expect(removeButton.querySelector('svg')).not.toBeNull();
  });
});
