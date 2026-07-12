import { useEffect } from 'react';
import { Button } from '../button/Button';

export type ConfirmationModalVariant = 'danger' | 'primary';

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationModalVariant;
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay" onClick={onCancel}>
      <div
        className="confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirmation-modal__header">
          <h3 id="confirmation-modal-title">{title}</h3>
        </div>

        <div className="confirmation-modal__body">{message}</div>

        <div className="confirmation-modal__actions">
          <Button
            type="button"
            variant="basic"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'submit'}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
