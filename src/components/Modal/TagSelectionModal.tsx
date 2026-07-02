import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Plus, Square, X } from '@phosphor-icons/react';
import type { TagFilterSummary } from '../../types/git';

type TagSelectionModalProps = {
  isOpen: boolean;
  availableTags: TagFilterSummary[];
  assignedTagNames: string[];
  onClose: () => void;
  onApply: (nextTagNames: string[]) => Promise<void>;
  onOpenManagement?: () => void;
  onOpenManagementModal?: () => void;
};

export function TagSelectionModal({
  isOpen,
  availableTags,
  assignedTagNames,
  onClose,
  onApply,
  onOpenManagement,
  onOpenManagementModal,
}: TagSelectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set(assignedTagNames));
    setDraftName('');
  }, [isOpen, assignedTagNames]);

  const normalizedAvailable = useMemo(
    () => availableTags.map((tag) => tag.tag_name),
    [availableTags],
  );

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

  const addDraftTag = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setSelected((prev) => new Set([...prev, clean]));
    setDraftName('');
  };

  const orderedSelected = Array.from(selected).sort((a, b) => a.localeCompare(b));

  const handleOpenManagement = () => {
    const openManagement = onOpenManagement ?? onOpenManagementModal;
    openManagement?.();
    window.dispatchEvent(new Event('open-management-modal'));
    onClose();
  };

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal theme-aware-modal" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <h3>Assign Tags</h3>
          <button type="button" className="app-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="app-modal-body">
          <div className="tag-selection-grid">
            {availableTags.map((tag) => {
              const checked = selected.has(tag.tag_name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-selection-item ${checked ? 'active' : ''}`}
                  onClick={() => toggleTag(tag.tag_name)}
                >
                  {checked ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                  <span className="tag-selection-color" style={{ backgroundColor: tag.color_hex }} />
                  <span>{tag.tag_name}</span>
                </button>
              );
            })}
          </div>

          <div className="tag-draft-row">
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Create new tag..."
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addDraftTag();
                }
              }}
            />
            <button type="button" className="btn-secondary" onClick={addDraftTag}>
              <Plus size={14} />
              Add
            </button>
          </div>

          <div className="tag-selected-preview">
            Selected: {orderedSelected.length > 0 ? orderedSelected.join(', ') : 'None'}
          </div>

          {normalizedAvailable.length === 0 && (
            <div className="tag-selected-preview">No global tags yet. Add one above to create and assign it.</div>
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
  );
}
