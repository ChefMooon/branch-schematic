import { describe, expect, it } from 'vitest';
import { getViewportSafeMenuPosition } from './menuPosition.ts';

describe('getViewportSafeMenuPosition', () => {
  it('opens below the trigger when there is enough room', () => {
    const position = getViewportSafeMenuPosition({
      triggerRect: { top: 120, bottom: 150, left: 100, right: 200 },
      menuHeight: 220,
      menuWidth: 220,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(position).toEqual({
      top: 118,
      left: 8,
      maxHeight: 584,
    });
  });

  it('opens above the trigger when the bottom space is insufficient', () => {
    const position = getViewportSafeMenuPosition({
      triggerRect: { top: 520, bottom: 550, left: 100, right: 200 },
      menuHeight: 220,
      menuWidth: 220,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(position).toEqual({
      top: 294,
      left: 8,
      maxHeight: 584,
    });
  });
});
