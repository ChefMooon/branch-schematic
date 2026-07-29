import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewActionsDropdown } from './ViewActionsDropdown';

const deleteView = vi.fn();
const setViewFavorite = vi.fn();
const moveViewOrder = vi.fn();
const snapshotBaselineViewport = vi.fn();
const saveCardState = vi.fn();
const duplicateView = vi.fn();
const renameView = vi.fn();

vi.mock('../../../stores/canvas-store', () => ({
  useCanvasStore: (selector: (state: any) => unknown) =>
    selector({
      nodes: [],
      views: [
        {
          id: 'view-1',
          name: 'Primary',
          is_favorite: 0,
          display_order: 0,
        },
        {
          id: 'view-2',
          name: 'Secondary',
          is_favorite: 0,
          display_order: 1,
        },
      ],
      duplicateView,
      renameView,
      deleteView,
      setViewFavorite,
      moveViewOrder,
      snapshotBaselineViewport,
      saveCardState,
    }),
}));

function ControlledViewActionsDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ViewActionsDropdown
      activeView={{ id: 'view-1', name: 'Primary', is_favorite: 0, display_order: 0 } as any}
      viewport={{ zoom: 1, x: 0, y: 0 }}
      onOpenManager={() => undefined}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}

describe('ViewActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes when clicking outside the menu', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole('button', { name: /new view/i })).not.toBeInTheDocument();
  });

  it('closes when an outside interaction stops propagation', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <ControlledViewActionsDropdown />
        <div onMouseDown={(event) => event.stopPropagation()}>
          <button type="button">Canvas surface</button>
        </div>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /canvas surface/i }));

    expect(screen.queryByRole('button', { name: /new view/i })).not.toBeInTheDocument();
  });

  it('opens a confirmation modal before deleting the active view', async () => {
    const user = userEvent.setup();

    render(
      <ViewActionsDropdown
        activeView={{ id: 'view-1', name: 'Primary', is_favorite: 0, display_order: 0 } as any}
        viewport={{ zoom: 1, x: 0, y: 0 }}
        onOpenManager={() => undefined}
        isOpen
      />,
    );

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent(/delete view/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/this action cannot be undone/i);
  });
});
