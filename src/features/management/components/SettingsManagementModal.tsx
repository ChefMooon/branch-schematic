import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowCounterClockwise, PencilSimple, Plus, Trash, Wrench, XIcon } from '@phosphor-icons/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { Button } from '../../../components/button/Button';
import type { ArchivedTrackedRepository, GroupSummary, TagFilterSummary } from '../../../types/git';

type SettingsManagementModalProps = {
  isOpen: boolean;
  initialTab?: 'tags' | 'groups' | 'archived-repositories';
  groups: GroupSummary[];
  tags: TagFilterSummary[];
  archivedRepos?: ArchivedTrackedRepository[];
  danglingTagNames: string[];
  onClose: () => void;
  onCreateGroup: (groupName: string, colorHex?: string) => Promise<string | null>;
  onCreateTag: (tagName: string, colorHex?: string) => Promise<string | null>;
  onUpdateGroup: (id: string, groupName: string, colorHex: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onUpdateTag: (id: string, tagName: string, colorHex: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  onCleanupDanglingTags: () => Promise<number>;
  onRestoreRepository?: (repoId: string) => Promise<void>;
  onPurgeRepository?: (repoId: string) => Promise<void>;
  onMetadataImported?: () => Promise<void>;
};

type Tab = 'tags' | 'groups' | 'archived-repositories';

function defaultTagColor() {
  return '#3B82F6';
}

function defaultGroupColor() {
  return '#64748B';
}

export function SettingsManagementModal({
  isOpen,
  initialTab = 'tags',
  groups,
  tags,
  archivedRepos = [],
  danglingTagNames,
  onClose,
  onCreateGroup,
  onCreateTag,
  onUpdateGroup,
  onDeleteGroup,
  onUpdateTag,
  onDeleteTag,
  onCleanupDanglingTags,
  onRestoreRepository = async () => {},
  onPurgeRepository = async () => {},
  onMetadataImported = async () => {},
}: SettingsManagementModalProps) {
  const { addToast } = useNotifications();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } = useBackdropDismiss(dialogRef, onClose, isOpen);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tagDrafts, setTagDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [tagCreateDraft, setTagCreateDraft] = useState({ name: '', color: defaultTagColor() });
  const [groupCreateDraft, setGroupCreateDraft] = useState({ name: '', color: defaultGroupColor() });
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagFilterSummary | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<GroupSummary | null>(null);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [repositoryToPurge, setRepositoryToPurge] = useState<ArchivedTrackedRepository | null>(null);
  const [busyRepositoryId, setBusyRepositoryId] = useState<string | null>(null);
  const [isMetadataBusy, setIsMetadataBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setTab(initialTab);
    setTagCreateDraft({ name: '', color: defaultTagColor() });
    setGroupCreateDraft({ name: '', color: defaultGroupColor() });
    setIsCreatingTag(false);
    setIsCreatingGroup(false);
    setTagToDelete(null);
    setGroupToDelete(null);
    setIsCleanupConfirmOpen(false);
    setRepositoryToPurge(null);
    setBusyRepositoryId(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    const nextTagDrafts: Record<string, { name: string; color: string }> = {};
    tags.forEach((tag) => {
      nextTagDrafts[tag.id] = { name: tag.tag_name, color: tag.color_hex };
    });

    const nextGroupDrafts: Record<string, { name: string; color: string }> = {};
    groups.forEach((group) => {
      nextGroupDrafts[group.id] = { name: group.group_name, color: group.color_hex };
    });

    setTagDrafts(nextTagDrafts);
    setGroupDrafts(nextGroupDrafts);
  }, [groups, isOpen, tags]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !tagToDelete && !groupToDelete && !isCleanupConfirmOpen && !repositoryToPurge) {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [groupToDelete, isCleanupConfirmOpen, isOpen, onClose, repositoryToPurge, tagToDelete]);

  const danglingLabel = useMemo(() => danglingTagNames.join(', '), [danglingTagNames]);

  const handleExportMetadata = async () => {
    setIsMetadataBusy(true);
    try {
      const path = await save({
        defaultPath: 'branch-schematic-workspace.json',
        filters: [{ name: 'Workspace metadata', extensions: ['json'] }],
      });
      if (!path) return;
      await invoke('export_workspace_metadata_command', { path });
      addToast({ variant: 'success', title: 'Workspace exported', message: 'Groups and tags were saved successfully.' });
    } catch (error) {
      addToast({ variant: 'error', title: 'Export failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsMetadataBusy(false);
    }
  };

  const handleImportMetadata = async () => {
    setIsMetadataBusy(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Workspace metadata', extensions: ['json'] }],
      });
      const path = typeof selected === 'string' ? selected : null;
      if (!path) return;
      await invoke('import_workspace_metadata_command', { path });
      await onMetadataImported();
      addToast({ variant: 'success', title: 'Workspace imported', message: 'Groups and tags were restored.' });
    } catch (error) {
      addToast({ variant: 'error', title: 'Import failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsMetadataBusy(false);
    }
  };

  const handleCreateTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = tagCreateDraft.name.trim();
    if (!trimmedName) {
      addToast({
        variant: 'warning',
        title: 'Tag name required',
        message: 'Please enter a tag name before creating it.',
      });
      return;
    }

    setIsCreatingTag(true);
    try {
      const createdId = await onCreateTag(trimmedName, tagCreateDraft.color);
      if (createdId) {
        addToast({
          variant: 'success',
          title: 'Tag created',
          message: `"${trimmedName}" is ready to use.`,
        });
        setTagCreateDraft({ name: '', color: defaultTagColor() });
      } else {
        addToast({
          variant: 'error',
          title: 'Tag creation failed',
          message: 'The tag could not be created.',
        });
      }
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Tag creation failed',
        message: error instanceof Error ? error.message : 'The tag could not be created.',
      });
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = groupCreateDraft.name.trim();
    if (!trimmedName) {
      addToast({
        variant: 'warning',
        title: 'Group name required',
        message: 'Please enter a group name before creating it.',
      });
      return;
    }

    setIsCreatingGroup(true);
    try {
      const createdId = await onCreateGroup(trimmedName, groupCreateDraft.color);
      if (createdId) {
        addToast({
          variant: 'success',
          title: 'Group created',
          message: `"${trimmedName}" is ready to use.`,
        });
        setGroupCreateDraft({ name: '', color: defaultGroupColor() });
      } else {
        addToast({
          variant: 'error',
          title: 'Group creation failed',
          message: 'The group could not be created.',
        });
      }
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Group creation failed',
        message: error instanceof Error ? error.message : 'The group could not be created.',
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleSaveTag = async (tag: TagFilterSummary, draft: { name: string; color: string }) => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      addToast({
        variant: 'warning',
        title: 'Tag name required',
        message: 'Tag names cannot be empty.',
      });
      return;
    }

    try {
      await onUpdateTag(tag.id, trimmedName, draft.color);
      addToast({
        variant: 'success',
        title: 'Tag updated',
        message: `"${trimmedName}" has been saved.`,
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Tag update failed',
        message: error instanceof Error ? error.message : 'The tag could not be updated.',
      });
    }
  };

  const handleDeleteTag = (tag: TagFilterSummary) => {
    setTagToDelete(tag);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;

    const tag = tagToDelete;
    setTagToDelete(null);

    try {
      await onDeleteTag(tag.id);
      addToast({
        variant: 'success',
        title: 'Tag deleted',
        message: `"${tag.tag_name}" has been removed.`,
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Tag deletion failed',
        message: error instanceof Error ? error.message : 'The tag could not be deleted.',
      });
    }
  };

  const handleSaveGroup = async (group: GroupSummary, draft: { name: string; color: string }) => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      addToast({
        variant: 'warning',
        title: 'Group name required',
        message: 'Group names cannot be empty.',
      });
      return;
    }

    try {
      await onUpdateGroup(group.id, trimmedName, draft.color);
      addToast({
        variant: 'success',
        title: 'Group updated',
        message: `"${trimmedName}" has been saved.`,
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Group update failed',
        message: error instanceof Error ? error.message : 'The group could not be updated.',
      });
    }
  };

  const handleDeleteGroup = (group: GroupSummary) => {
    setGroupToDelete(group);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;

    const group = groupToDelete;
    setGroupToDelete(null);

    try {
      await onDeleteGroup(group.id);
      addToast({
        variant: 'success',
        title: 'Group deleted',
        message: `"${group.group_name}" has been removed.`,
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Group deletion failed',
        message: error instanceof Error ? error.message : 'The group could not be deleted.',
      });
    }
  };

  const handleCleanup = () => {
    setIsCleanupConfirmOpen(true);
  };

  const handleRestoreRepository = async (repository: ArchivedTrackedRepository) => {
    setBusyRepositoryId(repository.id);
    try {
      await onRestoreRepository(repository.id);
      addToast({ variant: 'success', title: 'Repository restored', message: `${repository.display_name} is active again.` });
    } catch (error) {
      addToast({ variant: 'error', title: 'Restore failed', message: error instanceof Error ? error.message : 'The repository could not be restored.' });
    } finally {
      setBusyRepositoryId(null);
    }
  };

  const confirmPurgeRepository = async () => {
    if (!repositoryToPurge) return;
    const repository = repositoryToPurge;
    setRepositoryToPurge(null);
    setBusyRepositoryId(repository.id);
    try {
      await onPurgeRepository(repository.id);
      addToast({ variant: 'success', title: 'Repository purged', message: `${repository.display_name} was removed from the local catalog.` });
    } catch (error) {
      addToast({ variant: 'error', title: 'Purge failed', message: error instanceof Error ? error.message : 'The repository could not be purged.' });
    } finally {
      setBusyRepositoryId(null);
    }
  };

  const confirmCleanup = async () => {
    setIsCleanupConfirmOpen(false);

    try {
      const removed = await onCleanupDanglingTags();
      addToast({
        variant: 'success',
        title: 'Dangling tags cleaned up',
        message: removed > 0 ? `${removed} unused tags removed.` : 'No dangling tags needed cleanup.',
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'The cleanup could not be completed.',
      });
    }
  };

  const tagCreateWarning = null;
  const groupCreateWarning = null;

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-overlay management-modal-overlay"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={dialogRef}
        className="app-modal app-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-management-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <h3 id="data-management-modal-title">Data Management</h3>
          <div className="management-metadata-actions">
            <Button type="button" variant="basic" onClick={handleExportMetadata} disabled={isMetadataBusy}>Export</Button>
            <Button type="button" variant="basic" onClick={handleImportMetadata} disabled={isMetadataBusy}>Import</Button>
          </div>
          <Button type="button" variant="close" className="app-modal-close" onClick={onClose} aria-label="Close management modal">
            <XIcon size={14} weight="bold" />
          </Button>
        </div>

        <div className="management-tabs" role="tablist" aria-label="Workspace management sections">
          <Button
            type="button"
            variant="basic"
            role="tab"
            id="data-management-tab-tags"
            aria-selected={tab === 'tags'}
            aria-controls="data-management-panel-tags"
            className={`management-tab${tab === 'tags' ? ' is-active' : ''}`}
            onClick={() => setTab('tags')}
          >
            Tags
          </Button>
          <Button
            type="button"
            variant="basic"
            role="tab"
            id="data-management-tab-groups"
            aria-selected={tab === 'groups'}
            aria-controls="data-management-panel-groups"
            className={`management-tab${tab === 'groups' ? ' is-active' : ''}`}
            onClick={() => setTab('groups')}
          >
            Groups
          </Button>
          <Button
            type="button"
            variant="basic"
            role="tab"
            id="data-management-tab-archived-repositories"
            aria-selected={tab === 'archived-repositories'}
            aria-controls="data-management-panel-archived-repositories"
            className={`management-tab${tab === 'archived-repositories' ? ' is-active' : ''}`}
            onClick={() => setTab('archived-repositories')}
          >
            Archived repositories{archivedRepos.length > 0 ? ` (${archivedRepos.length})` : ''}
          </Button>
        </div>

        <div className="app-modal-body">
          {tab === 'tags' && (
            <div id="data-management-panel-tags" role="tabpanel" aria-labelledby="data-management-tab-tags" tabIndex={0} className="management-list">
              <form className="management-create-row" onSubmit={handleCreateTag}>
                <input
                  type="text"
                  value={tagCreateDraft.name}
                  onChange={(event) => setTagCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Create a new tag"
                />
                <input
                  type="color"
                  aria-label="Choose color for new tag"
                  value={tagCreateDraft.color}
                  onChange={(event) => setTagCreateDraft((prev) => ({ ...prev, color: event.target.value }))}
                />
                <Button
                  type="submit"
                  variant="submit"
                  disabled={isCreatingTag || !tagCreateDraft.name.trim() || Boolean(tagCreateWarning)}
                >
                  <Plus size={14} weight="bold" />
                  {isCreatingTag ? 'Creating…' : 'Create'}
                </Button>
              </form>
              {tagCreateWarning && <p className="management-helper-text error">{tagCreateWarning}</p>}

              {tags.map((tag) => {
                const draft = tagDrafts[tag.id] ?? { name: tag.tag_name, color: tag.color_hex };
                const isDirty = draft.name.trim() !== tag.tag_name.trim() || draft.color.toLowerCase() !== tag.color_hex.toLowerCase();
                return (
                  <div key={tag.id} className="management-row">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) =>
                        setTagDrafts((prev) => ({ ...prev, [tag.id]: { ...draft, name: event.target.value } }))
                      }
                    />
                    <input
                      type="color"
                      aria-label={`Choose color for tag ${tag.tag_name}`}
                      value={draft.color}
                      onChange={(event) =>
                        setTagDrafts((prev) => ({ ...prev, [tag.id]: { ...draft, color: event.target.value } }))
                      }
                    />
                    <span className="management-count">{tag.repo_count} repos</span>
                    <Button
                      type="button"
                      variant="basic"
                      disabled={!isDirty}
                      onClick={() => {
                        void handleSaveTag(tag, draft);
                      }}
                    >
                      <PencilSimple size={14} />
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        void handleDeleteTag(tag);
                      }}
                    >
                      <Trash size={14} weight="bold" />
                      Delete
                    </Button>
                  </div>
                );
              })}

              <div className="management-cleanup">
                <div>
                  <strong>Dangling tags</strong>
                  <p>{danglingLabel || 'None currently detected.'}</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    handleCleanup();
                  }}
                >
                  <Wrench size={14} weight="bold" />
                  Cleanup Unused
                </Button>
              </div>
            </div>
          )}

          {tab === 'groups' && (
            <div id="data-management-panel-groups" role="tabpanel" aria-labelledby="data-management-tab-groups" tabIndex={0} className="management-list">
              <form className="management-create-row" onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  value={groupCreateDraft.name}
                  onChange={(event) => setGroupCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Create a new group"
                />
                <input
                  type="color"
                  aria-label="Choose color for new group"
                  value={groupCreateDraft.color}
                  onChange={(event) => setGroupCreateDraft((prev) => ({ ...prev, color: event.target.value }))}
                />
                <Button
                  type="submit"
                  variant="submit"
                  disabled={isCreatingGroup || !groupCreateDraft.name.trim() || Boolean(groupCreateWarning)}
                >
                  <Plus size={14} weight="bold" />
                  {isCreatingGroup ? 'Creating…' : 'Create'}
                </Button>
              </form>
              {groupCreateWarning && <p className="management-helper-text error">{groupCreateWarning}</p>}

              {groups.map((group) => {
                const draft = groupDrafts[group.id] ?? { name: group.group_name, color: group.color_hex };
                const isDirty = draft.name.trim() !== group.group_name.trim() || draft.color.toLowerCase() !== group.color_hex.toLowerCase();
                return (
                  <div key={group.id} className="management-row">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) =>
                        setGroupDrafts((prev) => ({ ...prev, [group.id]: { ...draft, name: event.target.value } }))
                      }
                    />
                    <input
                      type="color"
                      aria-label={`Choose color for group ${group.group_name}`}
                      value={draft.color}
                      onChange={(event) =>
                        setGroupDrafts((prev) => ({ ...prev, [group.id]: { ...draft, color: event.target.value } }))
                      }
                    />
                    <span className="management-count">{group.repo_count} repos</span>
                    <Button
                      type="button"
                      variant="basic"
                      disabled={!isDirty}
                      onClick={() => {
                        void handleSaveGroup(group, draft);
                      }}
                    >
                      <PencilSimple size={14} weight="bold" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        void handleDeleteGroup(group);
                      }}
                    >
                      <Trash size={14} weight="bold" />
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'archived-repositories' && (
            <div id="data-management-panel-archived-repositories" role="tabpanel" aria-labelledby="data-management-tab-archived-repositories" tabIndex={0} className="management-list">
              <p className="management-helper-text">
                Archived repositories are hidden from the workspace but remain on disk. Restore one to monitor it again, or purge its cached catalog data permanently.
              </p>
              {archivedRepos.length === 0 ? (
                <div className="management-empty-state">No archived repositories.</div>
              ) : (
                archivedRepos.map((repository) => (
                  <div key={repository.id} className="management-row archived-repository-row">
                    <div className="archived-repository-details">
                      <strong>{repository.display_name}</strong>
                      <span>{repository.absolute_path}</span>
                      {repository.archived_at && <small>Archived {new Date(repository.archived_at).toLocaleString()}</small>}
                    </div>
                    <Button
                      type="button"
                      variant="basic"
                      disabled={busyRepositoryId === repository.id}
                      onClick={() => void handleRestoreRepository(repository)}
                    >
                      <ArrowCounterClockwise size={14} weight="bold" />
                      {busyRepositoryId === repository.id ? 'Working…' : 'Restore'}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busyRepositoryId === repository.id}
                      onClick={() => setRepositoryToPurge(repository)}
                    >
                      <Trash size={14} weight="bold" />
                      Purge
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(tagToDelete)}
        title="Delete tag"
        message={
          <>
            Delete tag <strong>{tagToDelete?.tag_name}</strong>? This removes it from all repositories.
          </>
        }
        confirmLabel="Delete tag"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          void confirmDeleteTag();
        }}
        onCancel={() => setTagToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(repositoryToPurge)}
        title="Purge archived repository"
        message={
          <>
            Permanently remove <strong>{repositoryToPurge?.display_name}</strong> from the local catalog? This does not delete any files from disk and cannot be undone here.
          </>
        }
        confirmLabel="Purge repository"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void confirmPurgeRepository()}
        onCancel={() => setRepositoryToPurge(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(groupToDelete)}
        title="Delete group"
        message={
          <>
            Delete group <strong>{groupToDelete?.group_name}</strong>? Repositories using it will be left without a group.
          </>
        }
        confirmLabel="Delete group"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          void confirmDeleteGroup();
        }}
        onCancel={() => setGroupToDelete(null)}
      />

      <ConfirmationModal
        isOpen={isCleanupConfirmOpen}
        title="Cleanup unused tags"
        message={
          <>
            Remove dangling tags that are no longer associated with any repositories? This action cannot be undone.
          </>
        }
        confirmLabel="Cleanup tags"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          void confirmCleanup();
        }}
        onCancel={() => setIsCleanupConfirmOpen(false)}
      />
    </div>
  );
}
