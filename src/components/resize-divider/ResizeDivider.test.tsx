import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResizeDivider } from './ResizeDivider';

describe('ResizeDivider', () => {
  function renderDivider(overrides: Partial<Parameters<typeof ResizeDivider>[0]> = {}) {
    const props = {
      label: 'Resize test panels',
      ratio: 0.3,
      minRatio: 0.2,
      maxRatio: 0.6,
      onResizeStart: vi.fn(),
      onNudge: vi.fn(),
      ...overrides,
    };
    render(<ResizeDivider {...props} />);
    return props;
  }

  it('exposes separator semantics and aria values derived from ratio and bounds', () => {
    renderDivider();

    const divider = screen.getByRole('separator', { name: 'Resize test panels' });
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    expect(divider).toHaveAttribute('aria-valuemin', '20');
    expect(divider).toHaveAttribute('aria-valuemax', '60');
    expect(divider).toHaveAttribute('aria-valuenow', '30');
  });

  it('clamps the reported aria value to the effective bounds', () => {
    renderDivider({ ratio: 0.9 });

    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '60');
  });

  it('starts resizing on mousedown with the default prevented', () => {
    const { onResizeStart } = renderDivider();

    const divider = screen.getByRole('separator');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    fireEvent(divider, event);

    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents native drag behavior', () => {
    renderDivider();

    const event = new Event('dragstart', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('separator'), event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('nudges with arrow keys within clamps and ignores other keys', () => {
    const { onNudge } = renderDivider();
    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(onNudge).toHaveBeenLastCalledWith(-1);

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(onNudge).toHaveBeenLastCalledWith(1);

    fireEvent.keyDown(divider, { key: 'ArrowUp' });
    expect(onNudge).toHaveBeenCalledTimes(2);
  });

  it('supports an additional layout className', () => {
    renderDivider({ className: 'commits-tab-divider' });

    expect(screen.getByRole('separator').className).toContain('resize-divider');
    expect(screen.getByRole('separator').className).toContain('commits-tab-divider');
  });
});
