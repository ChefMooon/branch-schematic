import type { ReactNode } from 'react';

interface RepositoryModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'wide';
}

export function RepositoryModalShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'default',
}: RepositoryModalShellProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.54)',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: size === 'wide' ? 'min(860px, 96vw)' : 'min(460px, 92vw)',
          maxHeight: 'min(90vh, 820px)',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRadius: 14,
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          border: '1px solid var(--app-border)',
          background: 'var(--app-surface)',
          boxShadow: '0 30px 70px -30px rgba(15, 23, 42, 0.65)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--app-border)',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--app-text)' }}>{title}</h3>
            {description ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--app-muted)' }}>{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--app-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              width: 28,
              height: 28,
              borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '12px 12px 0',
          }}
        >
          {children}
        </div>

        {footer ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              flexShrink: 0,
              padding: '10px 12px 12px',
              borderTop: '1px solid var(--app-border)',
              background: 'var(--app-surface)',
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
