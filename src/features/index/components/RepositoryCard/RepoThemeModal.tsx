import { X } from "@phosphor-icons/react";
import { ColorPicker } from "../../../../components/color-picker/ColorPicker";
import { IconSelector } from "../../../icon/components/IconSelector";

type RepoThemeModalProps = {
  isOpen: boolean;
  isBusy: boolean;
  currentThemeColor: string | null;
  currentIconName: string | null;
  onClose: () => void;
  onThemeChange: (colorHex: string | null, iconName: string | null) => void | Promise<void>;
};

export function RepoThemeModal({
  isOpen,
  isBusy,
  currentThemeColor,
  currentIconName,
  onClose,
  onThemeChange,
}: RepoThemeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal theme-aware-modal repo-theme-modal" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <h3>Repository Theme</h3>
          <button type="button" className="app-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="app-modal-body repo-theme-modal-body">
          <div className="repo-theme-modal-section">
            <span className="theme-management-label">Accent</span>
            <span className="repo-theme-modal-helper">Pick a color and the change saves immediately.</span>
            <ColorPicker value={currentThemeColor} onChange={(value) => { void onThemeChange(value, currentIconName); }} />
          </div>

          <div className="repo-theme-modal-section">
            <span className="theme-management-label">Icon</span>
            <IconSelector value={currentIconName} colorHex={currentThemeColor} onChange={(value) => { void onThemeChange(currentThemeColor, value); }} />
          </div>
        </div>

        <div className="app-modal-footer repo-theme-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void onThemeChange(null, null);
            }}
            disabled={isBusy}
          >
            Reset defaults
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}