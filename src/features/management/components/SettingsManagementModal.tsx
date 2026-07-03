import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PencilSimple, Plus, Trash, Wrench, X } from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import type { GroupSummary, TagFilterSummary } from '../../../types/git';

type SettingsManagementModalProps = {
  isOpen: boolean;
  groups: GroupSummary[];
  tags: TagFilterSummary[];
  danglingTagNames: string[];
  onClose: () => void;
  onCreateGroup: (groupName: string, colorHex?: string) => Promise<string | null>;
  onCreateTag: (tagName: string, colorHex?: string) => Promise<string | null>;
  onUpdateGroup: (id: string, groupName: string, colorHex: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onUpdateTag: (id: string, tagName: string, colorHex: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  onCleanupDanglingTags: () => Promise<number>;
};

type Tab = 'tags' | 'groups';

function defaultTagColor() {
  return '#3B82F6';
}

function defaultGroupColor() {
  return '#64748B';
}

export function SettingsManagementModal({
  isOpen,
  groups,
  tags,
  danglingTagNames,
  onClose,
  onCreateGroup,
  onCreateTag,
  onUpdateGroup,
  onDeleteGroup,
  onUpdateTag,
  onDeleteTag,
  onCleanupDanglingTags,
}: SettingsManagementModalProps) {
  const { addToast } = useNotifications();
  const [tab, setTab] = useState<Tab>('tags');
  const [tagDrafts, setTagDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [tagCreateDraft, setTagCreateDraft] = useState({ name: '', color: defaultTagColor() });
  const [groupCreateDraft, setGroupCreateDraft] = useState({ name: '', color: defaultGroupColor() });
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagFilterSummary | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<GroupSummary | null>(null);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);

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
    setTagCreateDraft({ name: '', color: defaultTagColor() });
    setGroupCreateDraft({ name: '', color: defaultGroupColor() });
    setIsCreatingTag(false);
    setIsCreatingGroup(false);
  }, [isOpen, groups, tags]);

  const danglingLabel = useMemo(() => danglingTagNames.join(', '), [danglingTagNames]);

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
    <div className="app-modal-overlay management-modal-overlay" onClick={onClose}>
      <div className="app-modal app-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <h3>Tag and Group Management</h3>
          <button type="button" className="app-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="management-tabs">
          <button
            type="button"
            className={`management-tab ${tab === 'tags' ? 'active' : ''}`}
            onClick={() => setTab('tags')}
          >
            Tags
          </button>
          <button
            type="button"
            className={`management-tab ${tab === 'groups' ? 'active' : ''}`}
            onClick={() => setTab('groups')}
          >
            Groups
          </button>
        </div>

        <div className="app-modal-body">
          {tab === 'tags' && (
            <div className="management-list">
              <form className="management-create-row" onSubmit={handleCreateTag}>
                <input
                  type="text"
                  value={tagCreateDraft.name}
                  onChange={(event) => setTagCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Create a new tag"
                />
                <input
                  type="color"
                  value={tagCreateDraft.color}
                  onChange={(event) => setTagCreateDraft((prev) => ({ ...prev, color: event.target.value }))}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreatingTag || !tagCreateDraft.name.trim() || Boolean(tagCreateWarning)}
                >
                  <Plus size={14} />
                  {isCreatingTag ? 'Creating…' : 'Create'}
                </button>
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
                      value={draft.color}
                      onChange={(event) =>
                        setTagDrafts((prev) => ({ ...prev, [tag.id]: { ...draft, color: event.target.value } }))
                      }
                    />
                    <span className="management-count">{tag.repo_count} repos</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!isDirty}
                      onClick={() => {
                        void handleSaveTag(tag, draft);
                      }}
                    >
                      <PencilSimple size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      onClick={() => {
                        void handleDeleteTag(tag);
                      }}
                    >
                      <Trash size={14} />
                      Delete
                    </button>
                  </div>
                );
              })}

              <div className="management-cleanup">
                <div>
                  <strong>Dangling tags</strong>
                  <p>{danglingLabel || 'None currently detected.'}</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary danger"
                  onClick={() => {
                    handleCleanup();
                  }}
                >
                  <Wrench size={14} />
                  Cleanup Unused
                </button>
              </div>
            </div>
          )}

          {tab === 'groups' && (
            <div className="management-list">
              <form className="management-create-row" onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  value={groupCreateDraft.name}
                  onChange={(event) => setGroupCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Create a new group"
                />
                <input
                  type="color"
                  value={groupCreateDraft.color}
                  onChange={(event) => setGroupCreateDraft((prev) => ({ ...prev, color: event.target.value }))}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreatingGroup || !groupCreateDraft.name.trim() || Boolean(groupCreateWarning)}
                >
                  <Plus size={14} />
                  {isCreatingGroup ? 'Creating…' : 'Create'}
                </button>
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
                      value={draft.color}
                      onChange={(event) =>
                        setGroupDrafts((prev) => ({ ...prev, [group.id]: { ...draft, color: event.target.value } }))
                      }
                    />
                    <span className="management-count">{group.repo_count} repos</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!isDirty}
                      onClick={() => {
                        void handleSaveGroup(group, draft);
                      }}
                    >
                      <PencilSimple size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      onClick={() => {
                        void handleDeleteGroup(group);
                      }}
                    >
                      <Trash size={14} />
                      Delete
                    </button>
                  </div>
                );
              })}
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
