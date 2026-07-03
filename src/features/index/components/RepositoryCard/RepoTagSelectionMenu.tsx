import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  MagnifyingGlass,
  Plus,
  Square,
  Trash,
  X,
} from '@phosphor-icons/react';
import { ConfirmationModal } from '../../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../../components/notifications/NotificationProvider';
import type { TagFilterSummary } from '../../../../types/git';

type TagSelectionModalProps = {
  isOpen: boolean;
  availableTags: TagFilterSummary[];
  assignedTagNames: string[];
  onClose: () => void;
  onApply: (nextTagNames: string[]) => Promise<void>;
  onCreateTag?: (tagName: string, colorHex?: string) => Promise<string | null>;
  onDeleteTag?: (id: string) => Promise<void>;
  onOpenManagement?: () => void;
  onOpenManagementModal?: () => void;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function defaultTagColor() {
  return '#3B82F6';
}

export function TagSelectionModal({
  isOpen,
  availableTags,
  assignedTagNames,
  onClose,
  onApply,
  onCreateTag,
  onDeleteTag,
  onOpenManagement,
  onOpenManagementModal,
}: TagSelectionModalProps) {
  const { addToast } = useNotifications();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(defaultTagColor());
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TagFilterSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set(assignedTagNames));
    setDraftName('');
    setDraftColor(defaultTagColor());
    setSearch('');
    setIsCreating(false);
    setDeleteTarget(null);
  }, [isOpen, assignedTagNames]);

  const filteredTags = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableTags;

    return availableTags.filter((tag) => {
      return normalizeName(tag.tag_name).includes(term);
    });
  }, [availableTags, search]);

  const orderedSelected = useMemo(() => {
    return Array.from(selected).sort((a, b) => a.localeCompare(b));
  }, [selected]);

  if (!isOpen) return null;

  const toggleTag = (tagName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  const handleCreateTag = async () => {
    const clean = draftName.trim();
    if (!clean) {
      addToast({
        variant: 'warning',
        title: 'Tag name required',
        message: 'Please enter a tag name before creating it.',
      });
      return;
    }

    if (!onCreateTag) {
      addToast({
        variant: 'error',
        title: 'Tag creation unavailable',
        message: 'Tag creation is not available right now.',
      });
      return;
    }

    setIsCreating(true);
    try {
      const createdId = await onCreateTag(clean, draftColor);
      if (createdId) {
        setSelected((prev) => new Set([...prev, clean]));
        setDraftName('');
        setDraftColor(defaultTagColor());
        addToast({
          variant: 'success',
          title: 'Tag created',
          message: `"${clean}" was created and selected for this repository.`,
        });
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
      setIsCreating(false);
    }
  };

  const handleDeleteTag = async (tag: TagFilterSummary) => {
    if (!onDeleteTag) {
      addToast({
        variant: 'error',
        title: 'Tag deletion unavailable',
        message: 'Tag deletion is not available right now.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteTag(tag.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(tag.tag_name);
        return next;
      });
      addToast({
        variant: 'success',
        title: 'Tag deleted',
        message: `"${tag.tag_name}" was removed from the global tag list.`,
      });
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Tag deletion failed',
        message: error instanceof Error ? error.message : 'The tag could not be deleted.',
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleOpenManagement = () => {
    const openManagement = onOpenManagement ?? onOpenManagementModal;
    openManagement?.();
    window.dispatchEvent(new Event('open-management-modal'));
    onClose();
  };

  return (
    <>
      <div className="app-modal-overlay" onClick={onClose}>
        <div className="app-modal theme-aware-modal" onClick={(event) => event.stopPropagation()}>
          <div className="app-modal-header">
            <h3>Assign Tags</h3>
            <button type="button" className="app-modal-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="app-modal-body">
            <div className="tag-selection-toolbar">
              <div className="tag-selection-search">
                <MagnifyingGlass size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tags"
                />
              </div>
              <div className="tag-selection-toolbar-actions">
                <button type="button" className="btn-secondary" onClick={() => setSelected(new Set(filteredTags.map((tag) => tag.tag_name)))}>
                  Select visible
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
            </div>

            <div className="tag-creation-row">
              <input
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Create a new tag"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreateTag();
                  }
                }}
              />
              <input
                type="color"
                value={draftColor}
                onChange={(event) => setDraftColor(event.target.value)}
                aria-label="Choose tag color"
              />
              <button type="button" className="btn-primary" onClick={() => void handleCreateTag()} disabled={isCreating || !draftName.trim()}>
                <Plus size={14} />
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>

            <div className="tag-selection-grid">
              {filteredTags.map((tag) => {
                const checked = selected.has(tag.tag_name);
                return (
                  <div key={tag.id} className={`tag-selection-item ${checked ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="tag-selection-item-main"
                      onClick={() => toggleTag(tag.tag_name)}
                    >
                      {checked ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                      <span className="tag-selection-color" style={{ backgroundColor: tag.color_hex }} />
                      <span className="tag-selection-label">{tag.tag_name}</span>
                      <span className="tag-selection-meta">{tag.repo_count} repo{tag.repo_count === 1 ? '' : 's'}</span>
                    </button>
                    {onDeleteTag && (
                      <button
                        type="button"
                        className="tag-selection-item-delete"
                        aria-label={`Delete ${tag.tag_name}`}
                        onClick={() => setDeleteTarget(tag)}
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="tag-selected-preview">
              Selected: {orderedSelected.length > 0 ? orderedSelected.join(', ') : 'None'}
            </div>

            {availableTags.length === 0 && (
              <div className="tag-selected-preview">No global tags yet. Create one above to start organizing repositories.</div>
            )}
            {availableTags.length > 0 && filteredTags.length === 0 && (
              <div className="tag-selected-preview">No tags match your search yet. Try a different term.</div>
            )}
          </div>

          <div className="app-modal-footer">
            <button type="button" className="tag-modal-manage-link" onClick={handleOpenManagement}>
              Manage Global Tags
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void onApply(orderedSelected);
              }}
            >
              Save Tags
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete tag"
        message={deleteTarget ? `Delete "${deleteTarget.tag_name}" from the global tag list? This will remove it from any repositories using it.` : 'Delete this tag?'}
        confirmLabel="Delete"
        variant="danger"
        isBusy={isDeleting}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDeleteTag(deleteTarget);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
