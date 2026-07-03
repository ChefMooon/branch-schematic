import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CommitRecord {
  commit_hash: string;
  author_name: string;
  commit_message: string;
  committed_at: string;
  signature_status?: string | null;
}

interface CommitTimelineProps {
  branchId: string;
  densityLimit: number;
  lodTier: 'CLOSE' | 'MID' | 'BIRD';
  maxRows?: number;
  maxHeight?: string;
  isScrollable?: boolean;
  isDark: boolean;
  accentColor: string;
}

export function CommitTimeline({ branchId, densityLimit, lodTier, isDark, accentColor, maxHeight, isScrollable = false }: CommitTimelineProps) {
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isBird = lodTier === 'BIRD';
  const placeholderCount = Math.max(3, Math.min(6, Math.ceil((densityLimit === -1 ? 100 : densityLimit) / 6)));
  const displayedRows = Math.max(1, commits.length || (densityLimit > 0 ? densityLimit : 1));
  const closeRowHeight = 88;
  const rowGap = 8;
  const nonScrollableHeightPx = Math.max(
    140,
    displayedRows * closeRowHeight + Math.max(0, displayedRows - 1) * rowGap,
  );
  const shellHeight = isScrollable ? (maxHeight ?? '400px') : `${nonScrollableHeightPx}px`;

  useEffect(() => {
    async function loadCommits() {
      setLoading(true);
      try {
        // Use an unbounded query for the scrollable full-history mode and a bounded query for fixed row selections.
        const dbLimit = densityLimit === -1 ? 0 : densityLimit;
        const list = await invoke<CommitRecord[]>('get_branch_commits', { branchId, limit: dbLimit });
        setCommits(list);
      } catch (err) {
        console.error('Failed fetching commit history lists:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCommits();
  }, [branchId, densityLimit]);

  const shellStyle: React.CSSProperties = {
    minHeight: shellHeight,
    maxHeight: shellHeight,
    height: shellHeight,
    overflowY: isScrollable ? 'auto' : 'hidden',
    overflowX: 'hidden',
    overflow: isScrollable ? 'auto' : 'hidden',
    paddingRight: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: isBird ? '6px' : '8px',
    position: 'relative',
    justifyContent: isBird ? 'center' : 'flex-start',
    opacity: isBird ? 0.35 : 1,
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={{ ...shellStyle, alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: `1px dashed ${isDark ? '#2d2d30' : '#e5e7eb'}`, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
        <div style={{ fontSize: 11, padding: 8, color: '#71717a' }}>Streaming timeline records...</div>
      </div>
    );
  }

  if (isBird) {
    return (
      <div style={{ ...shellStyle, borderRadius: '6px', border: `1px dashed ${isDark ? '#2d2d30' : '#e5e7eb'}`, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '8px 8px' }}>
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <div key={`bird-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: accentColor, opacity: 0.2 + index * 0.12 }} />
            <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: isDark ? '#262626' : '#e5e7eb', opacity: 0.2 + index * 0.12 }} />
          </div>
        ))}
      </div>
    );
  }

  // Mid-Range LOD Tier: Render structural high-density abstract rows (dots/lines)
  if (lodTier === 'MID') {
    const midLayoutStyle: React.CSSProperties = {
      ...shellStyle,
      justifyContent: commits.length > 1 ? 'space-evenly' : 'center',
      gap: 0,
    };

    return (
      <div style={midLayoutStyle}>
        {commits.map((c) => (
          <div key={c.commit_hash} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: accentColor }} />
            <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: isDark ? '#262626' : '#e5e7eb' }} />
          </div>
        ))}
      </div>
    );
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isScrollable) return;
    event.stopPropagation();
  };

  // Close-Up Full Rich Text Viewport with internal scrolling framework
  return (
    <div 
      ref={scrollContainerRef}
      style={shellStyle}
      onWheelCapture={handleWheel}
    >
      {commits.map((commit) => {
        const shortHash = commit.commit_hash.substring(0, 7);
        const isSigned = commit.signature_status === 'GOOD';

        return (
          <div 
            key={commit.commit_hash}
            style={{
              height: `${closeRowHeight}px`,
              flexShrink: 0,
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: isDark ? '#171717' : '#f9fafb',
              borderLeft: `3px solid ${accentColor}`,
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#71717a' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{shortHash}</span>
              <span>{commit.committed_at.split(' ')[0]}</span>
            </div>
            <div style={{ color: isDark ? '#e4e4e7' : '#27272a', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {commit.commit_message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '10px' }}>
              <span>{commit.author_name}</span>
              {isSigned && (
                <span style={{ color: '#10b981', fontWeight: 'bold' }} title="Cryptographically Verified Signature">
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}