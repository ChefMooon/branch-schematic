import { useEffect, useRef, useState } from 'react';
import {
  CaretDown,
  CaretUp,
  CircleNotch,
  GitBranch,
  House,
} from '@phosphor-icons/react';

type RepoBranchDropdownProps = {
  branches: string[];
  currentBranch: string;
  defaultBranch?: string | null;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect: (branch: string) => void | Promise<void>;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function RepoBranchDropdown({
  branches,
  currentBranch,
  defaultBranch,
  isLoading = false,
  disabled = false,
  onSelect,
}: RepoBranchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const normalizedBranches = branches.length > 0 ? branches : [currentBranch];
  const selectedBranch = currentBranch || normalizedBranches[0] || 'main';

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const estimatedPanelHeight = Math.min(240, Math.max(44, normalizedBranches.length * 34 + 12));
      const measuredPanelHeight = panelRef.current
        ? Math.max(44, Math.min(240, panelRef.current.scrollHeight + 2))
        : estimatedPanelHeight;
      const maxWidth = Math.max(220, Math.min(viewportWidth - 16, rect.width));
      const spaceAbove = rect.top - 8;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const shouldOpenAbove = spaceBelow < measuredPanelHeight && spaceAbove >= spaceBelow;
      const availableHeight = Math.max(44, shouldOpenAbove ? spaceAbove : spaceBelow);
      const panelMaxHeight = Math.min(240, availableHeight);
      const renderedPanelHeight = Math.min(measuredPanelHeight, panelMaxHeight);
      const nextPosition = {
        top: shouldOpenAbove
          ? Math.max(8, rect.top - renderedPanelHeight - 6)
          : Math.min(rect.bottom + 6, viewportHeight - renderedPanelHeight - 8),
        left: Math.min(Math.max(rect.left, 8), viewportWidth - maxWidth - 8),
        width: Math.min(maxWidth, viewportWidth - 16),
        maxHeight: panelMaxHeight,
      };

      setMenuPosition((current) => {
        if (
          current &&
          current.top === nextPosition.top &&
          current.left === nextPosition.left &&
          current.width === nextPosition.width &&
          current.maxHeight === nextPosition.maxHeight
        ) {
          return current;
        }
        return nextPosition;
      });
    };

    const scheduleUpdatePosition = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updatePosition();
      });
    };

    scheduleUpdatePosition();

    const handleResize = () => scheduleUpdatePosition();
    const handleScroll = () => scheduleUpdatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (branch: string) => {
    if (branch === selectedBranch) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    await onSelect(branch);
  };

  return (
    <div className="branch-dropdown-root" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="branch-dropdown-trigger"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select branch"
      >
        {isLoading ? (
          <CircleNotch size={16} className="animate-spin-svg" />
        ) : (
          <GitBranch size={16} weight="bold" />
        )}
        <span className="branch-dropdown-label" title={selectedBranch}>
          {selectedBranch}
        </span>
        {defaultBranch ? (
          <span className={`default-branch-badge ${selectedBranch === defaultBranch ? 'is-active' : ''}`}>
            <House size={12} weight="bold" />
            <span>{defaultBranch}</span>
          </span>
        ) : null}
        {isOpen ? <CaretUp size={14} weight="bold" className="branch-dropdown-caret" /> : <CaretDown size={14} weight="bold" className="branch-dropdown-caret" />}
      </button>

      {isOpen && menuPosition ? (
        <div
          ref={panelRef}
          className="branch-dropdown-panel"
          role="listbox"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {normalizedBranches.map((branch) => {
            const isSelected = branch === selectedBranch;
            const isDefault = branch === defaultBranch;

            return (
              <button
                key={branch}
                type="button"
                className={`branch-dropdown-item ${isSelected ? 'active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleSelect(branch);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className="branch-dropdown-item-label" title={branch}>
                  {branch}
                </span>
                {isDefault ? (
                  <span className="default-branch-badge branch-dropdown-inline-badge">
                    <House size={12} weight="bold" />
                    <span>default</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
