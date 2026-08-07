import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSelectorTabs } from './ViewSelectorTabs';

const setActiveView = vi.fn();
const createNewView = vi.fn();

const baseViews = [
  { id: 'view-1', name: 'Primary', is_favorite: 1, display_order: 0 },
  { id: 'view-2', name: 'Secondary', is_favorite: 0, display_order: 1 },
  { id: 'view-3', name: 'Archive', is_favorite: 0, display_order: 2 },
];
let mockedViews = baseViews;
let mockedActiveViewId = 'view-1';

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ zoom: 1, x: 0, y: 0 }),
}));

vi.mock('../../../stores/canvas-store', () => ({
  sortCanvasViews: (records: typeof baseViews) => records,
  useCanvasStore: (selector: (state: unknown) => unknown) =>
    selector({ views: mockedViews, activeViewId: mockedActiveViewId, setActiveView, createNewView }),
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
    mockedViews = baseViews;
    mockedActiveViewId = 'view-1';
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

  it('wraps long view names in a constrained label with the full tooltip name', () => {
    mockedViews = [{ ...baseViews[0], name: 'A very long canvas view name that should be truncated' }];

    render(<ViewSelectorTabs />);

    const tab = screen.getByRole('tab', { name: 'Open view A very long canvas view name that should be truncated' });
    const label = tab.querySelector('.view-selector-tabs__label');

    expect(label).toHaveTextContent('A very long canvas view name that should be truncated');
    expect(label).toHaveClass('view-selector-tabs__label');
    expect(tab).toHaveAttribute('title', 'A very long canvas view name that should be truncated');
  });

  it('updates the visible tab count when crossing responsive breakpoints', () => {
    mockedViews = [
      ...baseViews,
      { id: 'view-4', name: 'Release', is_favorite: 0, display_order: 3 },
      { id: 'view-5', name: 'Experiments', is_favorite: 0, display_order: 4 },
      { id: 'view-6', name: 'Notes', is_favorite: 0, display_order: 5 },
    ];

    render(<ViewSelectorTabs />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);

    act(() => {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(3);

    act(() => {
      window.innerWidth = 1400;
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('supports roving tab focus and arrow, Home, and End navigation', async () => {
    const user = userEvent.setup();
    window.innerWidth = 1200;

    const viewSelector = render(<ViewSelectorTabs />);

    let tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    mockedActiveViewId = 'view-2';
    viewSelector.rerender(<ViewSelectorTabs />);
    tabs = screen.getAllByRole('tab');
    tabs[1].focus();
    await user.keyboard('{End}');
    mockedActiveViewId = 'view-3';
    viewSelector.rerender(<ViewSelectorTabs />);
    tabs = screen.getAllByRole('tab');
    tabs[2].focus();
    await user.keyboard('{Home}');

    expect(setActiveView).toHaveBeenNthCalledWith(1, 'view-2');
    expect(setActiveView).toHaveBeenNthCalledWith(2, 'view-3');
    expect(setActiveView).toHaveBeenNthCalledWith(3, 'view-1');
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