import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { OnboardingProvider, useOnboarding } from './useOnboarding';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

function Harness() {
  const onboarding = useOnboarding();

  return (
    <div>
      <output data-testid="open">{String(onboarding.isOpen)}</output>
      <output data-testid="mode">{String(onboarding.mode)}</output>
      <button type="button" onClick={onboarding.openTest}>Open test</button>
      <button type="button" onClick={onboarding.skip}>Skip</button>
    </div>
  );
}

describe('useOnboarding persistence semantics', () => {
  const invokeMock = vi.mocked(invoke);

  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue({ onboardingVersion: 1, onboardingStatus: 'completed' });
  });

  it('opens startup onboarding when the persisted state is not started', async () => {
    invokeMock.mockResolvedValue({ onboardingVersion: 1, onboardingStatus: 'not_started' });

    render(
      <OnboardingProvider>
        <Harness />
      </OnboardingProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    expect(screen.getByTestId('mode')).toHaveTextContent('startup');
    expect(invokeMock).toHaveBeenCalledWith('get_onboarding_state');
  });

  it('does not persist skip when the onboarding presentation is opened in test mode', async () => {
    render(
      <OnboardingProvider>
        <Harness />
      </OnboardingProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Open test' }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Skip' }).click();
    });

    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('get_onboarding_state');
    expect(invokeMock).not.toHaveBeenCalledWith('set_onboarding_state', expect.anything());
  });
});