import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryDropdown } from './RepositoryDropdown';

function createAnchor(): HTMLButtonElement {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return anchor;
}

describe('RepositoryDropdown', () => {
  it('keeps clone disabled when remote clone prerequisites are not met', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const anchor = createAnchor();

    render(
      <RepositoryDropdown
        isOpen
        onClose={onClose}
        onSelect={onSelect}
        anchorElement={anchor}
        canCloneRemote={false}
      />
    );

    const cloneButton = await screen.findByRole('button', { name: 'Clone Repository (Sign in required)' });
    expect(cloneButton).toBeDisabled();

    await userEvent.click(cloneButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('enables clone action when remote clone prerequisites are met', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const anchor = createAnchor();

    render(
      <RepositoryDropdown
        isOpen
        onClose={onClose}
        onSelect={onSelect}
        anchorElement={anchor}
        canCloneRemote
      />
    );

    const cloneButton = await screen.findByRole('button', { name: 'Clone Repository...' });
    expect(cloneButton).toBeEnabled();

    await userEvent.click(cloneButton);
    expect(onSelect).toHaveBeenCalledWith('clone');
    expect(onClose).toHaveBeenCalled();
  });
});
