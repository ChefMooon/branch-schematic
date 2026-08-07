import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepoThemeModal } from './RepoThemeModal';

describe('RepoThemeModal', () => {
  it('keeps submit-mode changes local until Apply to selected is pressed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onThemeChange = vi.fn();

    render(
      <RepoThemeModal
        isOpen
        isBusy={false}
        mode="submit"
        currentThemeColor={null}
        currentIconName={null}
        onClose={vi.fn()}
        onThemeChange={onThemeChange}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Select #0EA5E9' }));

    expect(onThemeChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply to selected' }));

    expect(onSubmit).toHaveBeenCalledWith('#0EA5E9', null);
  });

  it('submits reset defaults as null values in submit mode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RepoThemeModal
        isOpen
        isBusy={false}
        mode="submit"
        currentThemeColor="#10B981"
        currentIconName="GitBranch"
        onClose={vi.fn()}
        onThemeChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reset defaults' }));
    await user.click(screen.getByRole('button', { name: 'Apply to selected' }));

    expect(onSubmit).toHaveBeenCalledWith(null, null);
  });
});
