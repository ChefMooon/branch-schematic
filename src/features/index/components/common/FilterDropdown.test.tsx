import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterDropdown } from './FilterDropdown';

describe('FilterDropdown', () => {
  it('renders static options and selects one value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<FilterDropdown label="Branch" value={null} options={[{ label: 'Main', value: 'main' }, { label: 'Feature', value: 'feature' }]} onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /branch/i });
    await user.click(trigger);

    await user.click(screen.getByRole('option', { name: 'Main' }));

    expect(onChange).toHaveBeenCalledWith('main');
  });

  it('shows loading and error states for async options', async () => {
    const fetchOptions = vi.fn().mockRejectedValue(new Error('nope'));

    render(<FilterDropdown label="Group" fetchOptions={fetchOptions} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    expect(await screen.findByText(/unable to load options/i)).toBeInTheDocument();
  });

  it('supports multi-select behavior', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<FilterDropdown label="Repo Type" multi value={[]} options={[{ label: 'Owned', value: 'OWNED' }, { label: 'Fork', value: 'FORK' }]} onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /repo type/i });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Owned' }));
    await user.click(screen.getByRole('option', { name: 'Fork' }));

    expect(onChange).toHaveBeenLastCalledWith(['OWNED', 'FORK']);
  });

  it('hides the placeholder/reset option when requested', async () => {
    const user = userEvent.setup();

    render(<FilterDropdown label="Branch" value={null} hidePlaceholderOption options={[{ label: 'Main', value: 'main' }, { label: 'Feature', value: 'feature' }]} />);

    await user.click(screen.getByRole('button', { name: /branch/i }));

    expect(screen.queryByRole('button', { name: /select an option/i })).not.toBeInTheDocument();
  });

  it('exposes accessible state for the trigger', () => {
    render(<FilterDropdown label="Group" options={[{ label: 'One', value: 'one' }]} aria-label="Group filter" />);

    const trigger = screen.getByRole('button', { name: /group filter/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
