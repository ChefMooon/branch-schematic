import { fireEvent, render, screen } from '@testing-library/react';
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
const addToast = vi.fn();
const getSavedCardLocationSnapshot = vi.fn();
const restoreSavedCardLocations = vi.fn();
const undoSavedCardLocationRestore = vi.fn();

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
          card_state_json: JSON.stringify({ schemaVersion: 1, viewId: 'view-1', locations: [] }),
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
      getSavedCardLocationSnapshot,
      restoreSavedCardLocations,
      undoSavedCardLocationRestore,
      canUndoSavedCardLocationRestore: false,
    }),
}));

vi.mock('../../../components/notifications/NotificationProvider', () => ({
  useNotifications: () => ({ addToast }),
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
    getSavedCardLocationSnapshot.mockReturnValue({ schemaVersion: 1, viewId: 'view-1', locations: [] });
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

    expect(screen.getByRole('dialog')).toHaveTextContent(/archive view/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/saved layout will be kept for recovery/i);
  });

  it('opens a confirmation modal before restoring saved card locations', async () => {
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
    await user.click(screen.getByRole('button', { name: /state options/i }));
    await user.click(screen.getByRole('button', { name: /restore saved card locations/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent(/restore saved card locations/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/viewport and card settings will not change/i);
  });

  it('shows a compact quick action row with tooltips for the most common actions', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));

    expect(screen.getByRole('button', { name: /favorite view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duplicate view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete view/i })).toBeInTheDocument();
  });

  it('opens the shared rename modal and renames the active view on submit', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /rename view/i }));

    const dialog = screen.getByRole('dialog');
    const input = screen.getByRole('textbox', { name: /view name/i });

    expect(dialog).toHaveTextContent(/rename view/i);
    expect(input).toHaveValue('Primary');
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '  Renamed view  ');
    await user.click(screen.getByRole('button', { name: /^Rename$/i }));

    expect(renameView).toHaveBeenCalledWith('view-1', 'Renamed view');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new view/i })).not.toBeInTheDocument();
  });

  it('blocks blank rename input and cancels without renaming', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /rename view/i }));

    const input = screen.getByRole('textbox', { name: /view name/i });
    await user.clear(input);

    expect(screen.getByRole('button', { name: /^Rename$/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(renameView).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();
  });

  it('keeps the dropdown open when the rename modal is dismissed with Escape', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /rename view/i }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();
  });

  it('keeps the dropdown open when the rename modal is dismissed from its backdrop', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /rename view/i }));

    const overlay = screen.getByRole('dialog').parentElement;
    expect(overlay).not.toBeNull();
    fireEvent.mouseDown(overlay!);
    fireEvent.mouseUp(overlay!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();
  });

  it('keeps the rename modal open when the rename operation rejects', async () => {
    renameView.mockRejectedValueOnce(new Error('rename failed'));
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /rename view/i }));
    await user.click(screen.getByRole('button', { name: /^Rename$/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /view name/i })).toHaveValue('Primary');
    expect(screen.getByRole('button', { name: /new view/i })).toBeInTheDocument();
    expect(addToast).toHaveBeenCalledWith({
      variant: 'error',
      title: 'Rename failed',
      message: 'rename failed',
    });
  });

  it('renders Order and State Options as collapsible submenu groups with the delete action styled as dangerous', async () => {
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));

    const orderMenuButton = screen.getByRole('button', { name: /order/i });
    expect(orderMenuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /move up/i })).not.toBeInTheDocument();

    await user.click(orderMenuButton);

    expect(screen.getByRole('button', { name: /move up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete view/i })).toHaveClass('app-btn--menu-item-danger');
  });

  it('disables restore when no saved location snapshot exists', async () => {
    getSavedCardLocationSnapshot.mockReturnValue(null);
    const user = userEvent.setup();

    render(<ControlledViewActionsDropdown />);

    await user.click(screen.getByRole('button', { name: /view actions/i }));
    await user.click(screen.getByRole('button', { name: /state options/i }));

    expect(screen.getByRole('button', { name: /restore saved card locations/i })).toBeDisabled();
  });
});
