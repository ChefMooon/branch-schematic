import { useEffect, useRef, useState } from 'react';

const MIN_SPLIT_RATIO = 0.28;
const MAX_SPLIT_RATIO = 0.72;

export function useResizableChangesPanels() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(MIN_SPLIT_RATIO);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const nextRatio = Math.min(Math.max((event.clientX - rect.left) / rect.width, MIN_SPLIT_RATIO), MAX_SPLIT_RATIO);
      setSplitRatio(nextRatio);
    };

    const handleUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.documentElement.style.userSelect = 'none';
    document.documentElement.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsResizing(true);
  };

  return { containerRef, splitRatio, handleResizeStart };
}
