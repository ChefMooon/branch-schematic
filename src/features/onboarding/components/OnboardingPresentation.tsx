import { useEffect, useRef } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GitCommitIcon,
  KeyIcon,
  MapTrifoldIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  UserCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { ONBOARDING_REQUEST_EVENT, ONBOARDING_STEPS, type OnboardingRequestAction } from '../types';
import { useOnboarding } from '../hooks/useOnboarding';
import './OnboardingPresentation.css';

export function OnboardingPresentation() {
  const onboarding = useOnboarding();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const backdropDismiss = useBackdropDismiss(dialogRef, onboarding.skip, onboarding.isOpen && !onboarding.isBusy);

  useEffect(() => {
    if (!onboarding.isOpen) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!onboarding.isBusy) onboarding.skip();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [onboarding.isOpen, onboarding.isBusy, onboarding.skip]);

  if (!onboarding.isOpen) return null;

  const currentStep = ONBOARDING_STEPS[onboarding.step];
  const isLastStep = onboarding.step === ONBOARDING_STEPS.length - 1;
  const request = (action: OnboardingRequestAction) => {
    window.dispatchEvent(new CustomEvent(ONBOARDING_REQUEST_EVENT, { detail: { action } }));
  };

  const renderStepContent = () => {
    switch (onboarding.step) {
      case 0:
        return (
          <div className="onboarding-modal__feature-list">
            <div><FolderOpenIcon size={22} weight="duotone" /><span><strong>Track what you already have.</strong> Add an existing Git folder to your local catalog.</span></div>
            <div><ShieldCheckIcon size={22} weight="duotone" /><span><strong>Authentication is optional.</strong> Local repository tracking and history work without an account.</span></div>
            <div><CheckCircleIcon size={22} weight="duotone" /><span><strong>Your folder stays yours.</strong> Adding a repository attaches it to Branch Schematic; it does not modify the directory.</span></div>
          </div>
        );
      case 1:
        return (
          <div className="onboarding-modal__feature-list">
            <div><SquaresFourIcon size={22} weight="duotone" /><span><strong>Dashboard.</strong> Your repository catalog and starting point for local work.</span></div>
            <div><MapTrifoldIcon size={22} weight="duotone" /><span><strong>Branch Map.</strong> Explore branches, commits, and relationships on a spatial canvas.</span></div>
            <div><GitBranchIcon size={22} weight="duotone" /><span><strong>Views and Git workflow.</strong> Save focused views, inspect commit context, and keep local Git actions close at hand.</span></div>
            <div><GitCommitIcon size={22} weight="duotone" /><span><strong>Commit context.</strong> Follow changes from branches to the commits that shaped them.</span></div>
          </div>
        );
      case 2:
        return (
          <div className="onboarding-modal__capabilities">
            <div className="onboarding-modal__capability-row onboarding-modal__capability-row--header"><span>Profile</span><span>What it enables</span></div>
            <div className="onboarding-modal__capability-row"><strong><UserCircleIcon size={18} /> Basic local</strong><span>Local tracking, history, and local Git work.</span></div>
            <div className="onboarding-modal__capability-row"><strong><KeyIcon size={18} /> Local system</strong><span>Local Git plus remote Git through OS-managed credentials, such as Credential Manager or an SSH agent.</span></div>
            <div className="onboarding-modal__capability-row"><strong><ShieldCheckIcon size={18} /> Full OAuth</strong><span>Everything above, plus provider API access and repository discovery. OAuth tokens remain in the OS keyring.</span></div>
            <p className="onboarding-modal__fine-print">Choose or connect a profile only when you need those capabilities. Your active profile is never changed by this guide.</p>
            <Button type="button" variant="basic" onClick={() => request('open-profile-management')} disabled={onboarding.isBusy}>
              <UserCircleIcon size={18} /> Open profile management
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="onboarding-modal__completion">
            <div className="onboarding-modal__completion-icon"><CheckCircleIcon size={34} weight="duotone" /></div>
            <p>There is no setup deadline. Add a local repository when you are ready, then explore it from the Dashboard or Branch Map.</p>
            <Button type="button" variant="submit" onClick={() => request('open-add-local-repository')} disabled={onboarding.isBusy}>
              <FolderOpenIcon size={18} /> Add a local repository
            </Button>
            <p className="onboarding-modal__fine-print">You can skip this step and return to the app. Nothing is changed until you choose an action.</p>
          </div>
        );
    }
  };

  return (
    <div
      className="onboarding-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { event.stopPropagation(); backdropDismiss.handleMouseDown(event); }}
      onMouseUp={(event) => { event.stopPropagation(); backdropDismiss.handleMouseUp(event); }}
      onMouseLeave={() => backdropDismiss.handleMouseLeave()}
      onTouchStart={(event) => { event.stopPropagation(); backdropDismiss.handleTouchStart(event); }}
      onTouchEnd={(event) => { event.stopPropagation(); backdropDismiss.handleTouchEnd(event); }}
    >
      <div ref={dialogRef} className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" onClick={(event) => event.stopPropagation()}>
        <header className="onboarding-modal__header">
          <div>
            <p className="onboarding-modal__eyebrow">A quick start for Branch Schematic</p>
            <p className="onboarding-modal__progress" aria-live="polite">Step {onboarding.step + 1} of {ONBOARDING_STEPS.length}</p>
          </div>
          <Button type="button" variant="close" aria-label="Skip onboarding" title="Skip onboarding" onClick={onboarding.close} disabled={onboarding.isBusy}>
            <XIcon size={18} />
          </Button>
        </header>
        <div className="onboarding-modal__body">
          <div className="onboarding-modal__step-indicator" aria-label="Onboarding steps">
            {ONBOARDING_STEPS.map((step, index) => <span key={step.title} className={index === onboarding.step ? 'is-current' : index < onboarding.step ? 'is-complete' : ''} aria-current={index === onboarding.step ? 'step' : undefined}>{index < onboarding.step ? <CheckIcon size={14} /> : index + 1} <span>{step.title}</span></span>)}
          </div>
          <h1 id="onboarding-title">{currentStep.title}</h1>
          <p id="onboarding-description" className="onboarding-modal__description">{currentStep.description}</p>
          {renderStepContent()}
          {onboarding.persistenceError && <p className="onboarding-modal__error" role="alert">{onboarding.persistenceError}</p>}
        </div>
        <footer className="onboarding-modal__footer">
          <Button type="button" variant="basic" onClick={onboarding.skip} disabled={onboarding.isBusy}>Skip</Button>
          <div className="onboarding-modal__navigation">
            <Button type="button" variant="basic" onClick={onboarding.back} disabled={onboarding.step === 0 || onboarding.isBusy}><ArrowLeftIcon size={17} /> Back</Button>
            {isLastStep ? <Button type="button" variant="submit" onClick={onboarding.finish} disabled={onboarding.isBusy}>Finish <CheckIcon size={17} /></Button> : <Button type="button" variant="submit" onClick={onboarding.next} disabled={onboarding.isBusy}>Next <ArrowRightIcon size={17} /></Button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
