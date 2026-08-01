import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp, GitBranch, Info, XIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useClickOutside } from '../../../hooks/useClickOutside';
import type { TrackedPath } from '../../../types/git';

interface RepositoryDetailHeaderProps {
  repo: TrackedPath;
  activeBranch: string;
  previewBranch: string;
  onSelectPreviewBranch: (branch: string) => void;
  onClose: () => void;
  activeTab: 'commits' | 'changes';
  onTabChange: (tab: 'commits' | 'changes') => void;
}

export function RepositoryDetailHeader({ repo, activeBranch, previewBranch, onSelectPreviewBranch, onClose, activeTab, onTabChange }: RepositoryDetailHeaderProps) {
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isSummaryPopoverOpen, setIsSummaryPopoverOpen] = useState(false);
  const branchContainerRef = useRef<HTMLDivElement>(null);
  const summaryPopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(branchContainerRef, () => setIsBranchMenuOpen(false), isBranchMenuOpen);
  useClickOutside(summaryPopoverRef, () => setIsSummaryPopoverOpen(false), isSummaryPopoverOpen);

  useEffect(() => {
    if (!isBranchMenuOpen && !isSummaryPopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBranchMenuOpen(false);
        setIsSummaryPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBranchMenuOpen, isSummaryPopoverOpen]);

  const branchOptions = (repo.available_branches ?? []).filter(Boolean);
  const branchLabel = previewBranch || activeBranch || 'main';
  const isPreviewingDifferentBranch = previewBranch !== activeBranch;

  return (
    <div className="repository-view-header">
      <div className="repository-view-header-top">
        <div className="repository-view-header-title-group">
          <p className="repository-view-eyebrow">Repository details</p>
          <h2 id="repository-view-title">{repo.display_name}</h2>
        </div>

        <div className="repository-view-header-actions">
          <div className="repository-view-summary-pill-row" ref={summaryPopoverRef}>
            <button
              type="button"
              className="repository-view-summary-pill"
              onClick={() => setIsSummaryPopoverOpen((value) => !value)}
              aria-label="Show repository details"
            >
              <span>{branchLabel}</span>
              <span className="repository-view-summary-pill-meta">{repo.repo_origin_type ?? 'LOCAL_ONLY'}</span>
              <span className="repository-view-summary-pill-meta">{repo.uncommitted_changes_count ?? 0} pending</span>
              <Info size={12} weight="bold" />
            </button>

            {isSummaryPopoverOpen ? (
              <div className="repository-view-summary-popover" role="dialog" aria-label="Repository details summary">
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Path</span>
                  <span className="repository-view-value">{repo.absolute_path}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Branch</span>
                  <span className="repository-view-value">{repo.current_branch ?? 'main'}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Default branch</span>
                  <span className="repository-view-value">{repo.default_branch_name ?? 'main'}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Remote</span>
                  <span className="repository-view-value">{repo.remote_url ?? 'Not configured'}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Ahead</span>
                  <span className="repository-view-value">{repo.ahead_count ?? 0}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Behind</span>
                  <span className="repository-view-value">{repo.behind_count ?? 0}</span>
                </div>
                <div className="repository-view-summary-popover-row">
                  <span className="repository-view-label">Origin</span>
                  <span className="repository-view-value">{repo.repo_origin_type ?? 'LOCAL_ONLY'}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="repository-view-branch-picker" ref={branchContainerRef}>
            <button
              type="button"
              className="repository-view-branch-trigger"
              onClick={() => setIsBranchMenuOpen((value) => !value)}
              aria-expanded={isBranchMenuOpen}
              aria-haspopup="listbox"
              aria-label="Select preview branch"
            >
              <GitBranch size={14} weight="bold" />
              <span>{branchLabel}</span>
              {isBranchMenuOpen ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
            </button>

            {isBranchMenuOpen ? (
              <div className="repository-view-branch-menu" role="listbox">
                {branchOptions.length > 0 ? (
                  branchOptions.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      className={`repository-view-branch-option ${branch === branchLabel ? 'is-active' : ''}`}
                      role="option"
                      aria-selected={branch === branchLabel}
                      onClick={() => {
                        onSelectPreviewBranch(branch);
                        setIsBranchMenuOpen(false);
                      }}
                    >
                      <span>{branch}</span>
                      {branch === activeBranch ? <span className="repository-view-branch-badge">current</span> : null}
                    </button>
                  ))
                ) : (
                  <div className="repository-view-branch-option is-empty">No branches available</div>
                )}
              </div>
            ) : null}
          </div>

          {isPreviewingDifferentBranch ? (
            <span className="repository-view-preview-pill">Preview</span>
          ) : null}

          <Button type="button" variant="close" onClick={onClose} aria-label="Close repository details">
            <XIcon size={14} weight="bold" />
          </Button>
        </div>
      </div>

      <div className="repository-view-tabs" role="tablist" aria-label="Repository detail tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'commits'}
          className={`repository-view-tab ${activeTab === 'commits' ? 'is-active' : ''}`}
          onClick={() => onTabChange('commits')}
        >
          Commits
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'changes'}
          className={`repository-view-tab ${activeTab === 'changes' ? 'is-active' : ''}`}
          onClick={() => onTabChange('changes')}
        >
          Changes
        </button>
      </div>
    </div>
  );
}
