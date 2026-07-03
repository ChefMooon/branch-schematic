import { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps, Node, useViewport } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CommitTimeline } from './CommitTimeline';
import type { RepoTag } from '../../../types/git';

export type BranchCardNode = Node<{
  title: string;
  repoPathId: string;
  repositoryName?: string;
  branchId?: string;
  branchName?: string;
  explodeBranches: boolean;
  status: 'Active' | 'Draft' | 'Archived';
  aheadCount: number;
  behindCount: number;
  viewMode: 'COMPACT' | 'EXPANDED';
  commitDensity: number;
  themeColorHex: string;
  groupThemeColorHex?: string | null;
  tags?: RepoTag[];
  isDimmedByTagFilter?: boolean;
}>;

function useResolveCardColor(themeColorHex?: string | null, groupThemeColorHex?: string | null, fallback = '#4F46E5') {
  return themeColorHex || groupThemeColorHex || fallback;
}

function useAppThemeMode() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const updateTheme = () => {
      setThemeMode(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return themeMode;
}

export function BranchCard({ data }: NodeProps<BranchCardNode>) {
  const themeMode = useAppThemeMode();
  const isDark = themeMode === 'dark';
  const { zoom } = useViewport();
  const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);

  const [menuOpen, setMenuOpen] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const cardContainer = cardContainerRef.current;
      if (!cardContainer) return;

      const path = event.composedPath();
      if (!path.includes(cardContainer)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  // Compute exact 3-Tier LoD classification flags matching requirements
  let lodTier: 'CLOSE' | 'MID' | 'BIRD' = 'CLOSE';
  if (zoom < 0.5) lodTier = 'BIRD';
  else if (zoom >= 0.5 && zoom < 1.0) lodTier = 'MID';

  const accentColor = useResolveCardColor(data.themeColorHex, data.groupThemeColorHex, '#4F46E5');
  const isCompact = data.viewMode === 'COMPACT';
  const isScrollableTimeline = data.commitDensity === -1;
  const repositoryLabel = data.repositoryName?.trim() || data.repoPathId;

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#121214' : '#ffffff',
    border: `1px solid ${isDark ? '#262626' : '#e5e7eb'}`,
    borderRadius: '10px',
    padding: isCompact ? '12px' : '16px',
    width: isCompact ? '280px' : '340px',
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
    fontFamily: 'system-ui, sans-serif',
    position: 'relative',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    opacity: data.isDimmedByTagFilter ? 0.35 : 1,
    filter: data.isDimmedByTagFilter ? 'grayscale(0.8)' : 'none',
    overflow: isCompact ? 'visible' : 'hidden',
    boxSizing: 'border-box',
  };

  const handleStyle: React.CSSProperties = {
    background: isDark ? '#3f3f46' : '#a1a1aa',
    width: '8px',
    height: '8px',
    border: `2px solid ${isDark ? '#121214' : '#ffffff'}`,
  };

  const badgeStyles = {
    Active: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.28)',
    },
    Draft: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)',
      color: '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.28)',
    },
    Archived: {
      backgroundColor: isDark ? 'rgba(113, 113, 122, 0.16)' : 'rgba(113, 113, 122, 0.12)',
      color: '#71717a',
      border: '1px solid rgba(113, 113, 122, 0.24)',
    },
  };

  return (
    <div
      style={cardStyle}
      ref={cardContainerRef}
      onPointerDownCapture={(event) => {
        if (!menuOpen) return;

        const menuContainer = menuContainerRef.current;
        if (menuContainer && !event.nativeEvent.composedPath().includes(menuContainer)) {
          setMenuOpen(false);
        }
      }}
    >
      {/* Explicit Target Anchor Handle on Left Side */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target-left" 
        style={handleStyle} 
      />

      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: !isCompact ? 8 : 0, gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <div style={{ width: '4px', height: '20px', backgroundColor: accentColor, borderRadius: '2px', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, lineHeight: 1.1, gap: '1px' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.title}
            </h3>
            <div style={{ fontSize: 11, color: isDark ? '#8b8b93' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: lodTier === 'BIRD' ? 0.35 : 1, marginTop: 0 }}>
              {repositoryLabel}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 72, justifyContent: 'flex-end', minHeight: 24, opacity: lodTier === 'BIRD' ? 0 : 1, visibility: lodTier === 'BIRD' ? 'hidden' : 'visible', pointerEvents: lodTier === 'BIRD' ? 'none' : 'auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', ...badgeStyles[data.status || 'Draft'] }}>
            {data.status}
          </span>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '14px', padding: '4px 10px', marginBottom: '2px' }}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Inline Configuration Dropdown Menu */}
      {menuOpen && (
        <div ref={menuContainerRef} style={{ position: 'absolute', top: '40px', right: '12px', backgroundColor: isDark ? '#1c1c1f' : '#ffffff', border: `1px solid ${isDark ? '#2d2d30' : '#e5e7eb'}`, borderRadius: '6px', padding: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', opacity: lodTier === 'BIRD' ? 0 : 1, visibility: lodTier === 'BIRD' ? 'hidden' : 'visible', pointerEvents: lodTier === 'BIRD' ? 'none' : 'auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa' }}>VIEW MODE</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={() => updateNodeConfig(data.repoPathId, 'COMPACT', data.commitDensity, accentColor, data.explodeBranches)}
              style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', backgroundColor: isCompact ? accentColor : 'transparent', color: isCompact ? '#fff' : (isDark ? '#fff' : '#000'), border: `1px solid ${isDark ? '#2d2d30' : '#e5e7eb'}`, borderRadius: '4px' }}
            >
              Compact
            </button>
            <button 
              onClick={() => updateNodeConfig(data.repoPathId, 'EXPANDED', data.commitDensity, accentColor, data.explodeBranches)}
              style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', backgroundColor: !isCompact ? accentColor : 'transparent', color: !isCompact ? '#fff' : (isDark ? '#fff' : '#000'), border: `1px solid ${isDark ? '#2d2d30' : '#e5e7eb'}`, borderRadius: '4px' }}
            >
              Expanded
            </button>
          </div>

          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa', marginTop: '4px' }}>STRUCTURE VIEW</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => updateNodeConfig(data.repoPathId, data.viewMode, data.commitDensity, accentColor, false)}
              style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', backgroundColor: !data.explodeBranches ? accentColor : 'transparent', color: !data.explodeBranches ? '#fff' : (isDark ? '#fff' : '#000'), border: `1px solid ${isDark ? '#2d2d30' : '#e5e7eb'}`, borderRadius: '4px' }}
            >
              Repository Focus
            </button>
            <button
              onClick={() => updateNodeConfig(data.repoPathId, data.viewMode, data.commitDensity, accentColor, true)}
              style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', backgroundColor: data.explodeBranches ? accentColor : 'transparent', color: data.explodeBranches ? '#fff' : (isDark ? '#fff' : '#000'), border: `1px solid ${isDark ? '#2d2d30' : '#e5e7eb'}`, borderRadius: '4px' }}
            >
              Explode Branches
            </button>
          </div>

          {!isCompact && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa', marginTop: '4px' }}>MAX TIMELINE COMMITS</div>
              <select 
                value={data.commitDensity} 
                onChange={(e) => updateNodeConfig(data.repoPathId, data.viewMode, Number(e.target.value), accentColor, data.explodeBranches)}
                style={{ fontSize: '11px', padding: '2px', backgroundColor: isDark ? '#2d2d30' : '#fff', color: isDark ? '#fff' : '#000', border: '1px solid #71717a', borderRadius: '4px' }}
              >
                <option value={5}>5 Rows</option>
                <option value={10}>10 Rows</option>
                <option value={15}>15 Rows</option>
                <option value={-1}>All (Scroll)</option>
              </select>
            </>
          )}

          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa', marginTop: '4px' }}>THEME COLOR</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899'].map((hex) => (
              <div 
                key={hex} 
                onClick={() => updateNodeConfig(data.repoPathId, data.viewMode, data.commitDensity, hex, data.explodeBranches)}
                style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: hex, border: accentColor === hex ? '2px solid #fff' : 'none', cursor: 'pointer' }} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Internal Timeline Render Area */}
      {!isCompact && (
        <div style={{ marginTop: '10px', borderTop: `1px solid ${isDark ? '#262626' : '#e5e7eb'}`, paddingTop: '8px', minHeight: isScrollableTimeline ? '400px' : 'auto', maxHeight: isScrollableTimeline ? '400px' : 'none', height: isScrollableTimeline ? '400px' : 'auto', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: isDark ? '#a1a1aa' : '#4b5563', opacity: lodTier === 'BIRD' ? 0.35 : 1, flexShrink: 0 }}>
            <div>▲ <strong>{data.aheadCount ?? 0}</strong> ahead</div>
            <div>▼ <strong>{data.behindCount ?? 0}</strong> behind</div>
          </div>
          <CommitTimeline 
            branchId={data.branchId || data.repoPathId} 
            densityLimit={data.commitDensity} 
            lodTier={lodTier} 
            isDark={isDark} 
            accentColor={accentColor} 
            maxHeight={isScrollableTimeline ? '100%' : undefined} 
            isScrollable={isScrollableTimeline} 
          />
        </div>
      )}

      {/* Explicit Source Anchor Handle on Right Side */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="source-right" 
        style={handleStyle} 
      />
    </div>
  );
}