import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  DotsThreeVertical,
  PencilSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";

type RepoCardOverflowMenuProps = {
  isFavorite: boolean;
  isBusy: boolean;
  canUseRemoteActions: boolean;
  onRefreshStatus: () => void | Promise<void>;
  onFetch: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onRenameAlias: () => void;
  onToggleFavorite: () => void | Promise<void>;
  onUntrack: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function RepoCardOverflowMenu({
  isFavorite,
  isBusy,
  canUseRemoteActions,
  onRefreshStatus,
  onFetch,
  onPull,
  onPush,
  onRenameAlias,
  onToggleFavorite,
  onUntrack,
}: RepoCardOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = Math.min(360, window.innerHeight - 24);
      const left = Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 8);
      const top = Math.min(triggerRect.bottom + 6, window.innerHeight - menuHeight - 8);

      setMenuPosition({
        top: Math.max(8, top),
        left: Math.max(8, left),
      });
    };

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleResize = () => {
      updateMenuPosition();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  const handleAction = (action: () => void | Promise<void>) => {
    setIsOpen(false);
    void action();
  };

  return (
    <div className="repo-card-overflow-menu">
      <button
        type="button"
        ref={triggerRef}
        className="repo-card-action-button is-muted"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Repository actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <DotsThreeVertical size={16} />
      </button>

      {isOpen && menuPosition ? (
        <div
          className="repo-card-overflow-panel"
          ref={menuRef}
          role="menu"
          aria-label="Repository actions"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="overflow-section">
            <div className="overflow-section-title">Git Operations</div>
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => handleAction(onRefreshStatus)}
              disabled={isBusy}
            >
              <ArrowClockwise size={16} />
              <span>Refresh status</span>
            </button>
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => handleAction(onFetch)}
              disabled={isBusy}
            >
              <ArrowClockwise size={16} />
              <span>Fetch origin</span>
            </button>
            {canUseRemoteActions ? (
              <>
                <button
                  type="button"
                  className="overflow-menu-item"
                  onClick={() => handleAction(onPull)}
                  disabled={isBusy}
                >
                  <ArrowDown size={16} />
                  <span>Pull upstream</span>
                </button>
                <button
                  type="button"
                  className="overflow-menu-item"
                  onClick={() => handleAction(onPush)}
                  disabled={isBusy}
                >
                  <ArrowUp size={16} />
                  <span>Push changes</span>
                </button>
              </>
            ) : null}
          </div>

          <div className="overflow-divider" />

          <div className="overflow-section">
            <div className="overflow-section-title">Workspace Management</div>
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => handleAction(onRenameAlias)}
              disabled={isBusy}
            >
              <PencilSimple size={16} />
              <span>Rename alias</span>
            </button>
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => handleAction(onToggleFavorite)}
              disabled={isBusy}
            >
              <Star size={16} weight={isFavorite ? "fill" : "regular"} />
              <span>{isFavorite ? "Remove favorite" : "Toggle favorite"}</span>
            </button>
          </div>

          <div className="overflow-divider" />

          <div className="overflow-section overflow-section-danger">
            <button
              type="button"
              className="overflow-menu-item overflow-menu-item-danger"
              onClick={(event) => {
                setIsOpen(false);
                void onUntrack(event);
              }}
              disabled={isBusy}
            >
              <Trash size={16} />
              <span>Untrack repository</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
