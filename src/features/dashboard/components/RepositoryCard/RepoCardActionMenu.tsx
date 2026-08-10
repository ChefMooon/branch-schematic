import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  DotsThreeVertical,
  MagnifyingGlass,
  PencilSimple,
  Star,
  Trash,
  Info,
  PushPin,
  Desktop,
  Terminal,
} from "@phosphor-icons/react";
import { ConfirmationModal } from "../../../../components/Modal/ConfirmationModal.tsx";
import { RepoThemeModal } from "./RepoThemeModal.tsx";
import { getViewportSafeMenuPosition } from "./menuPosition.ts";
import { OpenWithModal } from "../../../repository-open/components/OpenWithModal";
import { useRepositoryOpenActions } from "../../../repository-open/hooks/useRepositoryOpenActions";
import { useNotifications } from "../../../../components/notifications/NotificationProvider";

type RepoCardOverflowMenuProps = {
  isFavorite: boolean;
  isPinned: boolean;
  isBusy: boolean;
  canUseRemoteActions: boolean;
  onOpenDetails: () => void;
  onRefreshStatus: () => void | Promise<void>;
  onFetch: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onRenameAlias: () => void;
  onToggleFavorite: () => void | Promise<void>;
  onTogglePinned: () => void | Promise<void>;
  onValidate?: () => void | Promise<void>;
  onUntrack: (event: React.MouseEvent<HTMLButtonElement>) => void;
  currentThemeColor: string | null;
  currentIconName: string | null;
  onThemeChange: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
  repositoryPath: string;
  isRepositoryMissing: boolean;
};

export function RepoCardOverflowMenu({
  isFavorite,
  isPinned,
  isBusy,
  canUseRemoteActions,
  onOpenDetails,
  onRefreshStatus,
  onFetch,
  onPull,
  onPush,
  onRenameAlias,
  onToggleFavorite,
  onTogglePinned,
  onValidate,
  onUntrack,
  currentThemeColor,
  currentIconName,
  onThemeChange,
  repositoryPath,
  isRepositoryMissing,
}: RepoCardOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [showUntrackConfirmation, setShowUntrackConfirmation] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useNotifications();
  const repositoryOpenActions = useRepositoryOpenActions(repositoryPath);

  const handleNativeAction = (action: () => Promise<void>) => {
    setIsOpen(false);
    void action().catch((error: unknown) => {
      addToast({
        variant: "error",
        title: "Repository action failed",
        message: error instanceof Error ? error.message : "The repository could not be opened.",
      });
    });
  };

  const handleDefaultEditorAction = () => {
    if (repositoryOpenActions.defaultEditor) {
      handleNativeAction(repositoryOpenActions.openDefaultApplication);
      return;
    }
    setIsOpen(false);
    repositoryOpenActions.openWith();
  };

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

  const handleOpenDetails = () => {
    setIsOpen(false);
    onOpenDetails();
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
              onClick={() => handleNativeAction(repositoryOpenActions.openTerminal)}
              disabled={isBusy || isRepositoryMissing}
              title={isRepositoryMissing ? "Repository path is unavailable" : undefined}
            >
              <Terminal size={16} />
              <span>Open in terminal</span>
            </button>
            {repositoryOpenActions.defaultEditor ? (
              <button
                type="button"
                className="overflow-menu-item"
                onClick={handleDefaultEditorAction}
                disabled={isBusy || isRepositoryMissing}
                title={isRepositoryMissing ? "Repository path is unavailable" : undefined}
              >
                <Desktop size={16} />
                <span>Open in {repositoryOpenActions.defaultEditor.editor.label}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => {
                setIsOpen(false);
                repositoryOpenActions.openWith();
              }}
              disabled={isBusy || isRepositoryMissing}
              title={isRepositoryMissing ? "Repository path is unavailable" : undefined}
            >
              <PencilSimple size={16} />
              <span>Open with...</span>
            </button>
            <button
              type="button"
              className="overflow-menu-item"
              onClick={handleOpenDetails}
            >
              <Info size={16} />
              <span>View details</span>
            </button>
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
            {onValidate ? (
              <button
                type="button"
                className="overflow-menu-item"
                onClick={() => handleAction(onValidate)}
                disabled={isBusy}
              >
                <MagnifyingGlass size={16} />
                <span>Validate repository</span>
              </button>
            ) : null}
            <button
              type="button"
              className="overflow-menu-item"
              onClick={() => handleAction(onTogglePinned)}
              disabled={isBusy}
            >
              <PushPin size={16} weight={isPinned ? "fill" : "regular"} />
              <span>{isPinned ? "Unpin repository" : "Pin repository"}</span>
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
              <span>Archive repository</span>
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={showUntrackConfirmation}
        title="Archive repository"
        message={
          <>
            This will archive the repository from your workspace. You can restore it later.
          </>
        }
        confirmLabel="Archive"
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

      <OpenWithModal
        isOpen={repositoryOpenActions.isOpenWithOpen}
        repositoryPath={repositoryPath}
        onClose={repositoryOpenActions.closeOpenWith}
        onError={(message) => addToast({ variant: "error", title: "Repository action failed", message })}
        detectEditors={repositoryOpenActions.detectEditors}
      />
    </div>
  );
}
