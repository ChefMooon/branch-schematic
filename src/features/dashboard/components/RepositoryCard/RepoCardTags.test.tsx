import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepoCardTags } from './RepoCardTags';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('renders an overflow badge when the tag list is too long to fit inline', () => {
    render(
      <RepoCardTags
        tags={[
          { id: 'tag-1', tag_name: 'alpha', color_hex: '#4f46e5' },
          { id: 'tag-2', tag_name: 'backend', color_hex: '#4f46e5' },
          { id: 'tag-3', tag_name: 'zebra', color_hex: '#4f46e5' },
          { id: 'tag-4', tag_name: 'delta', color_hex: '#4f46e5' },
        ]}
        isAnyLoading={false}
        onOpenTagModal={vi.fn()}
        onRemoveTag={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /\+2 more/i })).toBeInTheDocument();
  });

  it('renders tags in alphabetical order inside the overflow popover', () => {
    render(
      <RepoCardTags
        tags={[
          { id: 'tag-2', tag_name: 'zebra', color_hex: '#4f46e5' },
          { id: 'tag-1', tag_name: 'alpha', color_hex: '#4f46e5' },
          { id: 'tag-3', tag_name: 'backend', color_hex: '#4f46e5' },
          { id: 'tag-4', tag_name: 'delta', color_hex: '#4f46e5' },
        ]}
        isAnyLoading={false}
        onOpenTagModal={vi.fn()}
        onRemoveTag={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /\+2 more/i }));

    const renderedTags = screen.getAllByRole('dialog')[0]?.textContent ?? '';
    expect(renderedTags).toContain('delta');
    expect(renderedTags).toContain('zebra');
  });

  it('uses a single visible tag on narrow cards to preserve space for the group name', async () => {
    class MockResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe() {
        this.callback([{ contentRect: { width: 240 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    render(
      <RepoCardTags
        tags={[
          { id: 'tag-1', tag_name: 'alpha', color_hex: '#4f46e5' },
          { id: 'tag-2', tag_name: 'backend', color_hex: '#4f46e5' },
          { id: 'tag-3', tag_name: 'zebra', color_hex: '#4f46e5' },
        ]}
        isAnyLoading={false}
        onOpenTagModal={vi.fn()}
        onRemoveTag={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(document.querySelectorAll('.repo-tag-pill:not(.repo-tag-pill--compact)')).toHaveLength(1);
    });

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+2 more/i })).toBeInTheDocument();
  });
});
