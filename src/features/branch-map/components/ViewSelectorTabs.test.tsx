import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSelectorTabs } from './ViewSelectorTabs';

const setActiveView = vi.fn();
const createNewView = vi.fn();

const views = [
  { id: 'view-1', name: 'Primary', is_favorite: 1, display_order: 0 },
  { id: 'view-2', name: 'Secondary', is_favorite: 0, display_order: 1 },
  { id: 'view-3', name: 'Archive', is_favorite: 0, display_order: 2 },
];

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ zoom: 1, x: 0, y: 0 }),
}));

vi.mock('../../../stores/canvas-store', () => ({
  sortCanvasViews: (records: typeof views) => records,
  useCanvasStore: (selector: (state: unknown) => unknown) =>
    selector({ views, activeViewId: 'view-1', setActiveView, createNewView }),
}));

vi.mock('../../canvas-views/components/CreateViewModal', () => ({
  CreateViewModal: () => null,
}));

vi.mock('../../canvas-views/components/ViewManagerModal', () => ({
  ViewManagerModal: () => null,
}));

vi.mock('./ViewActionsDropdown', () => ({
  ViewActionsDropdown: ({ onOpenChange }: { onOpenChange: (open: boolean) => void }) => (
    <button type="button" onClick={() => onOpenChange(true)}>
      View actions
    </button>
  ),
}));

describe('ViewSelectorTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 1024;
  });

  it('renders visible views as accessible tabs and selects a view', async () => {
    const user = userEvent.setup();

    render(<ViewSelectorTabs />);

    const tablist = screen.getByRole('tablist', { name: 'Canvas views' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Open view Primary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('tab', { name: 'Open view Primary' }));

    expect(setActiveView).toHaveBeenCalledWith('view-1');
  });

  it('opens the overflow menu, selects a view, and closes on selection', async () => {
    const user = userEvent.setup();

    render(<ViewSelectorTabs />);

    const trigger = screen.getByRole('button', { name: /more \(2\)/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'More canvas views' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Open view Secondary' }));

    expect(setActiveView).toHaveBeenCalledWith('view-2');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('dismisses overflow when an outside canvas surface stops propagation', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <ViewSelectorTabs />
        <button type="button" onMouseDown={(event) => event.stopPropagation()}>
          Canvas surface
        </button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /more \(2\)/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Canvas surface' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});