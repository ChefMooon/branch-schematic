import type { TrackedPath } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';
import { RepositoryDetailChangesTab } from './RepositoryDetailChangesTab';
import { RepositoryDetailCommitsTab } from './RepositoryDetailCommitsTab';

interface RepositoryDetailBodyProps {
  repo: TrackedPath;
  commits: CommitRecord[];
  selectedCommit: CommitRecord | null;
  isLoadingCommits: boolean;
  activeBranch?: string | null;
  previewBranch?: string | null;
  currentBranch?: string | null;
  onSelectCommit: (commitHash: string) => void;
  activeTab: 'commits' | 'changes';
  onTabChange: (tab: 'commits' | 'changes') => void;
}

export function RepositoryDetailBody({
  repo,
  commits,
  selectedCommit,
  isLoadingCommits,
  activeBranch,
  previewBranch,
  currentBranch,
  onSelectCommit,
  activeTab,
}: RepositoryDetailBodyProps) {
  const branchLabel = previewBranch ?? activeBranch ?? currentBranch ?? 'main';

  return (
    <div className="repository-view-body-content">
      {activeTab === 'commits' ? (
        <div className="repository-view-tab-panel" id="repository-view-panel-commits" role="tabpanel" aria-labelledby="repository-view-tab-commits" tabIndex={0}>
          <RepositoryDetailCommitsTab
            commits={commits}
            selectedCommit={selectedCommit}
            isLoadingCommits={isLoadingCommits}
            branchLabel={branchLabel}
            onSelectCommit={onSelectCommit}
          />
        </div>
      ) : (
        <div className="repository-view-tab-panel" id="repository-view-panel-changes" role="tabpanel" aria-labelledby="repository-view-tab-changes" tabIndex={0}>
          <RepositoryDetailChangesTab repo={repo} />
        </div>
      )}
    </div>
  );
}
