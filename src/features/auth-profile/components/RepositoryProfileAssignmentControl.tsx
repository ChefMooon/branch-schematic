import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleNotch, IdentificationCard, Link, LinkBreak, WarningCircle } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { Button } from '../../../components/button/Button';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { useProfileStore } from '../stores/profileStore';
import type { UserProfile } from '../types';
import './RepositoryProfileAssignmentControl.css';

interface RepositoryProfileAssignment {
  profile_id: string | null;
  profile_name: string | null;
  auth_level: string | null;
  stale: boolean;
}

interface ResolvedProfile {
  profile_name: string;
  auth_level: string;
  resolution_source: string;
}

interface RepositoryProfileAssignmentControlProps {
  repoPathId: string;
  onChanged?: () => void | Promise<void>;
  compact?: boolean;
}

function profileLabel(profile: UserProfile) {
  return profile.display_name || 'Unnamed profile';
}

function authLevelLabel(authLevel: string | null | undefined) {
  if (authLevel === 'full_oauth') return 'Full OAuth';
  if (authLevel === 'local_system') return 'Local system';
  return 'Basic (local only)';
}

function isAssignment(value: unknown): value is RepositoryProfileAssignment {
  return Boolean(value && typeof value === 'object' && 'stale' in value);
}

export function RepositoryProfileAssignmentControl({
  repoPathId,
  onChanged,
  compact = false,
}: RepositoryProfileAssignmentControlProps) {
  const profiles = useProfileStore((state) => state.profiles);
  const isHydrated = useProfileStore((state) => state.isHydrated);
  const hydrateProfiles = useProfileStore((state) => state.hydrateProfiles);
  const [assignment, setAssignment] = useState<RepositoryProfileAssignment | null>(null);
  const [resolvedProfile, setResolvedProfile] = useState<ResolvedProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [assignmentResult, resolvedResult] = await Promise.allSettled([
        invoke<unknown>('get_repository_profile_assignment', { repoPathId }),
        invoke<unknown>('get_resolved_profile', { repoPathId }),
      ]);
      if (assignmentResult.status === 'fulfilled') {
        setAssignment(isAssignment(assignmentResult.value) ? assignmentResult.value : null);
      } else {
        setAssignment(null);
      }
      if (resolvedResult.status === 'fulfilled') {
        const value = resolvedResult.value;
        setResolvedProfile(value && typeof value === 'object' && 'profile_name' in value ? value as ResolvedProfile : null);
      } else {
        setResolvedProfile(null);
      }
      if (assignmentResult.status === 'rejected' && resolvedResult.status === 'rejected') {
        throw assignmentResult.reason;
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load repository profile settings.');
    } finally {
      setIsLoading(false);
    }
  }, [repoPathId]);

  useEffect(() => {
    if (!isHydrated) {
      void hydrateProfiles();
    }
  }, [hydrateProfiles, isHydrated]);

  useEffect(() => {
    void load();
  }, [load]);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const handleAssign = async (profile: UserProfile) => {
    setBusyProfileId(profile.id);
    setError(null);
    try {
      const nextAssignment = await invoke<RepositoryProfileAssignment>('assign_repository_profile', {
        repoPathId,
        profileId: profile.id,
      });
      setAssignment(nextAssignment);
      await load();
      setIsOpen(false);
      await onChanged?.();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'The repository profile could not be assigned.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    setError(null);
    try {
      await invoke('clear_repository_profile', { repoPathId });
      setAssignment({ profile_id: null, profile_name: null, auth_level: null, stale: false });
      await load();
      setClearConfirmationOpen(false);
      setIsOpen(false);
      await onChanged?.();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'The repository profile could not be cleared.');
    } finally {
      setIsClearing(false);
    }
  };

  const assignmentLabel = assignment?.stale
    ? 'Stale assignment'
    : assignment?.profile_name
      ? `${assignment.profile_name} · ${authLevelLabel(assignment.auth_level)}`
      : resolvedProfile?.profile_name
        ? `${resolvedProfile.profile_name} · ${authLevelLabel(resolvedProfile.auth_level)}`
        : 'Repository profile';
  const hasOnlyLocalFallback = profiles.length > 0 && profiles.every((profile) => profile.id === 'local-basic-profile');
  const resolutionSourceLabel = resolvedProfile?.resolution_source === 'repository_assignment'
    ? 'Assigned to this repository'
    : 'Inherited from the active profile';

  return (
    <>
      <div className={`repository-profile-control ${compact ? 'repository-profile-control--compact' : ''}`} ref={containerRef}>
        <button
          type="button"
          className={`repository-profile-control__trigger ${assignment?.stale ? 'is-stale' : ''}`}
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Manage repository profile assignment"
          disabled={isLoading}
        >
          {isLoading ? <CircleNotch size={14} className="animate-spin-svg" /> : <IdentificationCard size={14} weight="bold" />}
          <span>{isLoading ? 'Loading profile…' : assignmentLabel}</span>
        </button>

        {isOpen ? (
          <div className="repository-profile-control__popover" role="dialog" aria-label="Repository profile assignment">
            <div className="repository-profile-control__heading">
              <div>
                <strong>Repository profile</strong>
                <span>Choose which profile handles remote operations.</span>
              </div>
              <IdentificationCard size={18} weight="duotone" />
            </div>

            {assignment?.stale ? (
              <div className="repository-profile-control__notice repository-profile-control__notice--warning" role="status">
                <WarningCircle size={15} weight="fill" />
                <span>The assigned profile is no longer available. Replace or clear it.</span>
              </div>
            ) : null}

            {resolvedProfile ? (
              <div className="repository-profile-control__resolved">
                <span>Resolved profile</span>
                <strong>{resolvedProfile.profile_name}</strong>
                <small>{authLevelLabel(resolvedProfile.auth_level)} · {resolutionSourceLabel}</small>
              </div>
            ) : null}

            {error ? <div className="repository-profile-control__error" role="alert">{error}</div> : null}

            <div className="repository-profile-control__profiles">
              {profiles.length > 0 ? profiles.map((profile) => {
                const isCurrent = assignment?.profile_id === profile.id && !assignment.stale;
                const isBusy = busyProfileId === profile.id;
                return (
                  <button
                    type="button"
                    className={`repository-profile-control__profile ${isCurrent ? 'is-current' : ''}`}
                    key={profile.id}
                    onClick={() => { void handleAssign(profile); }}
                    disabled={isLoading || isClearing || busyProfileId !== null}
                  >
                    {isBusy ? <CircleNotch size={15} className="animate-spin-svg" /> : isCurrent ? <Check size={15} weight="bold" /> : <Link size={15} />}
                    <span>
                      {isCurrent ? `${profileLabel(profile)} (assigned)` : assignment?.profile_id ? `Replace with ${profileLabel(profile)}` : `Assign ${profileLabel(profile)}`}
                      <small>{authLevelLabel(profile.auth_level)}</small>
                    </span>
                  </button>
                );
              }) : <span className="repository-profile-control__empty">No profiles are available.</span>}
            </div>

            {hasOnlyLocalFallback ? (
              <div className="repository-profile-control__notice" role="status">
                <span>Only the local fallback is available. Assign it here for local-only Git, or add a user profile in Profile Management before using remote operations.</span>
              </div>
            ) : null}

            {assignment?.profile_id ? (
              <Button
                type="button"
                variant="danger"
                className="repository-profile-control__clear"
                onClick={() => setClearConfirmationOpen(true)}
                disabled={isClearing || busyProfileId !== null}
              >
                <LinkBreak size={15} />
                Clear assignment
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmationModal
        isOpen={clearConfirmationOpen}
        title="Clear repository profile assignment"
        message="Clear this repository's explicit profile assignment? Repository operations will use the resolved fallback profile."
        confirmLabel="Clear assignment"
        variant="danger"
        isBusy={isClearing}
        onConfirm={() => { void handleClear(); }}
        onCancel={() => setClearConfirmationOpen(false)}
      />
    </>
  );
}
