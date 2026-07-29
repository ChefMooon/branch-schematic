import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from './ConfirmationModal';

describe('ConfirmationModal', () => {
  it('uses the danger button styling for destructive confirmations', () => {
    render(
      <ConfirmationModal
        isOpen
        title="Delete repository"
        message="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        variant="danger"
      />
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    expect(confirmButton).toHaveClass('app-btn--danger');
  });

  it('does not dismiss when the interaction starts inside the dialog and ends on the backdrop', () => {
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmationModal
        isOpen
        title="Delete repository"
        message="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    const overlay = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(overlay);
    fireEvent.click(overlay);

    expect(onCancel).not.toHaveBeenCalled();
  });
});
