import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapToolbar } from './MapToolbar';

const toggleTagFilterMock = vi.fn();
const clearTagFiltersMock = vi.fn();

let canvasStoreState: any;

vi.mock('../../../stores/canvas-store', () => ({
  useCanvasStore: (selector: (state: any) => unknown) => selector(canvasStoreState),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: (selector: (state: any) => unknown) =>
    selector({
      getUniqueTags: () => [
        { id: 'tag-1', tag_name: 'Backend', color_hex: '#4f46e5' },
        { id: 'tag-2', tag_name: 'Frontend', color_hex: '#ec4899' },
      ],
    }),
}));

describe('MapToolbar', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    toggleTagFilterMock.mockReset();
    clearTagFiltersMock.mockReset();
    canvasStoreState = {
      activeTagFilters: [],
      toggleTagFilter: toggleTagFilterMock,
      clearTagFilters: clearTagFiltersMock,
      nodes: [{ id: 'node-1', data: { tags: [{ id: 'tag-1', tag_name: 'Backend', color_hex: '#4f46e5' }] } }],
    };
  });

  it('routes reset and fit actions through parent callbacks', async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onResetViewport = vi.fn();
    const onFitView = vi.fn();

    render(
      <ReactFlowProvider>
        <MapToolbar
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetViewport={onResetViewport}
          onFitView={onFitView}
        />
      </ReactFlowProvider>,
    );

    await user.click(screen.getByTitle('Zoom In'));
    await user.click(screen.getByTitle('Zoom Out'));
    await user.click(screen.getByTitle('Reset Zoom & Position'));
    await user.click(screen.getByTitle('Fit Screen View'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onResetViewport).toHaveBeenCalledTimes(1);
    expect(onFitView).toHaveBeenCalledTimes(1);
  });

  it('remembers the tag filters popover state for the current session', () => {
    window.sessionStorage.setItem('branch-schematic.tag-filters-open', 'true');

    render(
      <ReactFlowProvider>
        <MapToolbar />
      </ReactFlowProvider>,
    );

    expect(screen.getByRole('dialog', { name: /tag filters/i })).toBeInTheDocument();
  });

  it('opens the tag filters popover and toggles tags through the toolbar', async () => {
    const user = userEvent.setup();

    render(
      <ReactFlowProvider>
        <MapToolbar />
      </ReactFlowProvider>,
    );

    await user.click(screen.getByRole('button', { name: /filter tags/i }));

    expect(screen.getByRole('dialog', { name: /tag filters/i })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /backend/i }));
    expect(toggleTagFilterMock).toHaveBeenCalledWith('tag-1');

    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(clearTagFiltersMock).toHaveBeenCalledTimes(1);
  });
});
