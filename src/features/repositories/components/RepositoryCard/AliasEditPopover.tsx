import { useEffect, useRef } from "react";
import { Check, Trash, X } from "@phosphor-icons/react";

type AliasEditPopoverProps = {
  isOpen: boolean;
  value: string;
  isBusy: boolean;
  hasAlias: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
};

export function AliasEditPopover({
  isOpen,
  value,
  isBusy,
  hasAlias,
  onChange,
  onSave,
  onCancel,
  onReset,
}: AliasEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="alias-edit-popover" ref={popoverRef} role="dialog" aria-label="Edit repository alias">
      <input
        type="text"
        className="alias-input-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Revert to folder name..."
        autoFocus
        disabled={isBusy}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="alias-edit-popover-actions">
        <button
          type="button"
          className="repo-card-action-button is-confirm"
          onClick={onSave}
          disabled={isBusy}
          title="Save alias"
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          className="repo-card-action-button is-cancel"
          onClick={onCancel}
          disabled={isBusy}
          title="Cancel"
        >
          <X size={16} />
        </button>
        {hasAlias ? (
          <button
            type="button"
            className="repo-card-action-button is-danger"
            onClick={onReset}
            disabled={isBusy}
            title="Clear alias"
          >
            <Trash size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
