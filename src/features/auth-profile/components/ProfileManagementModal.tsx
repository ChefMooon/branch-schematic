import { useEffect, useMemo, useState } from 'react';
import { 
  CaretDown, 
  CaretUp, 
  CheckCircle, 
  Heartbeat, 
  PlusCircle, 
  Trash, 
  WarningCircle, 
  XCircle,
  IconContext
} from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { OAuthConnectButton } from './OAuthConnectButton.tsx';
import { ProfileListItem } from './ProfileListItem';
import type { AuthLevel, TokenHealthStatus, UserProfile } from '../types';

interface ProfileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  profiles: UserProfile[];
  tokenHealthMap: Record<string, TokenHealthStatus>;
  onCreateProfile: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  onSaveProfile: (profileId: string, changes: Partial<UserProfile>) => Promise<UserProfile | null>;
  onDeleteProfile: (profileId: string) => Promise<void>;
  onSelectProfile: (profileId: string | null) => void;
}

function getScopeText(value?: string[] | null) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function parseScopeText(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const authLevelOptions: { value: AuthLevel; label: string }[] = [
  { value: 'basic', label: 'Basic local' },
  { value: 'local_system', label: 'Local system' },
  { value: 'full_oauth', label: 'Full OAuth' },
];

export function ProfileManagementModal({
  isOpen,
  onClose,
  profile,
  profiles,
  tokenHealthMap,
  onCreateProfile,
  onSaveProfile,
  onDeleteProfile,
  onSelectProfile,
}: ProfileManagementModalProps) {
  const [draft, setDraft] = useState<Partial<UserProfile>>({
    display_name: 'New profile',
    auth_level: 'basic',
    repository_scope: [],
    folder_scope: [],
  });
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [isHealthPopoverOpen, setIsHealthPopoverOpen] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<UserProfile | null>(null);
  const [isBackdropPressed, setIsBackdropPressed] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsHealthPopoverOpen(false);
      setIsProfileMenuOpen(false);
      setIsWorkspaceCollapsed(false);
      setProfileToDelete(null);
      setSelectedProfileId(null);
      return;
    }

    if (profile) {
      setMode('edit');
      setSelectedProfileId(profile.id);
      setDraft({
        ...profile,
        repository_scope: profile.repository_scope ?? [],
        folder_scope: profile.folder_scope ?? [],
      });
      return;
    }

    setMode('create');
    setDraft({
      display_name: 'New profile',
      auth_level: 'basic',
      repository_scope: [],
      folder_scope: [],
      api_base_url: '',
      commit_name: '',
      commit_email: '',
    });
  }, [isOpen, profile]);

  const healthSummary = useMemo(() => {
    const total = profiles.length;
    const healthyCount = profiles.filter((entry) => (tokenHealthMap[entry.id] ?? 'none') === 'healthy').length;
    const needsAction = profiles.filter((entry) => (tokenHealthMap[entry.id] ?? 'none') !== 'healthy');

    return {
      total,
      healthyCount,
      needsActionCount: needsAction.length,
      needsActionProfiles: needsAction,
    };
  }, [profiles, tokenHealthMap]);

  const isOAuthMissingToken = draft.auth_level === 'full_oauth' && !String(draft.token_value ?? '').trim();

  if (!isOpen) {
    return null;
  }

  const submit = async () => {
    setIsBusy(true);
    try {
      if (mode === 'edit' && profile?.id) {
        await onSaveProfile(profile.id, draft);
        return;
      }

      const createdProfile = await onCreateProfile(draft);
      setMode('edit');
      setSelectedProfileId(createdProfile.id);
      setDraft({
        ...createdProfile,
        repository_scope: createdProfile.repository_scope ?? [],
        folder_scope: createdProfile.folder_scope ?? [],
      });
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    const targetProfileId = profileToDelete?.id ?? profile?.id;

    if (!targetProfileId) {
      return;
    }

    setIsBusy(true);
    try {
      await onDeleteProfile(targetProfileId);
      setProfileToDelete(null);
    } finally {
      setIsBusy(false);
    }
  };

  const requestDeleteConfirmation = (targetProfile: UserProfile) => {
    setProfileToDelete(targetProfile);
  };

  const cancelDeleteConfirmation = () => {
    setProfileToDelete(null);
  };

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsBackdropPressed(true);
    }
  };

  const handleOverlayMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isBackdropPressed) {
      return;
    }

    setIsBackdropPressed(false);

    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleOverlayMouseLeave = () => {
    setIsBackdropPressed(false);
  };

  return (
    <div
      style={styles.overlay}
      data-testid="profile-management-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      onMouseLeave={handleOverlayMouseLeave}
    >
      <div style={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <IconContext.Provider
          value={{
            style: {
              display: 'block',
              flexShrink: 0,
              minWidth: '1em',
              minHeight: '1em',
            }
          }}
        >
          <div style={styles.header}>
            <div>
              <div style={styles.eyebrow}>Auth profile management</div>
              <h3 style={styles.title}>{mode === 'edit' ? 'Edit profile' : 'Create profile'}</h3>
              <div style={styles.headerHint}>
                {profile
                  ? `${profile.display_name} is open for editing without changing your active profile.`
                  : 'Create a new profile while keeping your current active profile intact.'}
              </div>
            </div>
            <button type="button" onClick={onClose} style={styles.closeButton}>
              <XCircle size={18} />
            </button>
          </div>

          <div style={styles.content}>
            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitle}>Profile workspace</div>
                </div>
                <div style={styles.sectionActions}>
                  {isWorkspaceCollapsed ? (
                    <div style={styles.workspaceDropdownWrapper}>
                      <button type="button" onClick={() => setIsProfileMenuOpen((value) => !value)} style={styles.inlineButton}>
                        <span>{profile?.display_name ?? 'Select profile'}</span>
                        <CaretDown size={14} />
                      </button>
                      {isProfileMenuOpen && (
                        <div style={styles.workspaceDropdownMenu}>
                          {profiles.map((entry) => {
                            const isSelected = entry.id === profile?.id;
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => {
                                  onSelectProfile(entry.id);
                                  setIsProfileMenuOpen(false);
                                }}
                                style={{ ...styles.workspaceDropdownItem, borderColor: isSelected ? 'var(--accent, #3b82f6)' : 'var(--app-border)' }}
                              >
                                <div style={styles.workspaceDropdownText}>
                                  <div style={styles.workspaceDropdownName}>{entry.display_name}</div>
                                  <div style={styles.workspaceDropdownMeta}>{entry.auth_level.replace('_', ' ')}</div>
                                </div>
                                {isSelected ? <CheckCircle size={14} color="var(--accent, #3b82f6)" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <button type="button" onClick={() => setIsWorkspaceCollapsed((value) => !value)} style={styles.collapseButton} title={isWorkspaceCollapsed ? 'Expand profile workspace' : 'Collapse profile workspace'}>
                    {isWorkspaceCollapsed ? <CaretDown size={14} /> : <CaretUp size={14} />}
                  </button>
                  <button type="button" onClick={() => setIsHealthPopoverOpen((value) => !value)} style={styles.healthButton} title="Profile health">
                    <Heartbeat size={14} />
                  </button>
                  {isHealthPopoverOpen && (
                    <div style={styles.healthPopover}>
                      <div style={styles.healthPopoverHeader}>
                        <div style={styles.healthPopoverTitle}>Profile health</div>
                        <div style={styles.healthPopoverMeta}>{healthSummary.healthyCount}/{healthSummary.total} healthy</div>
                      </div>
                      {healthSummary.needsActionCount > 0 ? (
                        <div style={styles.healthList}>
                          {healthSummary.needsActionProfiles.map((entry) => {
                            const status = tokenHealthMap[entry.id] ?? 'none';
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => {
                                  onSelectProfile(entry.id);
                                  setIsHealthPopoverOpen(false);
                                }}
                                style={styles.healthListItem}
                              >
                                <div style={styles.healthListIcon}>
                                  <WarningCircle size={14} />
                                </div>
                                <div style={styles.healthListText}>
                                  <div style={styles.healthListName}>{entry.display_name}</div>
                                  <div style={styles.healthListMeta}>{status}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={styles.healthEmpty}>All profiles look healthy.</div>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={() => onSelectProfile(null)} style={styles.inlineButton}>
                    <PlusCircle size={14} />
                    <span>New</span>
                  </button>
                </div>
              </div>
              {!isWorkspaceCollapsed ? (
                <div style={styles.profileList}>
                  {profiles.map((entry) => {
                    const isSelected = entry.id === (profile?.id ?? selectedProfileId);
                    const isFavorite = Number(entry.is_favorite ?? 0) === 1;
                    const status = tokenHealthMap[entry.id] ?? 'none';
                    return (
                      <ProfileListItem
                        key={entry.id}
                        profile={entry}
                        isSelected={isSelected}
                        isFavorite={isFavorite}
                        status={status}
                        onSelectProfile={onSelectProfile}
                        onToggleFavorite={(profileId, favorite) => {
                          void onSaveProfile(profileId, { is_favorite: favorite });
                        }}
                        onDeleteProfile={requestDeleteConfirmation}
                      />
                    );
                  })}
                </div>
              ) : null}
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>Identity</div>
              <label style={styles.field}>
                <span style={styles.label}>Display name</span>
                <input
                  value={draft.display_name ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))}
                  style={styles.input}
                />
              </label>
              <div style={styles.row}>
                <label style={styles.field}>
                  <span style={styles.label}>Auth level</span>
                  <select
                    value={draft.auth_level ?? 'basic'}
                    onChange={(event) => setDraft((current) => ({ ...current, auth_level: event.target.value as AuthLevel }))}
                    style={styles.input}
                  >
                    {authLevelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <OAuthConnectButton
                  draft={draft}
                  onChange={(changes: Partial<UserProfile>) => setDraft((current) => ({ ...current, ...changes }))}
                />
              </div>
              <div style={styles.row}>
                <label style={styles.field}>
                  <span style={styles.label}>Username</span>
                  <input
                    value={draft.username ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Email</span>
                  <input
                    value={draft.email ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                    style={styles.input}
                  />
                </label>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionTitle}>Connection & automation</div>
              <label style={styles.field}>
                <span style={styles.label}>Enterprise API base URL</span>
                <input
                  value={draft.api_base_url ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, api_base_url: event.target.value }))}
                  style={styles.input}
                />
              </label>
              <div style={styles.row}>
                <label style={styles.field}>
                  <span style={styles.label}>Commit name</span>
                  <input
                    value={draft.commit_name ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, commit_name: event.target.value }))}
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Commit email</span>
                  <input
                    value={draft.commit_email ?? ''}
                    onChange={(event) => setDraft((current) => ({ ...current, commit_email: event.target.value }))}
                    style={styles.input}
                  />
                </label>
              </div>
              <label style={styles.field}>
                <span style={styles.label}>Repository scope</span>
                <textarea
                  value={getScopeText(draft.repository_scope)}
                  onChange={(event) => setDraft((current) => ({ ...current, repository_scope: parseScopeText(event.target.value) }))}
                  style={{ ...styles.input, minHeight: '72px', resize: 'vertical' }}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Folder scope</span>
                <textarea
                  value={getScopeText(draft.folder_scope)}
                  onChange={(event) => setDraft((current) => ({ ...current, folder_scope: parseScopeText(event.target.value) }))}
                  style={{ ...styles.input, minHeight: '72px', resize: 'vertical' }}
                />
              </label>
            </section>
          </div>

          <div style={styles.footer}>
            {profile?.id ? (
              <button type="button" onClick={() => requestDeleteConfirmation(profile)} disabled={isBusy} style={{ ...styles.secondaryButton, color: '#ef4444' }}>
                <Trash size={16} />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}
            <div style={styles.footerActions}>
              <button type="button" onClick={onClose} disabled={isBusy} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={isBusy || isOAuthMissingToken} style={styles.primaryButton}>
                <PlusCircle size={16} />
                <span>{mode === 'edit' ? 'Save profile' : 'Create profile'}</span>
              </button>
            </div>
          </div>
        </IconContext.Provider>

        <ConfirmationModal
          isOpen={Boolean(profileToDelete)}
          title="Delete profile"
          message={
            <>
              Delete profile <strong>{profileToDelete?.display_name ?? 'this profile'}</strong>? This action cannot be undone.
            </>
          }
          confirmLabel="Delete profile"
          cancelLabel="Cancel"
          variant="danger"
          isBusy={isBusy}
          onConfirm={() => {
            void remove();
          }}
          onCancel={cancelDeleteConfirmation}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    padding: '20px',
  },
  modal: {
    width: 'min(760px, 100%)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--app-surface)',
    color: 'var(--app-text)',
    borderRadius: '16px',
    border: '1px solid var(--app-border)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid var(--app-border)',
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--app-text-muted, #64748b)',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '18px',
  },
  headerHint: {
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--app-text-muted, #64748b)',
  },
  closeButton: {
    width: '36px',
    height: '36px',
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    backgroundColor: 'transparent',
    color: 'var(--app-text, #1e293b)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'none',
    outline: 'none',
  },
  content: {
    display: 'grid',
    gap: '12px',
    padding: '16px 20px 4px',
    overflowY: 'auto',
    minHeight: 0,
    flex: 1,
  },
  panel: {
    border: '1px solid var(--app-border)',
    borderRadius: '12px',
    padding: '12px',
    display: 'grid',
    gap: '10px',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  collapseButton: {
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'transparent',
    color: 'var(--app-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
  },
  sectionActions: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '13px',
  },
  inlineButton: {
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    padding: '6px 10px',
    backgroundColor: 'transparent',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    outline: 'none',
  },
  iconButton: {
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    width: '30px',
    height: '30px',
    backgroundColor: 'transparent',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
  },
  healthButton: {
    border: '1px solid var(--app-border)',
    borderRadius: '999px',
    width: '30px',
    height: '30px',
    backgroundColor: 'transparent',
    color: 'var(--app-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
  },
  healthPopover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '240px',
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 80,
  },
  healthPopoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  healthPopoverTitle: {
    fontWeight: 700,
    fontSize: '13px',
  },
  healthPopoverMeta: {
    fontSize: '12px',
    color: 'var(--app-text-muted, #64748b)',
  },
  healthList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  healthListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '10px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  healthListIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f59e0b',
  },
  healthListText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  healthListName: {
    fontSize: '12px',
    fontWeight: 600,
  },
  healthListMeta: {
    fontSize: '11px',
    color: 'var(--app-text-muted, #64748b)',
  },
  healthEmpty: {
    fontSize: '12px',
    color: 'var(--app-text-muted, #64748b)',
  },
  workspaceCollapsed: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  workspaceDropdownWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  workspaceDropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    minWidth: '220px',
    padding: '8px',
    borderRadius: '10px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 90,
  },
  workspaceDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  workspaceDropdownText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  workspaceDropdownName: {
    fontSize: '12px',
    fontWeight: 600,
  },
  workspaceDropdownMeta: {
    fontSize: '11px',
    color: 'var(--app-text-muted, #64748b)',
  },
  profileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  profileListItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    border: '1px solid var(--app-border)',
    borderRadius: '10px',
    padding: '8px 10px',
    backgroundColor: 'var(--app-surface)',
  },
  profileListActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  profileListText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  profileListName: {
    fontWeight: 600,
    fontSize: '13px',
  },
  profileListMeta: {
    fontSize: '12px',
    color: 'var(--app-text-muted, #64748b)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--app-text-muted, #64748b)',
  },
  input: {
    borderRadius: '10px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    color: 'inherit',
    padding: '8px 10px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
  },
  healthCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 20px',
    gap: '10px',
    flexShrink: 0,
    borderTop: '1px solid var(--app-border)',
    backgroundColor: 'var(--app-surface)',
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '10px',
    border: '1px solid var(--app-border)',
    backgroundColor: 'transparent',
    color: 'inherit',
    padding: '8px 12px',
    cursor: 'pointer',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--accent, #3b82f6)',
    color: '#fff',
    padding: '8px 12px',
    cursor: 'pointer',
  },
};