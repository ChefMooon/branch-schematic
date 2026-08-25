import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextInputModal } from './TextInputModal';

describe('TextInputModal', () => {
  const baseProps = {
    isOpen: true,
    title: 'Rename alias',
    inputLabel: 'Alias',
    inputValue: 'My alias',
    onConfirm: () => undefined,
    onCancel: () => undefined,
  };

  it('does not render a reset button when no reset action is provided', () => {
    render(<TextInputModal {...baseProps} confirmLabel="Save alias" />);

    expect(screen.queryByRole('button', { name: /clear alias/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save alias/i })).toBeEnabled();
  });

  it('renders the reset button and invokes onReset when clicked', async () => {
    const onReset = vi.fn();
    render(<TextInputModal {...baseProps} confirmLabel="Save alias" resetLabel="Clear alias" onReset={onReset} />);

    await userEvent.click(screen.getByRole('button', { name: /clear alias/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('disables the reset button while busy', () => {
    render(<TextInputModal {...baseProps} confirmLabel="Save alias" resetLabel="Clear alias" isBusy onReset={() => undefined} />);

    expect(screen.getByRole('button', { name: /clear alias/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /save alias/i })).toBeDisabled();
  });
});
