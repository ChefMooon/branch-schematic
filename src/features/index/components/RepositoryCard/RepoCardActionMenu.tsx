import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  DotsThreeVertical,
  PencilSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { ConfirmationModal } from "../../../../components/Modal/ConfirmationModal";
import { RepoThemeModal } from "./RepoThemeModal.tsx";
import { getViewportSafeMenuPosition } from "./menuPosition";

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
  currentThemeColor: string | null;
  currentIconName: string | null;
  onThemeChange: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
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
  currentThemeColor,
  currentIconName,
  onThemeChange,
}: RepoCardOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [showUntrackConfirmation, setShowUntrackConfirmation] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const viewportPadding = 8;
      const measuredHeight = menuRef.current?.offsetHeight ?? Math.min(360, window.innerHeight - (viewportPadding * 2));
      const menuHeight = Math.min(measuredHeight, window.innerHeight - (viewportPadding * 2));
      const nextPosition = getViewportSafeMenuPosition({
        triggerRect: {
          top: triggerRect.top,
          bottom: triggerRect.bottom,
          left: triggerRect.left,
          right: triggerRect.right,
        },
        menuHeight,
        menuWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        viewportPadding,
      });

      setMenuPosition(nextPosition);
    };

    const frame = window.requestAnimationFrame(updateMenuPosition);

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

    const handleScroll = () => {
      updateMenuPosition();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleAction = (action: () => void | Promise<void>) => {
    setIsOpen(false);
    void action();
  };

  const handleUntrackClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowUntrackConfirmation(true);
  };

  const handleThemeModalOpen = () => {
    setIsOpen(false);
    setIsThemeModalOpen(true);
  };

  const confirmUntrack = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    setShowUntrackConfirmation(false);
    setIsOpen(false);

    const syntheticEvent = {
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as React.MouseEvent<HTMLButtonElement>;

    void onUntrack(event ?? syntheticEvent);
  };

  return (
    <div className="repo-card-overflow-menu">
      <button
        type="button"
        ref={triggerRef}
        className="repo-card-action-button is-muted is-rectangular"
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
          style={{ top: menuPosition.top, left: menuPosition.left, maxHeight: menuPosition.maxHeight }}
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

          <div className="overflow-section">
            <button
              type="button"
              className="overflow-menu-item"
              onClick={handleThemeModalOpen}
            >
              <PencilSimple size={16} />
              <span>Edit theme</span>
            </button>
          </div>

          <div className="overflow-divider" />

          <div className="overflow-section overflow-section-danger">
            <button
              type="button"
              className="overflow-menu-item overflow-menu-item-danger"
              onClick={handleUntrackClick}
              disabled={isBusy}
            >
              <Trash size={16} />
              <span>Untrack repository</span>
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={showUntrackConfirmation}
        title="Untrack repository"
        message={
          <>
            This will remove the repository from your workspace. This action cannot be undone.
          </>
        }
        confirmLabel="Yes, untrack"
        cancelLabel="Cancel"
        variant="danger"
        isBusy={isBusy}
        onConfirm={() => confirmUntrack()}
        onCancel={() => setShowUntrackConfirmation(false)}
      />

      <RepoThemeModal
        isOpen={isThemeModalOpen}
        isBusy={isBusy}
        currentThemeColor={currentThemeColor}
        currentIconName={currentIconName}
        onClose={() => setIsThemeModalOpen(false)}
        onThemeChange={onThemeChange}
      />
    </div>
  );
}
