import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { ColorPicker } from "../../../../components/color-picker/ColorPicker";
import { IconSelector } from "../../../icon/components/IconSelector";
import { Button } from "../../../../components/button/Button";
import { useBackdropDismiss } from "../../../../hooks/useBackdropDismiss";

type RepoThemeModalProps = {
  isOpen: boolean;
  isBusy: boolean;
  currentThemeColor: string | null;
  currentIconName: string | null;
  mode?: "immediate" | "submit";
  onClose: () => void;
  onThemeChange: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
  onSubmit?: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
};

export function RepoThemeModal({
  isOpen,
  isBusy,
  currentThemeColor,
  currentIconName,
  mode = "immediate",
  onClose,
  onThemeChange,
  onSubmit,
}: RepoThemeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draftColor, setDraftColor] = useState(currentThemeColor);
  const [draftIcon, setDraftIcon] = useState(currentIconName);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } = useBackdropDismiss(dialogRef, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    setDraftColor(currentThemeColor);
    setDraftIcon(currentIconName);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [currentIconName, currentThemeColor, isBusy, isOpen, onClose]);

  if (!isOpen) return null;

  const isSubmitMode = mode === "submit";
  const handleSubmit = async () => {
    await (onSubmit ?? onThemeChange)(draftColor, draftIcon);
    onClose();
  };

  const handleColorChange = (value: string | null) => {
    if (isSubmitMode) {
      setDraftColor(value);
      return;
    }

    void onThemeChange(value, currentIconName);
  };

  const handleIconChange = (value: string | null) => {
    if (isSubmitMode) {
      setDraftIcon(value);
      return;
    }

    void onThemeChange(currentThemeColor, value);
  };

  return (
    <div
      className="app-modal-overlay"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={dialogRef}
        className="app-modal theme-aware-modal repo-theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repo-theme-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <h3 id="repo-theme-modal-title">{isSubmitMode ? "Apply Repository Theme" : "Repository Theme"}</h3>
          <Button type="button" variant="close" className="app-modal-close" onClick={onClose} disabled={isBusy} aria-label="Close modal">
            <XIcon size={16} weight="bold" />
          </Button>
        </div>

        <div className="app-modal-body repo-theme-modal-body">
          <div className="repo-theme-modal-section">
            <span className="theme-management-label">Accent</span>
            <span className="repo-theme-modal-helper">
              {isSubmitMode ? "Choose the accent to apply to every selected workspace." : "Pick a color and the change saves immediately."}
            </span>
            <ColorPicker value={isSubmitMode ? draftColor : currentThemeColor} onChange={handleColorChange} />
          </div>

          <div className="repo-theme-modal-section">
            <span className="theme-management-label">Icon</span>
            <IconSelector value={isSubmitMode ? draftIcon : currentIconName} colorHex={isSubmitMode ? draftColor : currentThemeColor} onChange={handleIconChange} />
          </div>
        </div>

        <div className="app-modal-footer repo-theme-modal-footer">
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (isSubmitMode) {
                setDraftColor(null);
                setDraftIcon(null);
              } else {
                void onThemeChange(null, null);
              }
            }}
            disabled={isBusy}
          >
            Reset defaults
          </Button>
          <Button type="button" variant={isSubmitMode ? "submit" : "basic"} onClick={isSubmitMode ? () => { void handleSubmit(); } : onClose} disabled={isBusy}>
            {isSubmitMode ? "Apply to selected" : "Done"}
          </Button>
        </div>
      </div>
    </div>
  );
}