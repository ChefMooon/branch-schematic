import { useState } from 'react';
import { Tabs } from '../../../components/tabs/Tabs';
import type { CanvasViewRecord } from '../../../stores/canvas-store';
import { TabMetadataSettings } from './Tabs/TabMetadataSettings';
import { TabScopeSettings } from './Tabs/TabScopeSettings';
import './canvasViews.css';

type ViewDetailsConfiguratorProps = {
  isDark: boolean;
  view: CanvasViewRecord | null;
};

type DetailsTab = 'metadata' | 'scope';

export function ViewDetailsConfigurator({ isDark, view }: ViewDetailsConfiguratorProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>('metadata');

  if (!view) {
    return (
      <section className="canvas-view-manager__empty-details" data-theme-mode={isDark ? 'dark' : 'light'}>
        Select a view from the left panel.
      </section>
    );
  }

  return (
    <section className="canvas-view-manager__details" data-theme-mode={isDark ? 'dark' : 'light'}>
      <header className="canvas-view-manager__details-header">
        <div className="canvas-view-manager__details-heading">
          <p className="canvas-view-manager__details-eyebrow">Selected view</p>
          <h2 className="canvas-view-manager__details-title" title={view.name}>{view.name}</h2>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="View settings"
        idPrefix="canvas-view-manager"
        items={[
          { value: 'metadata', label: 'Metadata and baseline' },
          { value: 'scope', label: 'Scope and visibility' },
        ]}
      />

      <div className={`canvas-view-manager__details-content${activeTab === 'scope' ? ' canvas-view-manager__details-content--scope' : ''}`}>
        {activeTab === 'metadata' ? (
          <div
            id="canvas-view-manager-panel-metadata"
            role="tabpanel"
            aria-labelledby="canvas-view-manager-tab-metadata"
            tabIndex={0}
          >
            <TabMetadataSettings isDark={isDark} view={view} />
          </div>
        ) : (
          <div
            id="canvas-view-manager-panel-scope"
            role="tabpanel"
            aria-labelledby="canvas-view-manager-tab-scope"
            tabIndex={0}
            className="canvas-view-manager__scope-panel"
          >
            <TabScopeSettings viewId={view.id} />
          </div>
        )}
      </div>
    </section>
  );
}
