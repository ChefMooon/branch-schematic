import { useEffect, useState } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';

// Define explicit types matching our mock data
type BranchCardNode = Node<{
  title: string;
  status: 'Active' | 'Draft' | 'Archived';
  content: string;
}>;

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

  const cardStyle: React.CSSProperties = {
    width: 288,
    padding: 16,
    borderRadius: 16,
    border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
    backgroundColor: isDark ? '#111827' : '#ffffff',
    color: isDark ? '#f9fafb' : '#111827',
    boxShadow: isDark ? '0 20px 45px rgba(0, 0, 0, 0.35)' : '0 16px 34px rgba(15, 23, 42, 0.12)',
    fontFamily: 'Inter, Avenir, Helvetica, Arial, sans-serif',
    letterSpacing: '0.01em',
  };

  const handleStyle: React.CSSProperties = {
    width: 12,
    height: 12,
    backgroundColor: isDark ? '#6b7280' : '#9ca3af',
    border: 'none',
  };

  const statusStyles: Record<BranchCardNode['data']['status'], React.CSSProperties> = {
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
    <div style={cardStyle}>
      {/* Target connection point (Left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />

      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.title}
        </h3>
        <span style={{ ...statusStyles[data.status], fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {data.status}
        </span>
      </div>

      {/* Card Body */}
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: isDark ? '#d1d5db' : '#4b5563' }}>
        {data.content}
      </p>

      {/* Source connection point (Right side) */}
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
    </div>
  );
}