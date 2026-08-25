import type { KeyboardEvent, MouseEvent } from 'react';
import './ResizeDivider.css';

interface ResizeDividerProps {
  label: string;
  ratio: number;
  minRatio: number;
  maxRatio: number;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onNudge?: (direction: -1 | 1) => void;
  className?: string;
}

function toPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

export function ResizeDivider({
  label,
  ratio,
  minRatio,
  maxRatio,
  onResizeStart,
  onNudge,
  className,
}: ResizeDividerProps) {
  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onResizeStart(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onNudge) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onNudge(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNudge(1);
    }
  };

  const clampedRatio = Math.min(Math.max(ratio, minRatio), maxRatio);

  return (
    <div
      className={className ? `resize-divider ${className}` : 'resize-divider'}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={toPercent(minRatio)}
      aria-valuemax={toPercent(maxRatio)}
      aria-valuenow={toPercent(clampedRatio)}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    />
  );
}
