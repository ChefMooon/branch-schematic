import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquareIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SquareIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback } from 'react';
import { Button } from '../../../../components/button/Button';
import { ConfirmationModal } from '../../../../components/Modal/ConfirmationModal';
import { useNotifications } from '../../../../components/notifications/NotificationProvider';
import { useBackdropDismiss } from '../../../../hooks/useBackdropDismiss';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } = useBackdropDismiss(dialogRef, onClose, isOpen);

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

  const commitSelection = useCallback(async (nextTagNames: string[]) => {
    const normalized = Array.from(new Set(nextTagNames.map((tagName) => tagName.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    await onApply(normalized);
    setSelected(new Set(normalized));
  }, [onApply]);

  if (!isOpen) return null;

  const toggleTag = async (tagName: string) => {
    const next = new Set(selected);
    if (next.has(tagName)) {
      next.delete(tagName);
    } else {
      next.add(tagName);
    }

    await commitSelection(Array.from(next));
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
        const next = new Set(selected);
        next.add(clean);
        await commitSelection(Array.from(next));
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
      const next = new Set(selected);
      next.delete(tag.tag_name);
      await commitSelection(Array.from(next));
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
      <div
        className="app-modal-overlay"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={dialogRef} className="app-modal theme-aware-modal" onClick={(event) => event.stopPropagation()}>
          <div className="app-modal-header">
            <h3>Assign Tags</h3>
            <Button type="button" variant="close" className="app-modal-close" onClick={onClose}>
              <XIcon size={16} weight="bold" />
            </Button>
          </div>

          <div className="app-modal-body">
            <div className="tag-selection-toolbar">
              <div className="tag-selection-search">
                <MagnifyingGlassIcon size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tags"
                />
              </div>
              <div className="tag-selection-toolbar-actions">
                <Button type="button" variant="basic" onClick={() => {
                  void commitSelection(filteredTags.map((tag) => tag.tag_name));
                }}>
                  Select visible
                </Button>
                <Button type="button" variant="danger" onClick={() => {
                  void commitSelection([]);
                }}>
                  Clear
                </Button>
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
              <Button type="button" variant="submit" onClick={() => void handleCreateTag()} disabled={isCreating || !draftName.trim()}>
                <PlusIcon size={14} weight="bold" />
                {isCreating ? 'Creating…' : 'Create'}
              </Button>
            </div>

            <div className="tag-selection-grid">
              {filteredTags.map((tag) => {
                const checked = selected.has(tag.tag_name);
                return (
                  <div key={tag.id} className={`tag-selection-item ${checked ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="tag-selection-item-main"
                      onClick={() => {
                        void toggleTag(tag.tag_name);
                      }}
                    >
                      {checked ? <CheckSquareIcon size={16} weight="fill" /> : <SquareIcon size={16} />}
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
                        <TrashIcon size={14} weight="bold" />
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
            <Button type="button" variant="basic" onClick={handleOpenManagement}>
              Manage Global Tags
            </Button>
            <Button type="button" variant="danger" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="submit"
              onClick={() => {
                onClose();
              }}
            >
              Done
            </Button>
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
