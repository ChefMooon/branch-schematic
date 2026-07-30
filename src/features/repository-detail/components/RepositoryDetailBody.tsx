import { ArrowDown, ArrowUp, Clock, GitBranch, Hash, UserCircle } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import type { TrackedPath } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';

interface RepositoryDetailBodyProps {
  repo: TrackedPath;
  commits: CommitRecord[];
  selectedCommit: CommitRecord | null;
  isLoadingCommits: boolean;
  activeBranch: string | null;
  previewBranch: string | null;
  onSelectCommit: (commitHash: string) => void;
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

export function RepositoryDetailBody({
  repo,
  commits,
  selectedCommit,
  isLoadingCommits,
  activeBranch,
  previewBranch,
  onSelectCommit,
}: RepositoryDetailBodyProps) {
  return (
    <>
      <section className="repository-view-summary">
        <div className="repository-view-summary-card">
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Path</span>
            <span className="repository-view-value">{repo.absolute_path}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Branch</span>
            <span className="repository-view-value">{repo.current_branch ?? 'main'}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Default branch</span>
            <span className="repository-view-value">{repo.default_branch_name ?? 'main'}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Remote</span>
            <span className="repository-view-value">{repo.remote_url ?? 'Not configured'}</span>
          </div>
        </div>

        <div className="repository-view-summary-card">
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Ahead</span>
            <span className="repository-view-value">{repo.ahead_count ?? 0}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Behind</span>
            <span className="repository-view-value">{repo.behind_count ?? 0}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Changes pending</span>
            <span className="repository-view-value">{repo.uncommitted_changes_count ?? 0}</span>
          </div>
          <div className="repository-view-summary-row">
            <span className="repository-view-label">Origin</span>
            <span className="repository-view-value">{repo.repo_origin_type ?? 'LOCAL_ONLY'}</span>
          </div>
        </div>
      </section>

      <section className="repository-view-history" aria-label="Repository commit history">
        <div className="repository-view-history-list">
          <div className="repository-view-history-list-header">
            <h3>Commit history</h3>
            <span>{commits.length} commits</span>
          </div>

          <div className="repository-view-history-scroll">
            {isLoadingCommits ? (
              <div className="repository-view-empty-state">Loading commits…</div>
            ) : commits.length === 0 ? (
              <div className="repository-view-empty-state">No branch commits available yet.</div>
            ) : (
              <ul className="repository-view-commit-list">
                {commits.map((commit) => {
                  const isSelected = selectedCommit?.commit_hash === commit.commit_hash;
                  return (
                    <li key={commit.commit_hash}>
                      <button
                        type="button"
                        className={`repository-view-commit-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectCommit(commit.commit_hash)}
                      >
                        <div className="repository-view-commit-main">
                          <div className="repository-view-commit-title">{commit.commit_message}</div>
                          <div className="repository-view-commit-meta">
                            <span>
                              <UserCircle size={12} weight="fill" />
                              {commit.author_name}
                            </span>
                            <span>
                              <Clock size={12} weight="fill" />
                              {formatCommitDate(commit.committed_at)}
                            </span>
                          </div>
                        </div>
                        <div className="repository-view-commit-hash">
                          <Hash size={12} weight="bold" />
                          <span>{commit.commit_hash.slice(0, 8)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="repository-view-detail-panel">
          {selectedCommit ? (
            <>
              <div className="repository-view-detail-header">
                <div>
                  <p className="repository-view-eyebrow">Selected commit</p>
                  <h3>{selectedCommit.commit_message}</h3>
                </div>
                <div className="repository-view-detail-pill">
                  <GitBranch size={14} weight="fill" />
                  {previewBranch ?? activeBranch ?? 'main'}
                </div>
              </div>

              <div className="repository-view-detail-grid">
                <div className="repository-view-detail-row">
                  <span className="repository-view-label">Author</span>
                  <span className="repository-view-value">{selectedCommit.author_name}</span>
                </div>
                <div className="repository-view-detail-row">
                  <span className="repository-view-label">Committed</span>
                  <span className="repository-view-value">{formatCommitDate(selectedCommit.committed_at)}</span>
                </div>
                <div className="repository-view-detail-row">
                  <span className="repository-view-label">Hash</span>
                  <span className="repository-view-value">{selectedCommit.commit_hash}</span>
                </div>
                <div className="repository-view-detail-row">
                  <span className="repository-view-label">Signature</span>
                  <span className="repository-view-value">{selectedCommit.signature_status ?? 'Not available'}</span>
                </div>
              </div>

              <div className="repository-view-detail-actions">
                <Button type="button" variant="basic">View commit</Button>
                <Button type="button" variant="basic" disabled>
                  <ArrowUp size={14} />
                  Compare
                </Button>
                <Button type="button" variant="basic" disabled>
                  <ArrowDown size={14} />
                  Diff
                </Button>
              </div>
            </>
          ) : (
            <div className="repository-view-empty-state">Select a commit to inspect details.</div>
          )}
        </div>
      </section>
    </>
  );
}
