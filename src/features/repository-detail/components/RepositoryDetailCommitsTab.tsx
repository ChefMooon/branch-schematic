import { useEffect, useState } from 'react';
import { Clock, Hash, UserCircle } from '@phosphor-icons/react';
import { PushStatusIndicator } from '../../../components/push-status-indicator/PushStatusIndicator';
import { ResizeDivider } from '../../../components/resize-divider/ResizeDivider';
import { useResizablePanels, type ResizablePanelConfig } from '../../../hooks/useResizablePanels';
import type { TrackedPath } from '../../../types/git';
import { useCommitChangedFiles } from '../hooks/useCommitChangedFiles';
import { useCommitFileDiff } from '../hooks/useCommitFileDiff';
import type { CommitRecord } from './RepositoryDetail';
import { RepositoryCommitDiffPanel } from './RepositoryCommitDiffPanel';
import { RepositoryCommitFilesPanel } from './RepositoryCommitFilesPanel';

interface RepositoryDetailCommitsTabProps {
  repo: TrackedPath | null;
  commits: CommitRecord[];
  selectedCommit: CommitRecord | null;
  isLoadingCommits: boolean;
  branchLabel: string;
  onSelectCommit: (commitHash: string) => void;
  persistedPanelRatios?: Record<string, number>;
  onPersistPanelRatios?: (ratios: Record<string, number>) => void;
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

const COMMIT_PANEL_CONFIGS: ResizablePanelConfig[] = [
  { id: 'history', defaultRatio: 0.22, minRatio: 0.18, maxRatio: 0.45, minPx: 280 },
  { id: 'files', defaultRatio: 0.2, minRatio: 0.2, maxRatio: 0.6, minPx: 200 },
];

const KEYBOARD_NUDGE_STEP = 0.01;

function formatFlexBasis(ratio: number) {
  return `${Math.round(ratio * 10000) / 100}%`;
}

export function RepositoryDetailCommitsTab({
  repo,
  commits,
  selectedCommit,
  isLoadingCommits,
  branchLabel,
  onSelectCommit,
  persistedPanelRatios,
  onPersistPanelRatios,
}: RepositoryDetailCommitsTabProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const selectedCommitHash = selectedCommit?.commit_hash ?? null;
  const {
    registerContainer,
    ratios,
    startResize,
    resizeBy,
    getEffectiveBounds,
  } = useResizablePanels(COMMIT_PANEL_CONFIGS, {
    initialRatios: persistedPanelRatios,
    onRatiosCommit: onPersistPanelRatios,
  });
  const historyBounds = getEffectiveBounds('history');
  const filesBounds = getEffectiveBounds('files');

  useEffect(() => {
    setSelectedFilePath(null);
  }, [selectedCommitHash]);

  const {
    files,
    isLoading: isLoadingFiles,
    error: filesError,
  } = useCommitChangedFiles(repo?.absolute_path, selectedCommitHash);

  useEffect(() => {
    if (!files || files.length === 0 || selectedFilePath) return;
    setSelectedFilePath(files[0].path);
  }, [files, selectedFilePath]);

  const { fileDiff, isDiffLoading, diffError } = useCommitFileDiff(
    repo?.absolute_path,
    selectedCommitHash,
    selectedFilePath,
  );

  return (
    <section className="repository-view-history-tab" aria-label="Repository commit history">
      <div className="repository-view-history-shell" ref={registerContainer('history')}>
        <div
          className="repository-view-changes-panel repository-view-history-panel"
          style={{ flexBasis: formatFlexBasis(ratios.history) }}
        >
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
                          <div className="repository-view-commit-hash-stack">
                            {commit.push_state === 'unpushed' && (
                              <PushStatusIndicator className="repository-view-commit-push-status" />
                            )}
                            <div className="repository-view-commit-hash">
                              <Hash size={12} weight="bold" />
                              <span>{commit.commit_hash.slice(0, 8)}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <ResizeDivider
          label="Resize commit history panels"
          ratio={ratios.history}
          minRatio={historyBounds.min}
          maxRatio={historyBounds.max}
          onResizeStart={startResize('history')}
          onNudge={(direction) => resizeBy('history', direction * KEYBOARD_NUDGE_STEP)}
          className="repository-view-history-divider"
        />

        <div className="repository-view-commit-region" ref={registerContainer('files')}>
          <RepositoryCommitFilesPanel
            commit={selectedCommit}
            branchLabel={branchLabel}
            files={files}
            isLoading={isLoadingFiles}
            error={filesError}
            selectedPath={selectedFilePath}
            onSelectPath={setSelectedFilePath}
            style={{ flexBasis: formatFlexBasis(ratios.files) }}
          />

          <ResizeDivider
            label="Resize commit file panels"
            ratio={ratios.files}
            minRatio={filesBounds.min}
            maxRatio={filesBounds.max}
            onResizeStart={startResize('files')}
            onNudge={(direction) => resizeBy('files', direction * KEYBOARD_NUDGE_STEP)}
            className="repository-view-commit-files-divider"
          />

          <RepositoryCommitDiffPanel
            filePath={selectedFilePath}
            fileDiff={fileDiff}
            isDiffLoading={isDiffLoading}
            diffError={diffError}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode((current) => (current === 'unified' ? 'split' : 'unified'))}
          />
        </div>
      </div>
    </section>
  );
}
