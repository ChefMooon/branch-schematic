import { useEffect, useMemo, useState } from 'react';
import { PencilSimple, Trash, Wrench, X } from '@phosphor-icons/react';
import type { GroupSummary, TagFilterSummary } from '../../../types/git';

type SettingsManagementModalProps = {
  isOpen: boolean;
  groups: GroupSummary[];
  tags: TagFilterSummary[];
  danglingTagNames: string[];
  onClose: () => void;
  onUpdateGroup: (id: string, groupName: string, colorHex: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onUpdateTag: (id: string, tagName: string, colorHex: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  onCleanupDanglingTags: () => Promise<number>;
};

type Tab = 'tags' | 'groups';

export function SettingsManagementModal({
  isOpen,
  groups,
  tags,
  danglingTagNames,
  onClose,
  onUpdateGroup,
  onDeleteGroup,
  onUpdateTag,
  onDeleteTag,
  onCleanupDanglingTags,
}: SettingsManagementModalProps) {
  const [tab, setTab] = useState<Tab>('tags');
  const [tagDrafts, setTagDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; color: string }>>({});

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
  }, [isOpen, groups, tags]);

  const danglingLabel = useMemo(() => danglingTagNames.join(', '), [danglingTagNames]);

  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay" onClick={onClose}>
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
              {tags.map((tag) => {
                const draft = tagDrafts[tag.id] ?? { name: tag.tag_name, color: tag.color_hex };
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
                      onClick={() => {
                        void onUpdateTag(tag.id, draft.name, draft.color);
                      }}
                    >
                      <PencilSimple size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      onClick={() => {
                        void onDeleteTag(tag.id);
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
                  className="btn-secondary"
                  onClick={() => {
                    void onCleanupDanglingTags();
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
              {groups.map((group) => {
                const draft = groupDrafts[group.id] ?? { name: group.group_name, color: group.color_hex };
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
                      onClick={() => {
                        void onUpdateGroup(group.id, draft.name, draft.color);
                      }}
                    >
                      <PencilSimple size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      onClick={() => {
                        void onDeleteGroup(group.id);
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
    </div>
  );
}
