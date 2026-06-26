import type { CSSProperties } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

type MapToolbarProps = {
  isDark?: boolean;
  hidden?: boolean;
};

export function MapToolbar({ isDark = false, hidden = false }: MapToolbarProps) {
  const { zoomIn, zoomOut, setViewport, fitView } = useReactFlow();
  const { zoom } = useViewport();

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
        top: '24px',
        right: '24px',
        zIndex: 9999,
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
        style={{ ...buttonStyle, backgroundColor: '#4f46e5', color: '#ffffff', fontSize: '14px' }}
        onClick={() => fitView({ duration: 400 })}
        title="Fit Screen View"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4338ca')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
      >
        ⤢
      </button>
    </div>
  );
}