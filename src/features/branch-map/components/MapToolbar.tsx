import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useViewport } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { PlusIcon, MinusIcon, ArrowCounterClockwiseIcon, ArrowsOutSimpleIcon, TagIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { TagFiltersPopover } from './TagFiltersPopover';

type MapToolbarProps = {
  hidden?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetViewport?: () => void;
  onFitView?: () => void;
};

export function MapToolbar({
  hidden = false,
  onZoomIn,
  onZoomOut,
  onResetViewport,
  onFitView,
}: MapToolbarProps) {
  const { zoom } = useViewport();
  const [isTagFiltersOpen, setIsTagFiltersOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('branch-schematic.tag-filters-open') === 'true';
  });
  const activeTagFilters = useCanvasStore((state) => state.activeTagFilters);
  const toggleTagFilter = useCanvasStore((state) => state.toggleTagFilter);
  const clearTagFilters = useCanvasStore((state) => state.clearTagFilters);
  const nodes = useCanvasStore((state) => state.nodes);
  const uniqueTags = useWorkspaceStore((state) => state.getUniqueTags());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('branch-schematic.tag-filters-open', isTagFiltersOpen ? 'true' : 'false');
  }, [isTagFiltersOpen]);

  const zoomPercentage = Math.round(zoom * 100);
  const tagUsageCounts = useMemo(() => {
    return nodes.reduce<Record<string, number>>((accumulator, node) => {
      const tags = Array.isArray(node.data?.tags) ? node.data.tags : [];
      tags.forEach((tag) => {
        accumulator[tag.id] = (accumulator[tag.id] ?? 0) + 1;
      });
      return accumulator;
    }, {});
  }, [nodes]);

  const buttonStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    padding: 0,
  };

  if (hidden) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        right: '24px',
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'var(--app-surface)',
        padding: '6px',
        borderRadius: '8px',
        border: '1px solid var(--app-border)',
        boxShadow: '0 10px 25px -5px var(--app-shadow)',
        maxWidth: '280px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--app-text)',
          padding: '4px 0',
          fontFamily: 'monospace',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        {zoomPercentage}%
      </div>

      <div
        style={{
          width: '24px',
          height: '1px',
          backgroundColor: 'var(--app-border)',
          margin: '2px 0',
        }}
      />

      <Button
        type="button"
        variant="basic"
        style={{ ...buttonStyle }}
        onClick={() => onZoomIn?.()}
        title="Zoom In"
      >
        <PlusIcon size={14} weight="bold" />
      </Button>

      <Button
        type="button"
        variant="basic"
        style={{ ...buttonStyle }}
        onClick={() => onZoomOut?.()}
        title="Zoom Out"
      >
        <MinusIcon size={14} weight="bold" />
      </Button>

      <Button
        type="button"
        variant="basic"
        style={{ ...buttonStyle }}
        onClick={() => onResetViewport?.()}
        title="Reset Zoom & Position"
      >
        <ArrowCounterClockwiseIcon size={14} weight="bold" />
      </Button>

      <div
        style={{
          width: '24px',
          height: '1px',
          backgroundColor: 'var(--app-border)',
          margin: '2px 0',
        }}
      />

      <Button
        type="button"
        variant="submit"
        style={{ ...buttonStyle }}
        onClick={() => onFitView?.()}
        title="Fit Screen View"
      >
        <ArrowsOutSimpleIcon size={14} weight="bold" />
      </Button>

      {uniqueTags.length > 0 && (
        <>
          <div
            style={{
              width: '24px',
              height: '1px',
              backgroundColor: 'var(--app-border)',
              margin: '2px 0',
            }}
          />

          <div style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="basic"
              className={isTagFiltersOpen ? 'is-active' : ''}
              style={{ ...buttonStyle, width: 'auto', minWidth: '32px', padding: '0 8px' }}
              onClick={() => setIsTagFiltersOpen((prev) => !prev)}
              title="Filter Tags"
              aria-label="Filter tags"
              aria-haspopup="dialog"
              aria-expanded={isTagFiltersOpen}
            >
              <TagIcon size={14} weight="bold" />
            </Button>

            <TagFiltersPopover
              isOpen={isTagFiltersOpen}
              onClose={() => setIsTagFiltersOpen(false)}
              tags={uniqueTags}
              activeTagFilters={activeTagFilters}
              onToggleTag={toggleTagFilter}
              onClearAll={() => clearTagFilters()}
              tagUsageCounts={tagUsageCounts}
            />
          </div>
        </>
      )}
    </div>
  );
}