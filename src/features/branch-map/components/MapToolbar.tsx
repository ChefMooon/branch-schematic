import type { CSSProperties } from 'react';
import { useViewport } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { PlusIcon, MinusIcon, ArrowCounterClockwiseIcon, ArrowsOutSimpleIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';

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
  const activeTagFilters = useCanvasStore((state) => state.activeTagFilters);
  const toggleTagFilter = useCanvasStore((state) => state.toggleTagFilter);
  const clearTagFilters = useCanvasStore((state) => state.clearTagFilters);
  const uniqueTags = useWorkspaceStore((state) => state.getUniqueTags());

  if (hidden) return null;

  const zoomPercentage = Math.round(zoom * 100);

  const buttonStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    padding: 0,
  };

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
        <PlusIcon size={14} />
      </Button>

      <Button
        type="button"
        variant="basic"
        style={{ ...buttonStyle }}
        onClick={() => onZoomOut?.()}
        title="Zoom Out"
      >
        <MinusIcon size={14} />
      </Button>

      <Button
        type="button"
        variant="basic"
        style={{ ...buttonStyle }}
        onClick={() => onResetViewport?.()}
        title="Reset Zoom & Position"
      >
        <ArrowCounterClockwiseIcon size={14} />
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
        <ArrowsOutSimpleIcon size={14} />
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

          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--app-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: '4px',
            }}
          >
            Tag Filters
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              justifyContent: 'center',
              marginTop: '4px',
            }}
          >
            {uniqueTags.map((tag) => {
              const isActive = activeTagFilters.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  title={tag.tag_name}
                  style={{
                    border: `1px solid ${isActive ? tag.color_hex : 'var(--app-border)'}`,
                    backgroundColor: isActive ? `${tag.color_hex}22` : 'transparent',
                    color: 'var(--app-text)',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    maxWidth: '110px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.tag_name}
                </button>
              );
            })}
          </div>

          {activeTagFilters.length > 0 && (
            <button
              style={{
                marginTop: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--app-muted)',
                fontSize: '10px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => clearTagFilters()}
            >
              Clear tag filters
            </button>
          )}
        </>
      )}
    </div>
  );
}