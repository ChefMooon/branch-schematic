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
  return (
    <div className="bulk-action-toolbar" role="toolbar" aria-label="Bulk repository actions">
      <div className="bulk-action-toolbar__summary">
        <strong>{selectedCount}</strong>
        <span>{selectedCount === 1 ? "workspace selected" : "workspaces selected"}</span>
      </div>
      <div className="bulk-action-toolbar__actions">
        <button type="button" className="bulk-action-toolbar__button" onClick={() => void onBulkRefresh()}>
          Refresh status
        </button>
        <button type="button" className="bulk-action-toolbar__button bulk-action-toolbar__button-danger" onClick={() => void onBulkUntrack()}>
          Untrack
        </button>
        <button type="button" className="bulk-action-toolbar__button bulk-action-toolbar__button-muted" onClick={onClearSelection}>
          Clear
        </button>
      </div>
    </div>
  );
}
