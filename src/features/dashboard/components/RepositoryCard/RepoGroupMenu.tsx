import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { TextInputModal } from '../../../../components/Modal/TextInputModal';
import type { GroupSummary, TrackedPath } from '../../../../types/git';
import { Button } from '../../../../components/button/Button';

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
  const [activePopover, setActivePopover] = useState<{
    kind: 'badge' | 'menu';
    id?: string;
    content: string;
    x: number;
    y: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shouldShowBadgePopover = groupLabel.length > 24;

  useEffect(() => {
    const handlePointerDown = (event: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        hidePopover();
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

  const showPopover = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, kind: 'badge' | 'menu', content: string, id?: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActivePopover({
      kind,
      id,
      content,
      x: rect.left,
      y: rect.bottom + 8,
    });
  };

  const hidePopover = () => {
    setActivePopover(null);
  };

  return (
    <div className="repo-group-menu" ref={dropdownRef}>
      <div className="repo-group-badge-row">
        <button
          type="button"
          className="repo-group-badge"
          style={{ borderColor: availableGroups.find((group) => group.id === repo.group_id)?.color_hex ?? '#cbd5e1' }}
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          onMouseEnter={(event) => {
            if (shouldShowBadgePopover) {
              showPopover(event, 'badge', groupLabel);
            }
          }}
          onMouseLeave={hidePopover}
          onFocus={(event) => {
            if (shouldShowBadgePopover) {
              showPopover(event, 'badge', groupLabel);
            }
          }}
          onBlur={hidePopover}
          aria-expanded={isDropdownOpen}
        >
          <span className="repo-group-badge-label">
            <span className="repo-group-badge-label-text">{groupLabel}</span>
          </span>
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
      {activePopover ? (
        <span
          className={`repo-group-label-popover ${activePopover.kind === 'menu' ? 'repo-group-label-popover--menu' : ''}`}
          role="tooltip"
          data-testid={activePopover.kind === 'badge' ? 'group-label-popover' : 'group-menu-label-popover'}
          style={{ left: `${activePopover.x}px`, top: `${activePopover.y}px` }}
        >
          {activePopover.content}
        </span>
      ) : null}
      {isDropdownOpen ? (
        <div className="repo-group-menu-panel" role="menu">
          <div className="repo-group-menu-panel-marker" aria-hidden="true" />
          <Button type="button" variant="menu-item" onClick={() => handleGroupSelect(null)}>
            No Group
          </Button>
          {availableGroups.map((group) => (
            <Button
              key={group.id}
              type="button"
              variant="menu-item"
              className={`${repo.group_id === group.id ? 'is-active' : ''}`}
              onClick={() => handleGroupSelect(group.id)}
              onMouseEnter={(event) => {
                if (group.group_name.length > 24) {
                  showPopover(event, 'menu', group.group_name, group.id);
                }
              }}
              onMouseLeave={hidePopover}
              onFocus={(event) => {
                if (group.group_name.length > 24) {
                  showPopover(event, 'menu', group.group_name, group.id);
                }
              }}
              onBlur={hidePopover}
            >
              <span className="repo-group-menu-item-content">
                <span className="repo-tag-dot" style={{ backgroundColor: group.color_hex }} />
                <span className="repo-group-menu-item-label">
                  <span className="repo-group-menu-item-label-text">{group.group_name}</span>
                </span>
              </span>
            </Button>
          ))}
          <Button type="button" variant="menu-item" onClick={() => { setIsDropdownOpen(false); setIsCreateModalOpen(true); }}>
            + Create Group
          </Button>
          <Button
            type="button"
            variant="menu-item"
            onClick={() => {
              setIsDropdownOpen(false);
              (onOpenManagement ?? onOpenManagementModal)?.();
              window.dispatchEvent(new CustomEvent('open-management-modal', { detail: { initialTab: 'groups' } }));
            }}
          >
            Manage Tags and Groups
          </Button>
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
