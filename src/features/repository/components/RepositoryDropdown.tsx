import { useEffect, useRef, useState } from 'react';
import { FolderOpen, GitBranch, Plus, TreeStructure } from '@phosphor-icons/react';
import type { RepositoryModalAction } from '../types';

interface RepositoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: RepositoryModalAction) => void;
  anchorElement?: HTMLElement | null;
}

export function RepositoryDropdown({
  isOpen,
  onClose,
  onSelect,
  anchorElement,
}: RepositoryDropdownProps) {
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !anchorElement) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = anchorElement.getBoundingClientRect();
      const menuWidth = 230;
      const menuHeight = Math.min(320, window.innerHeight - 24);
      const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
      const top = Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 8);

      setMenuPosition({
        top: Math.max(8, top),
        left: Math.max(8, left),
      });
    };

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [anchorElement, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-repository-dropdown-root]')) return;
      if (target?.closest('[data-repository-dropdown-trigger]')) return;
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen || !menuPosition) return null;

  return (
    <div
      ref={menuRef}
      data-repository-dropdown-root
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        display: 'flex',
        flexDirection: 'column',
        width: 230,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'min(320px, calc(100vh - 16px))',
        padding: 8,
        borderRadius: 12,
        border: '1px solid var(--app-border)',
        background: 'var(--app-surface)',
        boxShadow: '0 18px 40px -24px rgba(15, 23, 42, 0.65)',
        zIndex: 40,
        overflow: 'hidden',
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
  fontWeight: 600,
  transition: 'background-color 120ms ease',
};
