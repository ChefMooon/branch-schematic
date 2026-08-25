import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useResizablePanels, type ResizablePanelConfig } from './useResizablePanels';

type PanelsApi = ReturnType<typeof useResizablePanels>;

const defaultConfigs: ResizablePanelConfig[] = [
  { id: 'outer', defaultRatio: 0.22, minRatio: 0.18, maxRatio: 0.45, minPx: 280 },
  { id: 'inner', defaultRatio: 0.2, minRatio: 0.2, maxRatio: 0.6, minPx: 200 },
];

function createContainer(id: string, api: PanelsApi, width: number) {
  const node = document.createElement('div');
  document.body.appendChild(node);
  act(() => {
    api.registerContainer(id)(node);
  });
  stubRect(node, width);
  return node;
}

function stubRect(node: HTMLElement, width: number) {
  node.getBoundingClientRect = () =>
    ({ width, left: 0, top: 0, right: width, bottom: 100, x: 0, y: 0, height: 100, toJSON: () => ({}) }) as DOMRect;
}

function mouseMove(clientX: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX }));
  });
}

function mouseUp() {
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup'));
  });
}

describe('useResizablePanels', () => {
  beforeEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('initializes each divider ratio from its config default', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));

    expect(result.current.ratios.outer).toBeCloseTo(0.22);
    expect(result.current.ratios.inner).toBeCloseTo(0.2);
    expect(result.current.isResizing).toBe(false);
  });

  it('clamps drag ratios to ratio bounds', () => {
    const configs: ResizablePanelConfig[] = [
      { id: 'outer', defaultRatio: 0.22, minRatio: 0.18, maxRatio: 0.45 },
    ];
    const { result } = renderHook(() => useResizablePanels(configs));
    createContainer('outer', result.current, 1000);

    const startEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => {
      result.current.startResize('outer')(startEvent);
    });
    expect(startEvent.defaultPrevented).toBe(true);

    mouseMove(900);
    expect(result.current.ratios.outer).toBeCloseTo(0.45);

    mouseMove(50);
    expect(result.current.ratios.outer).toBeCloseTo(0.18);
    expect(result.current.isResizing).toBe(true);

    mouseUp();
    expect(result.current.isResizing).toBe(false);
  });

  it('converts pixel floors into effective ratios against the live rect', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));
    const outer = createContainer('outer', result.current, 1000);

    expect(result.current.getEffectiveBounds('outer').min).toBeCloseTo(0.28);
    expect(result.current.getEffectiveBounds('outer').max).toBeCloseTo(0.45);

    stubRect(outer, 2000);
    expect(result.current.getEffectiveBounds('outer').min).toBeCloseTo(0.18);
    expect(result.current.getEffectiveBounds('outer').max).toBeCloseTo(0.45);
  });

  it('enforces the pixel floor while dragging at a wide container size', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));
    createContainer('outer', result.current, 2000);

    act(() => {
      result.current.startResize('outer')(new MouseEvent('mousedown', { cancelable: true }));
    });
    mouseMove(10);
    expect(result.current.ratios.outer).toBeCloseTo(0.18);

    mouseUp();
  });

  it('caps drags at maxPx-derived effective maxima when provided', () => {
    const configs: ResizablePanelConfig[] = [
      { id: 'inner', defaultRatio: 0.3, minRatio: 0.1, maxRatio: 0.9, maxPx: 250 },
    ];
    const { result } = renderHook(() => useResizablePanels(configs));
    createContainer('inner', result.current, 1000);

    expect(result.current.getEffectiveBounds('inner').max).toBeCloseTo(0.25);

    act(() => {
      result.current.startResize('inner')(new MouseEvent('mousedown', { cancelable: true }));
    });
    mouseMove(990);
    expect(result.current.ratios.inner).toBeCloseTo(0.25);

    mouseUp();
  });

  it('keeps per-divider ratios independent when one divider moves', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));
    createContainer('outer', result.current, 1000);
    createContainer('inner', result.current, 780);

    act(() => {
      result.current.startResize('outer')(new MouseEvent('mousedown', { cancelable: true }));
    });
    mouseMove(400);
    mouseUp();

    expect(result.current.ratios.outer).toBeCloseTo(0.4);
    expect(result.current.ratios.inner).toBeCloseTo(0.2);

    act(() => {
      result.current.startResize('inner')(new MouseEvent('mousedown', { cancelable: true }));
    });
    mouseMove(700);
    mouseUp();

    expect(result.current.ratios.inner).toBeCloseTo(Math.min(700 / 780, 0.6));
    expect(result.current.ratios.outer).toBeCloseTo(0.4);
  });

  it('locks global cursor and user-select during drag and restores on release', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));
    createContainer('outer', result.current, 1000);

    act(() => {
      result.current.startResize('outer')(new MouseEvent('mousedown', { cancelable: true }));
    });
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    mouseUp();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('restores global styles when unmounting mid-drag', () => {
    const { result, unmount } = renderHook(() => useResizablePanels(defaultConfigs));
    createContainer('outer', result.current, 1000);

    act(() => {
      result.current.startResize('outer')(new MouseEvent('mousedown', { cancelable: true }));
    });
    expect(document.body.style.cursor).toBe('col-resize');

    unmount();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('nudges ratios via resizeBy within effective clamps', () => {
    const { result } = renderHook(() => useResizablePanels(defaultConfigs));
    createContainer('outer', result.current, 1000);

    act(() => {
      result.current.resizeBy('outer', -0.2);
    });
    expect(result.current.ratios.outer).toBeCloseTo(0.28);

    act(() => {
      result.current.resizeBy('outer', 5);
    });
    expect(result.current.ratios.outer).toBeCloseTo(0.45);
  });

  it('seeds initial ratios from options and falls back to config defaults', () => {
    const { result } = renderHook(() =>
      useResizablePanels(defaultConfigs, { initialRatios: { outer: 0.35 } }),
    );

    expect(result.current.ratios.outer).toBeCloseTo(0.35);
    expect(result.current.ratios.inner).toBeCloseTo(0.2);
  });

  it('reports committed ratios on mount, skips mid-drag, and reports after release', () => {
    const committed: Record<string, number>[] = [];
    const { result } = renderHook(() =>
      useResizablePanels(defaultConfigs, {
        onRatiosCommit: (ratios) => committed.push({ ...ratios }),
      }),
    );
    createContainer('outer', result.current, 1000);

    expect(committed).toEqual([expect.objectContaining({ outer: 0.22, inner: 0.2 })]);

    act(() => {
      result.current.startResize('outer')(new MouseEvent('mousedown', { cancelable: true }));
    });
    mouseMove(400);
    mouseUp();

    expect(committed).toHaveLength(2);
    expect(committed[1]).toEqual(expect.objectContaining({ outer: 0.4, inner: 0.2 }));
  });

  it('invokes the latest onRatiosCommit callback without restarting ratio state', () => {
    const firstCommitted: Record<string, number>[] = [];
    const secondCommitted: Record<string, number>[] = [];
    const { result, rerender } = renderHook(
      ({ notify }: { notify?: (ratios: Record<string, number>) => void }) =>
        useResizablePanels(defaultConfigs, { onRatiosCommit: notify }),
      { initialProps: { notify: (ratios: Record<string, number>) => firstCommitted.push({ ...ratios }) } },
    );

    rerender({ notify: (ratios: Record<string, number>) => secondCommitted.push({ ...ratios }) });

    act(() => {
      result.current.resizeBy('outer', 0.05);
    });

    expect(result.current.ratios.outer).toBeCloseTo(0.27);
    expect(firstCommitted).toEqual([expect.objectContaining({ outer: 0.22, inner: 0.2 })]);
    expect(secondCommitted).toEqual([
      expect.objectContaining({ outer: 0.27, inner: 0.2 }),
    ]);
  });
});
