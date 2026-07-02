import { useEffect, useRef, useState } from 'react';
import type { GroupSummary, TrackedPath } from '../../../../types/git';

type RepoGroupMenuProps = {
  repo: TrackedPath;
  availableGroups: GroupSummary[];
  onGroupChange: (groupId: string | null) => void;
  onCreateGroup: () => void;
  onOpenManagement?: () => void;
  onOpenManagementModal?: () => void;
};

export function RepoGroupMenu({
  repo,
  availableGroups,
  onGroupChange,
  onCreateGroup,
  onOpenManagement,
  onOpenManagementModal,
}: RepoGroupMenuProps) {
  const groupLabel = repo.custom_group ?? 'No Group';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const handleGroupSelect = (groupId: string | null) => {
    onGroupChange(groupId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="repo-group-menu" ref={dropdownRef}>
      <div className="repo-group-badge-row">
        <button
          type="button"
          className="repo-group-badge"
          style={{ borderColor: availableGroups.find((group) => group.id === repo.group_id)?.color_hex ?? '#cbd5e1' }}
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          aria-expanded={isDropdownOpen}
        >
          {groupLabel}
        </button>
        {repo.group_id ? (
          <button
            type="button"
            className="repo-group-clear"
            onClick={(event) => {
              event.stopPropagation();
              handleGroupSelect(null);
            }}
            title="Remove group"
          >
            ×
          </button>
        ) : null}
      </div>
      {isDropdownOpen ? (
        <div className="repo-group-menu-panel" role="menu">
          <div className="repo-group-menu-panel-marker" aria-hidden="true" />
          <button type="button" className="repo-group-menu-item" onClick={() => handleGroupSelect(null)}>
            No Group
          </button>
          {availableGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`repo-group-menu-item ${repo.group_id === group.id ? 'active' : ''}`}
              onClick={() => handleGroupSelect(group.id)}
            >
              <span className="repo-tag-dot" style={{ backgroundColor: group.color_hex }} />
              {group.group_name}
            </button>
          ))}
          <button type="button" className="repo-group-menu-item" onClick={() => { setIsDropdownOpen(false); onCreateGroup(); }}>
            + Create Group
          </button>
          <button
            type="button"
            className="repo-group-menu-item"
            onClick={() => {
              setIsDropdownOpen(false);
              (onOpenManagement ?? onOpenManagementModal)?.();
              window.dispatchEvent(new Event('open-management-modal'));
            }}
          >
            Manage Tags and Groups
          </button>
        </div>
      ) : null}
    </div>
  );
}
