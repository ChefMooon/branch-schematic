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
  isDark: boolean;
  accentColor: string;
}

export function CommitTimeline({ branchId, densityLimit, lodTier, isDark, accentColor }: CommitTimelineProps) {
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCommits() {
      setLoading(true);
      try {
        // Map UI configuration token '-1' straight to an un-capped database query limit
        const dbLimit = densityLimit === -1 ? 100 : densityLimit;
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

  if (lodTier === 'BIRD') return null;

  if (loading) {
    return <div style={{ fontSize: 11, padding: 8, color: '#71717a' }}>Streaming timeline records...</div>;
  }

  // Mid-Range LOD Tier: Render structural high-density abstract rows (dots/lines)
  if (lodTier === 'MID') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 4px' }}>
        {commits.map((c) => (
          <div key={c.commit_hash} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: accentColor }} />
            <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: isDark ? '#262626' : '#e5e7eb' }} />
          </div>
        ))}
      </div>
    );
  }

  // Close-Up Full Rich Text Viewport with internal scrolling framework
  return (
    <div 
      ref={scrollContainerRef}
      style={{
        maxHeight: '180px',
        overflowY: 'auto',
        paddingRight: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative'
      }}
    >
      {commits.map((commit) => {
        const shortHash = commit.commit_hash.substring(0, 7);
        const isSigned = commit.signature_status === 'GOOD';

        return (
          <div 
            key={commit.commit_hash}
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: isDark ? '#171717' : '#f9fafb',
              borderLeft: `3px solid ${accentColor}`,
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
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