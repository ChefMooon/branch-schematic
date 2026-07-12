import { useState } from 'react';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsiblePanel({ title, children, defaultExpanded = false }: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section style={styles.panel}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={styles.headerButton}
        aria-expanded={isExpanded}
      >
        <span style={styles.sectionTitle}>{title}</span>
        {isExpanded ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
      </button>

      {isExpanded && (
        <div style={styles.content}>
          {children}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    border: '1px solid var(--app-border)',
    borderRadius: '12px',
    backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
    display: 'flex',
    flexDirection: 'column',
  },
  headerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px',
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '13px',
  },
  content: {
    padding: '0 12px 12px 12px',
    display: 'grid',
    gap: '10px',
  },
};