import { Button } from '../../../components/button/Button';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type { LatestCommitInfo } from '../../../types/git';

interface RepositoryCommitComposerProps {
  title: string;
  body: string;
  stagedCount: number;
  unstagedCount: number;
  isBusy: boolean;
  latestCommit: LatestCommitInfo | null;
  isUndoing: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onCommit: () => void;
  onUndo: () => void;
}

function formatRelativeTime(timestamp: number) {
  const elapsedSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (elapsedSeconds < 60) return 'just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  if (elapsedSeconds < 2592000) return `${Math.floor(elapsedSeconds / 86400)}d ago`;
  if (elapsedSeconds < 31536000) return `${Math.floor(elapsedSeconds / 2592000)}mo ago`;
  return `${Math.floor(elapsedSeconds / 31536000)}y ago`;
}

function formatExactDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function RepositoryCommitComposer({
  title,
  body,
  stagedCount,
  unstagedCount,
  isBusy,
  latestCommit,
  isUndoing,
  onTitleChange,
  onBodyChange,
  onCommit,
  onUndo,
}: RepositoryCommitComposerProps) {
  const commitDisabled = isBusy || !title.trim() || stagedCount === 0;

  return (
    <div className="repository-view-commit-composer">
      <div className="repository-view-commit-composer-header">
        <div>
          <p className="repository-view-eyebrow">Commit</p>
        </div>
        <div className="repository-view-commit-meta">
          <span>{stagedCount} staged</span>
          <span>{unstagedCount} pending</span>
        </div>
      </div>

      <label className="repository-view-form-field">
        <span>Title</span>
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Describe the changes" />
      </label>

      <label className="repository-view-form-field">
        <span>Message</span>
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder="Optional details" rows={4} />
      </label>

      <div className="repository-view-commit-actions">
        <Button type="button" variant="submit" onClick={onCommit} disabled={commitDisabled || isBusy}>
          {isBusy ? 'Working…' : 'Create commit'}
        </Button>
      </div>

      {latestCommit && (
        <div className="repository-view-latest-commit">
          <div className="repository-view-latest-commit-details">
            <span
              className="repository-view-latest-commit-time"
              title={formatExactDate(latestCommit.committedAt)}
            >
              {formatRelativeTime(latestCommit.committedAt)}
            </span>
            <span
              className="repository-view-latest-commit-subject"
              title={latestCommit.message || undefined}
            >
              {latestCommit.subject || 'No commit message'}
            </span>
          </div>
          <Button
            type="button"
            variant="basic"
            className="repository-view-latest-commit-undo"
            onClick={onUndo}
            disabled={!latestCommit.canUndo || isBusy || isUndoing}
            title={latestCommit.canUndo ? 'Undo latest local commit' : latestCommit.undoReason ?? 'Undo unavailable'}
            aria-label={latestCommit.canUndo ? 'Undo latest local commit' : latestCommit.undoReason ?? 'Undo unavailable'}
          >
            <ArrowCounterClockwiseIcon size={15} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
