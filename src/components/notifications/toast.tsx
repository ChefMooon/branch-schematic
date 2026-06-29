import type { CSSProperties } from 'react';
import type { NotificationToast, NotificationVariant } from './notification-provider';

interface ToastProps {
  toast: NotificationToast;
  isDark: boolean;
  onDismiss: (id: number) => void;
}

const variantStyles = (variant: NotificationVariant, isDark: boolean): CSSProperties => {
  if (variant === 'success') {
    return {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.28)',
      color: isDark ? '#d1fae5' : '#065f46',
    };
  }

  if (variant === 'error') {
    return {
      backgroundColor: isDark ? 'rgba(248, 113, 113, 0.18)' : 'rgba(248, 113, 113, 0.12)',
      borderColor: isDark ? 'rgba(248, 113, 113, 0.45)' : 'rgba(248, 113, 113, 0.28)',
      color: isDark ? '#fee2e2' : '#991b1b',
    };
  }

  if (variant === 'warning') {
    return {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.14)',
      borderColor: isDark ? 'rgba(245, 158, 11, 0.48)' : 'rgba(217, 119, 6, 0.3)',
      color: isDark ? '#fde68a' : '#92400e',
    };
  }

  return {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(59, 130, 246, 0.12)',
    borderColor: isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(59, 130, 246, 0.28)',
    color: isDark ? '#dbeafe' : '#1d4ed8',
  };
};

export function Toast({ toast, isDark, onDismiss }: ToastProps) {
  return (
    <div
      style={{
        pointerEvents: 'auto',
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid',
        boxShadow: isDark
          ? '0 16px 40px rgba(0, 0, 0, 0.35)'
          : '0 12px 30px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        animation: 'toast-in 220ms ease-out',
        ...variantStyles(toast.variant, isDark),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{toast.title}</div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 15,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.92 }}>{toast.message}</div>
    </div>
  );
}
