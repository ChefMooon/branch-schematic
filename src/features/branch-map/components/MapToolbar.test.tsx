import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { MapToolbar } from './MapToolbar';

vi.mock('../../../stores/canvas-store', () => ({
  useCanvasStore: (selector: (state: any) => unknown) =>
    selector({
      activeTagFilters: [],
      toggleTagFilter: vi.fn(),
      clearTagFilters: vi.fn(),
    }),
}));

vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: (selector: (state: any) => unknown) =>
    selector({
      getUniqueTags: () => [],
    }),
}));

describe('MapToolbar', () => {
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
});
