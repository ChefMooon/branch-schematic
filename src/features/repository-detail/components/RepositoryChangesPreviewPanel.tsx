import { FileText } from '@phosphor-icons/react';
import type { RepositoryChangeItem, RepositoryFileDiff } from '../../../types/git';
import { formatStatusLabel } from '../types/repositoryChanges';
import { RepositoryDiffPreview } from './RepositoryDiffPreview';

interface RepositoryChangesPreviewPanelProps {
  selectedEntry: RepositoryChangeItem | null;
  fileDiff: RepositoryFileDiff | null;
  isDiffLoading: boolean;
  diffError: string | null;
  viewMode: 'unified' | 'split';
  onToggleViewMode: () => void;
}

export function RepositoryChangesPreviewPanel({
  selectedEntry,
  fileDiff,
  isDiffLoading,
  diffError,
  viewMode,
  onToggleViewMode,
}: RepositoryChangesPreviewPanelProps) {
  return (
    <div className="repository-view-changes-panel repository-view-changes-panel--preview" style={{ flex: 1 }}>
      <div className="repository-view-changes-panel-header">
        <div>
          <p className="repository-view-eyebrow">Diff preview</p>
          <h3
            className="repository-view-diff-title"
            title={selectedEntry?.path ?? undefined}
            aria-label={selectedEntry?.path ?? 'Select a file'}
          >
            {selectedEntry?.path ?? 'Select a file'}
          </h3>
        </div>
        <div className="repository-view-changes-header-actions">
          <button type="button" className="repository-view-changes-inline-action" onClick={onToggleViewMode}>
            {viewMode === 'unified' ? 'Split view' : 'Unified view'}
          </button>
        </div>
      </div>

      {!selectedEntry ? (
        <div className="repository-view-empty-state">Select a file to preview its diff.</div>
      ) : selectedEntry.isBinary ? (
        <div className="repository-view-empty-state">
          <FileText size={18} />
          Binary or unsupported files cannot be previewed as text diffs.
        </div>
      ) : (
        <div className="repository-view-diff-preview">
          <div className="repository-view-diff-toolbar">
            <span className="repository-view-change-badge repository-view-change-badge--default">{formatStatusLabel(selectedEntry.status)}</span>
            {selectedEntry.staged ? <span className="repository-view-change-badge repository-view-change-badge--staged">staged</span> : null}
            {selectedEntry.isConflicted ? <span className="repository-view-change-badge repository-view-change-badge--conflict">conflict</span> : null}
          </div>
          {fileDiff?.isTruncated && fileDiff.unavailableReason ? (
            <div className="repository-view-diff-notice">{fileDiff.unavailableReason}</div>
          ) : null}
          <RepositoryDiffPreview diff={fileDiff} isLoading={isDiffLoading} error={diffError} viewMode={viewMode} />
        </div>
      )}
    </div>
  );
}
