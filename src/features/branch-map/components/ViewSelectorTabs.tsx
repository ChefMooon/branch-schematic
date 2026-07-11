import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { sortCanvasViews, useCanvasStore } from '../../../stores/canvas-store';
import { CreateViewModal } from '../../canvas-views/components/CreateViewModal';
import { ViewManagerModal } from '../../canvas-views/components/ViewManagerModal';
import { ViewActionsDropdown } from './ViewActionsDropdown';

type ViewSelectorTabsProps = {
  isDark?: boolean;
  isModalOpen?: boolean;
  onModalOpenChange?: (isOpen: boolean) => void;
};

export function ViewSelectorTabs({
  isDark = false,
  isModalOpen: isModalOpenProp,
  onModalOpenChange,
}: ViewSelectorTabsProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNarrowLayout, setIsNarrowLayout] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1160,
  );
  const [isWideLayout, setIsWideLayout] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1400,
  );
  const [isMediumLayout, setIsMediumLayout] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1160 && window.innerWidth < 1400,
  );
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const isModalOpen = isModalOpenProp ?? internalModalOpen;
  const { zoom, x, y } = useViewport();

  const setModalOpen = (isOpen: boolean) => {
    onModalOpenChange?.(isOpen);
    if (isModalOpenProp === undefined) {
      setInternalModalOpen(isOpen);
    }
  };
  const views = useCanvasStore((state) => state.views);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const setActiveView = useCanvasStore((state) => state.setActiveView);
  const createNewView = useCanvasStore((state) => state.createNewView);

  const orderedViews = useMemo(() => {
    return sortCanvasViews(views);
  }, [views]);

  const activeView = orderedViews.find((view) => view.id === activeViewId) ?? null;

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsNarrowLayout(width < 1160);
      setIsMediumLayout(width >= 1160 && width < 1400);
      setIsWideLayout(width >= 1400);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOverflowOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!overflowRef.current) return;
      if (!overflowRef.current.contains(event.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOverflowOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOverflowOpen(false);
      setIsActionsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const { visibleViews, overflowViews } = useMemo(() => {
    const maxVisible = isNarrowLayout ? 1 : isMediumLayout ? 3 : isWideLayout ? 5 : 3;
    let visible = orderedViews.slice(0, maxVisible);

    if (activeView && !visible.some((view) => view.id === activeView.id)) {
      visible = [...visible.slice(0, Math.max(0, maxVisible - 1)), activeView];
    }

    const visibleIds = new Set(visible.map((view) => view.id));
    const overflow = orderedViews.filter((view) => !visibleIds.has(view.id));

    return {
      visibleViews: visible,
      overflowViews: overflow,
    };
  }, [activeView, isNarrowLayout, orderedViews]);

  const handleCreateView = async (options: {
    name: string;
    isFavorite: boolean;
    viewportDefaults: {
      zoomLevel: number;
      panX: number;
      panY: number;
    };
    scope?: {
      visiblePathIds?: string[];
      branchVisibility?: Record<string, string[]>;
    };
  }) => {
    await createNewView(options);
  };

  return (
    <>
      <div 
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 20,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          maxWidth: isWideLayout ? 'min(1120px, calc(100vw - 160px))' : 'min(860px, calc(100vw - 160px))',
          overflow: 'visible',
          background: isDark ? '#171717' : '#ffffff',
          padding: '6px',
          borderRadius: '8px',
          border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}
      >
        {visibleViews.map((v) => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setActiveView(v.id)}
              title={v.name}
              aria-label={`Open view ${v.name}`}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                maxWidth: isNarrowLayout ? '118px' : isWideLayout ? '140px' : '172px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                backgroundColor: activeViewId === v.id 
                  ? (isDark ? '#262626' : '#f1f5f9') 
                  : 'transparent',
                color: activeViewId === v.id
                  ? (isDark ? '#ffffff' : '#0f172a')
                  : (isDark ? '#a3a3a3' : '#64748b'),
                transition: 'all 0.15s ease'
              }}
            >
              {v.name}
            </button>
          </div>
        ))}

        {overflowViews.length > 0 && (
          <div ref={overflowRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsOverflowOpen((open) => {
                  const nextOpen = !open;
                  if (nextOpen) {
                    setIsActionsOpen(false);
                  }
                  return nextOpen;
                });
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${isDark ? '#404040' : '#cbd5e1'}`,
                backgroundColor: isDark ? '#111111' : '#ffffff',
                color: isDark ? '#d4d4d4' : '#475569',
              }}
            >
              More ({overflowViews.length})
            </button>

            {isOverflowOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  ...(isNarrowLayout ? { right: 0 } : { left: 0 }),
                  minWidth: '190px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: isDark ? '#111111' : '#ffffff',
                  border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  boxShadow: isDark
                    ? '0 12px 26px -8px rgba(0, 0, 0, 0.65)'
                    : '0 10px 24px -12px rgba(15, 23, 42, 0.35)',
                  padding: '8px',
                  zIndex: 24,
                }}
              >
                {overflowViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => {
                      void setActiveView(view.id);
                      setIsOverflowOpen(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderRadius: '7px',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      background: activeViewId === view.id
                        ? (isDark ? '#262626' : '#f1f5f9')
                        : 'transparent',
                      color: activeViewId === view.id
                        ? (isDark ? '#ffffff' : '#0f172a')
                        : (isDark ? '#d4d4d8' : '#334155'),
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '7px 8px',
                    }}
                    title={view.name}
                    aria-label={`Open view ${view.name}`}
                  >
                    {view.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <ViewActionsDropdown
          isDark={isDark}
          activeView={activeView}
          viewport={{ zoom, x, y }}
          onOpenManager={() => setModalOpen(true)}
          onOpenCreateView={() => setIsCreateModalOpen(true)}
          isOpen={isActionsOpen}
          onOpenChange={(isOpen) => {
            setIsActionsOpen(isOpen);
            if (isOpen) {
              setIsOverflowOpen(false);
            }
          }}
        />
      </div>

      <CreateViewModal
        isDark={isDark}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateView}
      />

      <ViewManagerModal isDark={isDark} isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}