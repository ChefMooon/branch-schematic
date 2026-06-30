import { useEffect } from 'react';
import { FolderOpen, GitBranch, Plus, TreeStructure } from '@phosphor-icons/react';
import type { RepositoryModalAction } from '../types';

interface RepositoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: RepositoryModalAction) => void;
}

export function RepositoryDropdown({ isOpen, onClose, onSelect }: RepositoryDropdownProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-repository-dropdown-root]')) return;
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-repository-dropdown-root
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 220,
        padding: 8,
        borderRadius: 12,
        border: '1px solid var(--app-border)',
        background: 'var(--app-surface)',
        boxShadow: '0 20px 50px -24px rgba(15, 23, 42, 0.65)',
        zIndex: 40,
      }}
    >
      <button
        type="button"
        onClick={() => {
          onSelect('create');
          onClose();
        }}
        style={menuItemStyle}
      >
        <Plus size={16} weight="bold" />
        <span>New Repository...</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onSelect('add-local');
          onClose();
        }}
        style={menuItemStyle}
      >
        <FolderOpen size={16} weight="bold" />
        <span>Add Local Repository...</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onSelect('create-view');
          onClose();
        }}
        style={menuItemStyle}
      >
        <TreeStructure size={16} weight="bold" />
        <span>Create New View</span>
      </button>

      <button
        type="button"
        disabled
        style={{ ...menuItemStyle, opacity: 0.6, cursor: 'not-allowed' }}
      >
        <GitBranch size={16} weight="bold" />
        <span>Clone Repository (Coming Soon)</span>
      </button>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--app-text)',
  padding: '8px 10px',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
};
