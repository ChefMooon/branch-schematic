import { describe, expect, it } from 'vitest';
import { shouldApplyStoredViewport } from './viewportSync';

describe('shouldApplyStoredViewport', () => {
  it('applies the stored viewport when switching to a different view', () => {
    expect(
      shouldApplyStoredViewport({
        activeViewId: 'view-b',
        nextViewport: { zoom: 1.2, x: 10, y: 20 },
        lastAppliedViewId: 'view-a',
        lastAppliedViewport: { zoom: 1, x: 0, y: 0 },
      }),
    ).toBe(true);
  });

  it('does not reapply the stored viewport during an active view save', () => {
    expect(
      shouldApplyStoredViewport({
        activeViewId: 'view-a',
        nextViewport: { zoom: 1.25, x: 5, y: 7 },
        lastAppliedViewId: 'view-a',
        lastAppliedViewport: { zoom: 1.25, x: 5, y: 7 },
      }),
    ).toBe(false);
  });

  it('reapplies when the active view changes even if the viewport values match the last applied state', () => {
    expect(
      shouldApplyStoredViewport({
        activeViewId: 'view-b',
        nextViewport: { zoom: 1.25, x: 5, y: 7 },
        lastAppliedViewId: 'view-a',
        lastAppliedViewport: { zoom: 1.25, x: 5, y: 7 },
      }),
    ).toBe(true);
  });
});
