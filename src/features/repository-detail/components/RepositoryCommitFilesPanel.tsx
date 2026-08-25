import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CaretDown, CaretUp, GitBranch, Hash } from '@phosphor-icons/react';
import { PushStatusIndicator } from '../../../components/push-status-indicator/PushStatusIndicator';
import type { CommitChangedFile } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';

interface RepositoryCommitFilesPanelProps {
  commit: CommitRecord | null;
  branchLabel: string;
  files: CommitChangedFile[] | null;
  isLoading: boolean;
  error: string | null;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  style?: CSSProperties;
}

function statusBadgeClass(status: CommitChangedFile['status']) {
  if (status === 'copied') return 'repository-view-change-badge--renamed';
  return `repository-view-change-badge--${status}`;
}

function formatCommitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function RepositoryCommitFilesPanel({
  commit,
  branchLabel,
  files,
  isLoading,
  error,
  selectedPath,
  onSelectPath,
  style,
}: RepositoryCommitFilesPanelProps) {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  useEffect(() => {
    setIsSummaryExpanded(false);
  }, [commit?.commit_hash]);

  const fileCount = files?.length ?? 0;

  return (
    <div
      className="repository-view-changes-panel repository-view-changes-panel--list repository-view-commit-files-panel"
      style={style}
    >
      <div className="repository-view-changes-panel-header">
        <div>
          <p className="repository-view-eyebrow">Commit changes</p>
          <h3>{fileCount} {fileCount === 1 ? 'file' : 'files'}</h3>
        </div>
      </div>

      {commit ? (
        <div className="repository-view-commit-summary">
          <button
            type="button"
            className="repository-view-commit-summary-strip"
            onClick={() => setIsSummaryExpanded((current) => !current)}
            aria-expanded={isSummaryExpanded}
            title={`${commit.commit_message} — ${commit.author_name} — ${formatCommitDate(commit.committed_at)}`}
          >
            <span className="repository-view-commit-summary-message">{commit.commit_message}</span>
            <span
              className="repository-view-commit-summary-hash"
              title={commit.commit_hash}
            >
              <Hash size={12} weight="bold" />
              {commit.commit_hash.slice(0, 8)}
            </span>
            {isSummaryExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>
          {isSummaryExpanded ? (
            <div className="repository-view-commit-summary-details">
              <span className="repository-view-label">Author</span>
              <span className="repository-view-value">{commit.author_name}</span>
              <span className="repository-view-label">Committed</span>
              <span className="repository-view-value">{formatCommitDate(commit.committed_at)}</span>
              <span className="repository-view-label">Signature</span>
              <span className="repository-view-value">{commit.signature_status ?? 'Not available'}</span>
              <span className="repository-view-label">Branch</span>
              <span className="repository-view-value repository-view-commit-summary-branch">
                <GitBranch size={12} weight="fill" />
                {branchLabel}
                {commit.push_state === 'unpushed' && <PushStatusIndicator />}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="repository-view-empty-state">Loading changed files…</div>
      ) : error ? (
        <div className="repository-view-empty-state repository-view-empty-state--error">{error}</div>
      ) : !files || files.length === 0 ? (
        <div className="repository-view-empty-state">No changed files in this commit.</div>
      ) : (
        <ul className="repository-view-commit-files-list">
          {files.map((file) => {
            const isSelected = file.path === selectedPath;
            return (
              <li key={`${file.status}-${file.path}`}>
                <button
                  type="button"
                  className={`repository-view-commit-file-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectPath(file.path)}
                  aria-current={isSelected ? 'true' : undefined}
                  title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                >
                  <span className="repository-view-commit-file-path">
                    {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                  </span>
                  <span className={`repository-view-change-badge ${statusBadgeClass(file.status)}`}>
                    {file.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
