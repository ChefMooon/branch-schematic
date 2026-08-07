import { useState } from 'react';
import { Button } from '../../../components/button/Button';
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
          <h2 className="canvas-view-manager__details-title" title={view.name}>{view.name}</h2>
          <p className="canvas-view-manager__details-meta">
            Configure this view without changing the rest of your saved environments.
          </p>
          <div className="canvas-view-manager__tabs" role="tablist" aria-label="View settings">
            <Button
              type="button"
              variant="basic"
              role="tab"
              id="canvas-view-manager-tab-metadata"
              aria-selected={activeTab === 'metadata'}
              aria-controls="canvas-view-manager-panel-metadata"
              className={`canvas-view-manager__tab${activeTab === 'metadata' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata and baseline
            </Button>
            <Button
              type="button"
              variant="basic"
              role="tab"
              id="canvas-view-manager-tab-scope"
              aria-selected={activeTab === 'scope'}
              aria-controls="canvas-view-manager-panel-scope"
              className={`canvas-view-manager__tab${activeTab === 'scope' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('scope')}
            >
              Scope and visibility
            </Button>
          </div>
        </div>
      </header>

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
