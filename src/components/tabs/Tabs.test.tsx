import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const items = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
] as const;

describe('Tabs', () => {
  it('renders accessible active state and changes tabs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Tabs items={items} value="first" onChange={onChange} ariaLabel="Example tabs" idPrefix="example" />);

    expect(screen.getByRole('tablist', { name: 'Example tabs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-controls', 'example-panel-first');

    await user.click(screen.getByRole('tab', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('second');
  });

  it('moves focus and changes selection with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Tabs items={items} value="first" onChange={onChange} ariaLabel="Example tabs" idPrefix="example" />);

    screen.getByRole('tab', { name: 'First' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('second');
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus();
  });
});