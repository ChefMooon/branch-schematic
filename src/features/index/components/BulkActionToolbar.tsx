import { useState } from 'react';

import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';

type BulkActionToolbarProps = {
  selectedCount: number;
  onBulkUntrack: () => void | Promise<void>;
  onBulkRefresh: () => void | Promise<void>;
  onClearSelection: () => void;
};

export function BulkActionToolbar({
  selectedCount,
  onBulkUntrack,
  onBulkRefresh,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [showUntrackConfirmation, setShowUntrackConfirmation] = useState(false);

  const handleUntrackConfirm = async () => {
    setShowUntrackConfirmation(false);
    await onBulkUntrack();
  };

  return (
    <>
      <div className="bulk-action-toolbar" role="toolbar" aria-label="Bulk repository actions">
        <div className="bulk-action-toolbar__summary">
          <strong>{selectedCount}</strong>
          <span>{selectedCount === 1 ? 'workspace selected' : 'workspaces selected'}</span>
        </div>
        <div className="bulk-action-toolbar__actions">
          <button type="button" className="bulk-action-toolbar__button" onClick={() => void onBulkRefresh()}>
            Refresh status
          </button>
          <button
            type="button"
            className="bulk-action-toolbar__button bulk-action-toolbar__button-danger"
            onClick={() => setShowUntrackConfirmation(true)}
          >
            Untrack
          </button>
          <button type="button" className="bulk-action-toolbar__button bulk-action-toolbar__button-muted" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showUntrackConfirmation}
        title="Untrack selected workspaces"
        message={
          <>
            {selectedCount === 1
              ? 'This will remove the selected workspace from your workspace list. This action cannot be undone.'
              : `This will remove the ${selectedCount} selected workspaces from your workspace list. This action cannot be undone.`}
          </>
        }
        confirmLabel="Yes, untrack"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleUntrackConfirm()}
        onCancel={() => setShowUntrackConfirmation(false)}
      />
    </>
  );
}
