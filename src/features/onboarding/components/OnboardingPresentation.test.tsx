import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPresentation } from './OnboardingPresentation';
import { ONBOARDING_REQUEST_EVENT } from '../types';

const mockController = vi.hoisted(() => ({
  isOpen: true,
  mode: 'test' as const,
  step: 0 as 0 | 1 | 2 | 3,
  isBusy: false,
  persistenceError: null as string | null,
  close: vi.fn(),
  skip: vi.fn(),
  finish: vi.fn(),
  next: vi.fn(),
  back: vi.fn(),
}));

vi.mock('../hooks/useOnboarding', () => ({
  useOnboarding: () => mockController,
}));

describe('OnboardingPresentation', () => {
  beforeEach(() => {
    mockController.isOpen = true;
    mockController.step = 0;
    mockController.isBusy = false;
    mockController.persistenceError = null;
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  it('renders each progressive step with accessible progress', () => {
    const { rerender } = render(<OnboardingPresentation />);

    expect(screen.getByRole('dialog', { name: 'Local first' })).toHaveAttribute('aria-describedby', 'onboarding-description');
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText(/Authentication is optional/)).toBeInTheDocument();

    for (const step of [1, 2, 3] as const) {
      mockController.step = step;
      rerender(<OnboardingPresentation />);
      expect(screen.getByText(`Step ${step + 1} of 4`)).toBeInTheDocument();
      if (step === 1) expect(screen.getAllByText(/Dashboard/).length).toBeGreaterThan(0);
      if (step === 2) expect(screen.getByText(/Local system/)).toBeInTheDocument();
      if (step === 3) expect(screen.getAllByText(/Add a local repository/).length).toBeGreaterThan(0);
    }
  });

  it('keeps navigation actions at the step boundaries and delegates movement', () => {
    const { rerender } = render(<OnboardingPresentation />);
    const navigation = document.querySelector('.onboarding-modal__navigation');
    expect(navigation).toContainElement(screen.getByRole('button', { name: /Back/ }));
    expect(navigation).toContainElement(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(mockController.next).toHaveBeenCalledOnce();

    mockController.step = 3;
    rerender(<OnboardingPresentation />);
    expect(screen.getByRole('button', { name: /Finish/ })).toHaveClass('app-btn--submit');
    expect(screen.getByRole('button', { name: /Finish/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(mockController.back).toHaveBeenCalledOnce();
  });

  it('marks the active step for assistive technology', () => {
    const { rerender } = render(<OnboardingPresentation />);

    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Local first');

    mockController.step = 2;
    rerender(<OnboardingPresentation />);
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Profiles and access');
  });

  it('locks body overflow, focuses the dialog, and restores focus on close', async () => {
    const invokingButton = document.createElement('button');
    document.body.append(invokingButton);
    invokingButton.focus();
    const { unmount } = render(<OnboardingPresentation />);

    expect(document.body.style.overflow).toBe('hidden');
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: 'Skip onboarding' })).toHaveFocus();

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(invokingButton).toHaveFocus();
    invokingButton.remove();
  });

  it('uses safe Escape and pointer-aware backdrop dismissal without persistence in test mode', () => {
    render(<OnboardingPresentation />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockController.skip).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    const backdrop = document.querySelector('.onboarding-modal-backdrop')!;
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(backdrop);
    expect(mockController.skip).not.toHaveBeenCalled();

    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);
    expect(mockController.skip).toHaveBeenCalledOnce();
  });

  it('emits typed requests for existing profile and repository owners', () => {
    const requests: unknown[] = [];
    const listener = (event: Event) => requests.push((event as CustomEvent).detail);
    window.addEventListener(ONBOARDING_REQUEST_EVENT, listener);

    const { rerender } = render(<OnboardingPresentation />);
    mockController.step = 2;
    rerender(<OnboardingPresentation />);
    fireEvent.click(screen.getByRole('button', { name: /Open profile management/ }));
    mockController.step = 3;
    rerender(<OnboardingPresentation />);
    fireEvent.click(screen.getByRole('button', { name: /Add a local repository/ }));

    window.removeEventListener(ONBOARDING_REQUEST_EVENT, listener);
    expect(requests).toEqual([
      { action: 'open-profile-management' },
      { action: 'open-add-local-repository' },
    ]);
  });
});
