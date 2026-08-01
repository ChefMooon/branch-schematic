import { ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';

interface RepositoryCommitComposerProps {
  title: string;
  body: string;
  stagedCount: number;
  unstagedCount: number;
  isBusy: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onRefresh: () => void;
  onCommit: () => void;
}

export function RepositoryCommitComposer({
  title,
  body,
  stagedCount,
  unstagedCount,
  isBusy,
  onTitleChange,
  onBodyChange,
  onRefresh,
  onCommit,
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
        <Button type="button" variant="basic" onClick={onRefresh} disabled={isBusy}>
          <ArrowClockwise size={14} />
          Refresh
        </Button>
        <Button type="button" variant="basic" onClick={onCommit} disabled={commitDisabled || isBusy}>
          {isBusy ? 'Working…' : 'Create commit'}
        </Button>
      </div>
    </div>
  );
}
