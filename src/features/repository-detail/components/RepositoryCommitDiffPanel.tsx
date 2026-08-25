import { FileText } from '@phosphor-icons/react';
import type { RepositoryFileDiff } from '../../../types/git';
import { RepositoryDiffPreview } from './RepositoryDiffPreview';

interface RepositoryCommitDiffPanelProps {
  filePath: string | null;
  fileDiff: RepositoryFileDiff | null;
  isDiffLoading: boolean;
  diffError: string | null;
  viewMode: 'unified' | 'split';
  onToggleViewMode: () => void;
}

export function RepositoryCommitDiffPanel({
  filePath,
  fileDiff,
  isDiffLoading,
  diffError,
  viewMode,
  onToggleViewMode,
}: RepositoryCommitDiffPanelProps) {
  return (
    <div className="repository-view-changes-panel repository-view-commit-diff-panel">
      <div className="repository-view-changes-panel-header">
        <div>
          <p className="repository-view-eyebrow">Commit diff</p>
          <h3
            className="repository-view-diff-title"
            title={filePath ?? undefined}
            aria-label={filePath ?? 'Select a changed file'}
          >
            {filePath ?? 'Select a changed file'}
          </h3>
        </div>
        <div className="repository-view-changes-header-actions">
          <button type="button" className="repository-view-changes-inline-action" onClick={onToggleViewMode}>
            {viewMode === 'unified' ? 'Split view' : 'Unified view'}
          </button>
        </div>
      </div>

      {!filePath ? (
        <div className="repository-view-empty-state">Select a file to preview its diff.</div>
      ) : fileDiff?.isBinary ? (
        <div className="repository-view-empty-state">
          <FileText size={18} />
          Binary or unsupported files cannot be previewed as text diffs.
        </div>
      ) : (
        <div className="repository-view-diff-preview">
          {fileDiff?.isTruncated && fileDiff.unavailableReason ? (
            <div className="repository-view-diff-notice">{fileDiff.unavailableReason}</div>
          ) : null}
          <RepositoryDiffPreview diff={fileDiff} isLoading={isDiffLoading} error={diffError} viewMode={viewMode} />
        </div>
      )}
    </div>
  );
}
