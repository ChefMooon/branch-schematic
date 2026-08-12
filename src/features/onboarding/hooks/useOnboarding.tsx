import { invoke } from '@tauri-apps/api/core';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  type OnboardingControllerState,
  type OnboardingPresentationMode,
  type OnboardingState,
  type OnboardingStep,
} from '../types';

type OnboardingContextValue = OnboardingControllerState & {
  openReplay: () => void;
  openTest: () => void;
  pause: () => void;
  resume: () => void;
  close: () => void;
  skip: () => Promise<void>;
  finish: () => Promise<void>;
  next: () => void;
  back: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function toOnboardingState(state: OnboardingState): OnboardingState {
  return state;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [controller, setController] = useState<OnboardingControllerState>({
    isOpen: false,
    mode: null,
    step: 0,
    isBusy: false,
    persistenceError: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function evaluateStartup() {
      try {
        const persisted = toOnboardingState(await invoke<OnboardingState>('get_onboarding_state'));
        if (
          isMounted &&
          (persisted.onboardingVersion !== ONBOARDING_VERSION || persisted.onboardingStatus === 'not_started')
        ) {
          setController((current) => ({ ...current, isOpen: true, mode: 'startup', step: 0 }));
        }
      } catch (error) {
        // Startup remains usable when persistence is unavailable; replay/test can still be used.
        if (isMounted) {
          setController((current) => ({
            ...current,
            persistenceError: `Onboarding state is unavailable: ${String(error)}`,
          }));
        }
      }
    }

    void evaluateStartup();
    return () => {
      isMounted = false;
    };
  }, []);

  function open(mode: OnboardingPresentationMode) {
    setController((current) => ({
      ...current,
      isOpen: true,
      mode,
      step: 0,
      persistenceError: null,
    }));
  }

  async function persist(status: 'skipped' | 'completed') {
    if (controller.mode === 'test') {
      setController((current) => ({ ...current, isOpen: false, mode: null, isBusy: false }));
      return;
    }

    setController((current) => ({ ...current, isBusy: true, persistenceError: null }));
    try {
      await invoke<OnboardingState>('set_onboarding_state', { status });
      setController((current) => ({ ...current, isOpen: false, mode: null, isBusy: false }));
    } catch (error) {
      setController((current) => ({
        ...current,
        isBusy: false,
        persistenceError: `Could not save onboarding progress: ${String(error)}`,
      }));
    }
  }

  const value = useMemo<OnboardingContextValue>(() => ({
    ...controller,
    openReplay: () => open('replay'),
    openTest: () => open('test'),
    pause: () => setController((current) => ({ ...current, isOpen: false })),
    resume: () => setController((current) => ({ ...current, isOpen: true })),
    close: () => {
      if (!controller.isBusy) void persist('skipped');
    },
    skip: () => persist('skipped'),
    finish: () => persist('completed'),
    next: () => setController((current) => ({ ...current, step: Math.min(current.step + 1, ONBOARDING_STEPS.length - 1) as OnboardingStep })),
    back: () => setController((current) => ({ ...current, step: Math.max(current.step - 1, 0) as OnboardingStep })),
  }), [controller]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}
