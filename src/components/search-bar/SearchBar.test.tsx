import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('shows a clear button when it has text and clears the input', async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <SearchBar
        value="alpha"
        onChange={onChange}
        onClear={onClear}
        label="Search repositories"
        placeholder="Search"
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();

    await userEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders helper text when the field is empty', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        helperText="Try searching by name or path"
        label="Search workspaces"
        placeholder="Search"
      />
    );

    expect(screen.getByText('Try searching by name or path')).toBeInTheDocument();
  });

  it('renders a visible shell around the input', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        label="Search repositories"
        placeholder="Search"
      />
    );

    const input = screen.getByLabelText('Search repositories');
    const shell = input.parentElement;

    expect(shell).toHaveStyle({
      border: '1px solid var(--app-border)',
      boxSizing: 'border-box',
    });
  });

  it('can suppress its shell border when a parent wrapper provides the outline', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        label="Search repositories"
        placeholder="Search"
        showShellBorder={false}
      />
    );

    const input = screen.getByLabelText('Search repositories');
    const shell = input.parentElement;

    expect(shell).toHaveStyle({ border: 'none' });
  });

  it('can suppress its shared focus ring when a parent wrapper provides one', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        label="Search repositories"
        placeholder="Search"
        showFocusRing={false}
      />
    );

    const input = screen.getByLabelText('Search repositories');
    const shell = input.parentElement;

    expect(shell).toHaveStyle({ boxShadow: 'none' });
  });

  it('supports an opt-in compact size without changing the default shell contract', () => {
    const { rerender } = render(
      <SearchBar value="" onChange={vi.fn()} ariaLabel="Search repositories" />
    );

    const defaultInput = screen.getByRole('textbox', { name: 'Search repositories' });
    expect(defaultInput.parentElement).toHaveStyle({ height: '100%' });

    rerender(
      <SearchBar value="" onChange={vi.fn()} ariaLabel="Search repositories" size="compact" />
    );

    expect(defaultInput.parentElement).toHaveStyle({ height: '30px' });
    expect(defaultInput).toHaveStyle({ fontSize: '12px' });
  });
});
