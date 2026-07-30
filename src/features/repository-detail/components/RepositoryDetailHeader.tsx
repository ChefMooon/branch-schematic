import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp, GitBranch, XIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useClickOutside } from '../../../hooks/useClickOutside';
import type { TrackedPath } from '../../../types/git';

interface RepositoryDetailHeaderProps {
  repo: TrackedPath;
  activeBranch: string;
  previewBranch: string;
  onSelectPreviewBranch: (branch: string) => void;
  onClose: () => void;
}

export function RepositoryDetailHeader({ repo, activeBranch, previewBranch, onSelectPreviewBranch, onClose }: RepositoryDetailHeaderProps) {
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const branchContainerRef = useRef<HTMLDivElement>(null);

  useClickOutside(branchContainerRef, () => setIsBranchMenuOpen(false), isBranchMenuOpen);

  useEffect(() => {
    if (!isBranchMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBranchMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBranchMenuOpen]);

  const branchOptions = (repo.available_branches ?? []).filter(Boolean);
  const branchLabel = previewBranch || activeBranch || 'main';
  const isPreviewingDifferentBranch = previewBranch !== activeBranch;

  return (
    <div className="repository-view-header">
      <div className="repository-view-header-title-group">
        <p className="repository-view-eyebrow">Repository details</p>
        <h2 id="repository-view-title">{repo.display_name}</h2>
      </div>

      <div className="repository-view-header-actions" ref={branchContainerRef}>
        <div className="repository-view-branch-picker">
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
  );
}
