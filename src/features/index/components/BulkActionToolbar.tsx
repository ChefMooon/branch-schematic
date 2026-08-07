import { useState } from 'react';
import { ArrowClockwise, PaintBrush, Trash, X } from '@phosphor-icons/react';

import { ConfirmationModal } from '../../../components/Modal/ConfirmationModal';
import { Button } from '../../../components/button/Button';

type BulkActionToolbarProps = {
  selectedCount: number;
  onBulkUntrack: () => void | Promise<void>;
  onBulkRefresh: () => void | Promise<void>;
  onBulkTheme: () => void;
  onClearSelection: () => void;
};

export function BulkActionToolbar({
  selectedCount,
  onBulkUntrack,
  onBulkRefresh,
  onBulkTheme,
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
          <Button type="button" variant="basic" className="bulk-action-toolbar__button" onClick={() => void onBulkRefresh()}>
            <ArrowClockwise size={15} weight="bold" />
            Refresh status
          </Button>
          <Button type="button" variant="basic" className="bulk-action-toolbar__button" onClick={onBulkTheme}>
            <PaintBrush size={15} weight="bold" />
            Change theme
          </Button>
          <Button
            type="button"
            variant="danger"
            className="bulk-action-toolbar__button"
            onClick={() => setShowUntrackConfirmation(true)}
          >
            <Trash size={15} weight="bold" />
            Untrack
          </Button>
          <Button type="button" variant="basic" className="bulk-action-toolbar__button bulk-action-toolbar__button-muted" onClick={onClearSelection}>
            <X size={15} weight="bold" />
            Clear
          </Button>
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
