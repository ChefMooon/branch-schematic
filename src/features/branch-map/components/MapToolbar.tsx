import type { CSSProperties } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';

type MapToolbarProps = {
  isDark?: boolean;
  hidden?: boolean;
};

export function MapToolbar({ isDark = false, hidden = false }: MapToolbarProps) {
  const { zoomIn, zoomOut, setViewport, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const activeTagFilters = useCanvasStore((state) => state.activeTagFilters);
  const toggleTagFilter = useCanvasStore((state) => state.toggleTagFilter);
  const clearTagFilters = useCanvasStore((state) => state.clearTagFilters);
  const uniqueTags = useWorkspaceStore((state) => state.getUniqueTags());

  if (hidden) return null;

  const zoomPercentage = Math.round(zoom * 100);

  const buttonStyle: CSSProperties = {
    color: isDark ? '#a3a3a3' : '#4b5563',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s',
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
        backgroundColor: isDark ? '#171717' : '#ffffff',
        padding: '6px',
        borderRadius: '8px',
        border: `1px solid ${isDark ? '#262626' : '#d1d5db'}`,
        boxShadow: isDark
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
          : '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
        maxWidth: '280px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isDark ? '#e5e5e5' : '#111827',
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
          backgroundColor: isDark ? '#262626' : '#e5e7eb',
          margin: '2px 0',
        }}
      />

      <button
        style={buttonStyle}
        onClick={() => zoomIn()}
        title="Zoom In"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        ＋
      </button>

      <button
        style={buttonStyle}
        onClick={() => zoomOut()}
        title="Zoom Out"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        －
      </button>

      <button
        style={buttonStyle}
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 })}
        title="Reset Zoom & Position"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        ⟲
      </button>

      <div
        style={{
          width: '24px',
          height: '1px',
          backgroundColor: isDark ? '#262626' : '#e5e7eb',
          margin: '2px 0',
        }}
      />

      <button
        style={{ ...buttonStyle, backgroundColor: 'var(--app-accent)', color: '#ffffff', fontSize: '14px' }}
        onClick={() => fitView({ duration: 400 })}
        title="Fit Screen View"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--app-accent-strong)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--app-accent)')}
      >
        ⤢
      </button>

      {uniqueTags.length > 0 && (
        <>
          <div
            style={{
              width: '24px',
              height: '1px',
              backgroundColor: isDark ? '#262626' : '#e5e7eb',
              margin: '2px 0',
            }}
          />

          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: isDark ? '#d4d4d8' : '#374151',
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
                    border: `1px solid ${isActive ? tag.color_hex : (isDark ? '#3f3f46' : '#d1d5db')}`,
                    backgroundColor: isActive ? `${tag.color_hex}22` : 'transparent',
                    color: isDark ? '#e5e7eb' : '#111827',
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
                color: isDark ? '#a1a1aa' : '#6b7280',
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