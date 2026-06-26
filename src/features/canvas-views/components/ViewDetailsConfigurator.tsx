import { useMemo, useState } from 'react';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { TabMetadataSettings } from './Tabs/TabMetadataSettings';
import { TabScopeSettings } from './Tabs/TabScopeSettings';

type ViewDetailsConfiguratorProps = {
  isDark: boolean;
  view: CanvasViewRecord | null;
};

type DetailsTab = 'metadata' | 'scope';

export function ViewDetailsConfigurator({ isDark, view }: ViewDetailsConfiguratorProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>('metadata');

  const tabs = useMemo(
    () => [
      { id: 'metadata' as const, label: 'Metadata + Baseline' },
      { id: 'scope' as const, label: 'Scope + Visibility' },
    ],
    [],
  );

  if (!view) {
    return (
      <section style={{ padding: 20, color: isDark ? '#a3a3a3' : '#64748b' }}>
        Select a view from the left panel.
      </section>
    );
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: isDark ? '#0c0c0d' : '#ffffff',
        borderLeft: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
      }}
    >
      <header style={{ padding: 14, borderBottom: `1px solid ${isDark ? '#262626' : '#e2e8f0'}` }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: isDark ? '#f5f5f5' : '#0f172a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {view.name}
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: 6,
            maxWidth: '100%',
            background: isDark ? '#111111' : '#f8fafc',
            border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`,
            borderRadius: 10,
            padding: 4,
          }}
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 11px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: selected ? '#2563eb' : (isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(37, 99, 235, 0.1)'),
                  color: selected ? '#fff' : (isDark ? '#d4d4d8' : '#334155'),
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={{ minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: 14 }}>
        {activeTab === 'metadata' ? (
          <TabMetadataSettings isDark={isDark} view={view} />
        ) : (
          <TabScopeSettings isDark={isDark} viewId={view.id} />
        )}
      </div>
    </section>
  );
}
