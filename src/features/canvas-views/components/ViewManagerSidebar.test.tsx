import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { ViewManagerSidebar } from './ViewManagerSidebar';

const view: CanvasViewRecord = {
  id: 'view-1',
  name: 'Primary',
  zoom_level: 1,
  pan_x: 0,
  pan_y: 0,
  is_favorite: 0,
  display_order: 0,
};

function renderSidebar() {
  const onSelect = vi.fn();
  const onToggleFavorite = vi.fn(async () => undefined);

  render(
    <ViewManagerSidebar
      views={[view]}
      selectedViewId={null}
      onSelect={onSelect}
      onCreate={vi.fn()}
      onDuplicate={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      onToggleFavorite={onToggleFavorite}
      onMoveUp={vi.fn(async () => undefined)}
      onMoveDown={vi.fn(async () => undefined)}
    />,
  );

  return { onSelect, onToggleFavorite };
}

describe('ViewManagerSidebar', () => {
  it('selects a view from the row body and keyboard activation', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSidebar();
    const row = screen.getByRole('button', { name: 'Open view Primary' });

    await user.click(screen.getByText('Baseline zoom 1.00'));
    expect(onSelect).toHaveBeenCalledWith('view-1');

    onSelect.mockClear();
    row.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('view-1');
  });

  it('keeps view actions independent from row selection', async () => {
    const user = userEvent.setup();
    const { onSelect, onToggleFavorite } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Favorite Primary' }));

    expect(onToggleFavorite).toHaveBeenCalledWith('view-1', true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
