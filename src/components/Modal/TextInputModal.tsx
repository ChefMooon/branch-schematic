import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../button/Button';
import { XIcon } from '@phosphor-icons/react';

type TextInputModalProps = {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  inputLabel?: string;
  inputValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
};

export function TextInputModal({
  isOpen,
  title,
  description,
  inputLabel,
  inputValue = '',
  placeholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isBusy = false,
  onConfirm,
  onCancel,
}: TextInputModalProps) {
  const [draft, setDraft] = useState(inputValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setDraft(inputValue);
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, inputValue, onCancel]);

  if (!isOpen) return null;

  const trimmedDraft = draft.trim();

  return (
    <div className="app-modal-overlay" onClick={onCancel}>
      <div
        className="app-modal theme-aware-modal repo-group-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-input-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <h3 id="text-input-modal-title">{title}</h3>
          <Button type="button" variant="close" onClick={onCancel} aria-label="Close modal">
            <XIcon size={16} weight="bold" />
          </Button>
        </div>

        <div className="app-modal-body">
          {description ? <p className="repo-group-create-modal-description">{description}</p> : null}

          <label className="repo-group-create-modal-field" htmlFor="text-input-modal-field">
            {inputLabel ? <span>{inputLabel}</span> : null}
            <input
              id="text-input-modal-field"
              ref={inputRef}
              type="text"
              value={draft}
              placeholder={placeholder}
              disabled={isBusy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && trimmedDraft) {
                  void onConfirm(trimmedDraft);
                }
              }}
            />
          </label>
        </div>

        <div className="app-modal-footer">
          <Button type="button" variant="basic" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="submit"
            onClick={() => {
              if (!trimmedDraft) return;
              void onConfirm(trimmedDraft);
            }}
            disabled={isBusy || !trimmedDraft}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
