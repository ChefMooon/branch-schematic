import { ArrowUp } from '@phosphor-icons/react';
import './PushStatusIndicator.css';

interface PushStatusIndicatorProps {
  className?: string;
}

export function PushStatusIndicator({ className = '' }: PushStatusIndicatorProps) {
  const classNames = ['push-status-indicator', className].filter(Boolean).join(' ');

  return (
    <span
      className={classNames}
      aria-label="Not pushed to upstream"
      title="Not pushed to upstream"
    >
      <ArrowUp size={12} weight="bold" aria-hidden="true" />
    </span>
  );
}