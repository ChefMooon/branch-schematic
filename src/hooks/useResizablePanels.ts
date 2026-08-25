import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResizablePanelConfig {
  id: string;
  defaultRatio: number;
  minRatio: number;
  maxRatio: number;
  minPx?: number;
  maxPx?: number;
}

export interface ResizablePanelBounds {
  min: number;
  max: number;
}

export interface ResizablePanelsOptions {
  initialRatios?: Record<string, number>;
  onRatiosCommit?: (ratios: Record<string, number>) => void;
}

type ResizeStartHandler = (event: {
  preventDefault: () => void;
  stopPropagation: () => void;
}) => void;

function lockGlobalDragStyles() {
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.documentElement.style.userSelect = 'none';
  document.documentElement.style.webkitUserSelect = 'none';
  document.body.style.cursor = 'col-resize';
}

function unlockGlobalDragStyles() {
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  document.documentElement.style.userSelect = '';
  document.documentElement.style.webkitUserSelect = '';
  document.body.style.cursor = '';
}

export function useResizablePanels(configs: ResizablePanelConfig[], options?: ResizablePanelsOptions) {
  const configsRef = useRef(configs);
  configsRef.current = configs;

  const onRatiosCommitRef = useRef(options?.onRatiosCommit);
  onRatiosCommitRef.current = options?.onRatiosCommit;

  const containerNodes = useRef(new Map<string, HTMLElement>());
  const [ratios, setRatios] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      configs.map((config) => [config.id, options?.initialRatios?.[config.id] ?? config.defaultRatio]),
    ),
  );
  const [resizingId, setResizingId] = useState<string | null>(null);

  const getEffectiveBounds = useCallback((id: string): ResizablePanelBounds => {
    const config = configsRef.current.find((entry) => entry.id === id);
    if (!config) return { min: 0, max: 1 };

    let min = config.minRatio;
    let max = config.maxRatio;
    const node = containerNodes.current.get(id);
    const width = node?.getBoundingClientRect().width ?? 0;
    if (width > 0 && Number.isFinite(width)) {
      if (config.minPx !== undefined) min = Math.max(min, config.minPx / width);
      if (config.maxPx !== undefined) max = Math.min(max, config.maxPx / width);
    }

    if (max < min) return { min, max: min };
    return { min, max };
  }, []);

  const applyClampedRatio = useCallback(
    (id: string, ratio: number) => {
      const bounds = getEffectiveBounds(id);
      const next = Math.min(Math.max(ratio, bounds.min), bounds.max);
      setRatios((current) => ({ ...current, [id]: next }));
    },
    [getEffectiveBounds],
  );

  const registerContainer = useCallback((id: string) => {
    return (node: HTMLElement | null) => {
      if (node) {
        containerNodes.current.set(id, node);
      } else {
        containerNodes.current.delete(id);
      }
    };
  }, []);

  const startResize = useCallback(
    (id: string): ResizeStartHandler =>
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        setResizingId(id);
      },
    [],
  );

  const resizeBy = useCallback(
    (id: string, delta: number) => {
      setRatios((current) => {
        const bounds = getEffectiveBounds(id);
        const base =
          current[id] ??
          configsRef.current.find((entry) => entry.id === id)?.defaultRatio ??
          bounds.min;
        const next = Math.min(Math.max(base + delta, bounds.min), bounds.max);
        return { ...current, [id]: next };
      });
    },
    [getEffectiveBounds],
  );

  useEffect(() => {
    if (!resizingId) return;

    const handleMove = (event: MouseEvent) => {
      const node = containerNodes.current.get(resizingId);
      if (!node) return;

      const rect = node.getBoundingClientRect();
      if (rect.width <= 0) return;

      applyClampedRatio(resizingId, (event.clientX - rect.left) / rect.width);
    };

    const handleUp = () => {
      setResizingId(null);
      unlockGlobalDragStyles();
    };

    lockGlobalDragStyles();
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      unlockGlobalDragStyles();
    };
  }, [resizingId, applyClampedRatio]);

  useEffect(() => {
    if (resizingId) return;
    onRatiosCommitRef.current?.(ratios);
  }, [ratios, resizingId]);

  useEffect(() => {
    return () => unlockGlobalDragStyles();
  }, []);

  return {
    registerContainer,
    ratios,
    isResizing: resizingId !== null,
    resizingId,
    startResize,
    resizeBy,
    getEffectiveBounds,
  };
}
