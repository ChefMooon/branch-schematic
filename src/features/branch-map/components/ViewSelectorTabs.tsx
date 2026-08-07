import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { Button } from '../../../components/button/Button';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { sortCanvasViews, useCanvasStore } from '../../../stores/canvas-store';
import { CreateViewModal } from '../../canvas-views/components/CreateViewModal';
import { ViewManagerModal } from '../../canvas-views/components/ViewManagerModal';
import { ViewActionsDropdown } from './ViewActionsDropdown';
import './ViewSelectorTabs.css';

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

  useClickOutside(overflowRef, () => setIsOverflowOpen(false), isOverflowOpen);

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
        className="view-selector-tabs"
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
          background: 'var(--app-surface)',
          padding: '6px',
          borderRadius: '8px',
          border: '1px solid var(--app-border)',
          boxShadow: '0 4px 6px -1px var(--app-shadow)',
        }}
      >
        <div role="tablist" aria-label="Canvas views" className="view-selector-tabs__list">
          {visibleViews.map((view) => (
            <div key={view.id} className="view-selector-tabs__tab-wrapper">
              <Button
                type="button"
                variant="basic"
                className={`app-btn--view-tab${activeViewId === view.id ? ' is-active' : ''}`}
                role="tab"
                aria-selected={activeViewId === view.id}
                onClick={() => setActiveView(view.id)}
                title={view.name}
                aria-label={`Open view ${view.name}`}
                style={{ maxWidth: isNarrowLayout ? '118px' : isWideLayout ? '140px' : '172px' }}
              >
                {view.name}
              </Button>
            </div>
          ))}
        </div>

        {overflowViews.length > 0 && (
          <div ref={overflowRef} style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="basic"
              className="app-btn--view-trigger"
              onClick={() => {
                setIsOverflowOpen((open) => {
                  const nextOpen = !open;
                  if (nextOpen) {
                    setIsActionsOpen(false);
                  }
                  return nextOpen;
                });
              }}
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
              aria-controls="view-selector-overflow-menu"
            >
              More ({overflowViews.length})
            </Button>

            {isOverflowOpen && (
              <div
                id="view-selector-overflow-menu"
                role="menu"
                aria-label="More canvas views"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  ...(isNarrowLayout ? { right: 0 } : { left: 0 }),
                  minWidth: '190px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'var(--app-surface)',
                  border: '1px solid var(--app-border)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 26px -8px var(--app-shadow)',
                  padding: '8px',
                  zIndex: 24,
                }}
              >
                {overflowViews.map((view) => (
                  <Button
                    key={view.id}
                    type="button"
                    variant="menu-item"
                    className={`app-btn--view-menu-item${activeViewId === view.id ? ' is-active' : ''}`}
                    onClick={() => {
                      void setActiveView(view.id);
                      setIsOverflowOpen(false);
                    }}
                    role="menuitem"
                    title={view.name}
                    aria-label={`Open view ${view.name}`}
                  >
                    {view.name}
                  </Button>
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