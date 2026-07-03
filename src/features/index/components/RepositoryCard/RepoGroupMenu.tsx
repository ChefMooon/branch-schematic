import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { TextInputModal } from '../../../../components/Modal/TextInputModal';
import type { GroupSummary, TrackedPath } from '../../../../types/git';

type RepoGroupMenuProps = {
  repo: TrackedPath;
  availableGroups: GroupSummary[];
  onGroupChange: (groupId: string | null) => void;
  onCreateGroup: (groupName: string) => void | Promise<void>;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
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

  const handleCreateGroupConfirm = async (groupName: string) => {
    setIsSubmittingGroup(true);
    try {
      await onCreateGroup(groupName);
      setIsCreateModalOpen(false);
      setIsDropdownOpen(false);
    } finally {
      setIsSubmittingGroup(false);
    }
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
          <span className="repo-group-badge-label">{groupLabel}</span>
          {repo.group_id ? (
            <span
              className="repo-group-clear"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                handleGroupSelect(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleGroupSelect(null);
                }
              }}
              title="Remove group"
              aria-label="Remove group"
            >
              <X size={10} weight="bold" />
            </span>
          ) : null}
        </button>
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
          <button type="button" className="repo-group-menu-item" onClick={() => { setIsDropdownOpen(false); setIsCreateModalOpen(true); }}>
            + Create Group
          </button>
          <button
            type="button"
            className="repo-group-menu-item"
            onClick={() => {
              setIsDropdownOpen(false);
              (onOpenManagement ?? onOpenManagementModal)?.();
              window.dispatchEvent(new CustomEvent('open-management-modal', { detail: { initialTab: 'groups' } }));
            }}
          >
            Manage Tags and Groups
          </button>
        </div>
      ) : null}
      <TextInputModal
        isOpen={isCreateModalOpen}
        title="Create Group"
        description="Give this group a name so it can be reused across repositories."
        inputLabel="Group name"
        placeholder="e.g. Backend"
        confirmLabel="Create"
        isBusy={isSubmittingGroup}
        onConfirm={handleCreateGroupConfirm}
        onCancel={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
