export const ONBOARDING_VERSION = 1;

export type OnboardingStatus = 'not_started' | 'skipped' | 'completed';
export type OnboardingPresentationMode = 'startup' | 'replay' | 'test';
export type OnboardingStep = 0 | 1 | 2 | 3;

export type OnboardingState = {
  onboardingVersion: number;
  onboardingStatus: OnboardingStatus;
};

export type OnboardingControllerState = {
  isOpen: boolean;
  mode: OnboardingPresentationMode | null;
  step: OnboardingStep;
  isBusy: boolean;
  persistenceError: string | null;
};

export const ONBOARDING_REQUEST_EVENT = 'onboarding-request';

export type OnboardingRequestAction = 'open-profile-management' | 'open-add-local-repository';

export type OnboardingRequestDetail = {
  action: OnboardingRequestAction;
};

export const ONBOARDING_STEPS = [
  {
    title: 'Local first',
    description: 'Track existing repositories locally without requiring an account.',
  },
  {
    title: 'See the structure',
    description: 'Use the Dashboard and Branch Map to move from repositories to branches and commits.',
  },
  {
    title: 'Profiles and access',
    description: 'Choose local or authenticated capabilities when you need them.',
  },
  {
    title: 'Make it useful',
    description: 'Add a local repository when you are ready, or finish and return later.',
  },
] as const;
