import { useEffect, useMemo, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { Button } from '../../../../components/button/Button';
import { useCanvasStore, type CanvasViewRecord } from '../../../../stores/canvas-store';
import '../canvasViews.css';

type TabMetadataSettingsProps = {
  isDark: boolean;
  view: CanvasViewRecord;
};

export function TabMetadataSettings({ isDark, view }: TabMetadataSettingsProps) {
  const renameView = useCanvasStore((state) => state.renameView);
  const snapshotBaselineViewport = useCanvasStore((state) => state.snapshotBaselineViewport);
  const { zoom, x, y } = useViewport();

  const [nameDraft, setNameDraft] = useState(view.name);
  const [baselineZoom, setBaselineZoom] = useState(view.baseline_zoom ?? view.zoom_level);
  const [baselineX, setBaselineX] = useState(view.baseline_pan_x ?? view.pan_x);
  const [baselineY, setBaselineY] = useState(view.baseline_pan_y ?? view.pan_y);

  useEffect(() => {
    setNameDraft(view.name);
    setBaselineZoom(view.baseline_zoom ?? view.zoom_level);
    setBaselineX(view.baseline_pan_x ?? view.pan_x);
    setBaselineY(view.baseline_pan_y ?? view.pan_y);
  }, [view]);

  const hasNameChanges = useMemo(
    () => nameDraft.trim() !== '' && nameDraft.trim() !== view.name,
    [nameDraft, view.name],
  );

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === view.name) return;
    await renameView(view.id, trimmed);
  };

  const saveManualBaseline = async () => {
    await snapshotBaselineViewport(view.id, baselineZoom, baselineX, baselineY);
  };

  const snapshotCurrentViewport = async () => {
    await snapshotBaselineViewport(view.id, zoom, x, y);
    setBaselineZoom(zoom);
    setBaselineX(x);
    setBaselineY(y);
  };

  return (
    <div className="canvas-view-manager__settings-stack" data-theme-mode={isDark ? 'dark' : 'light'}>
      <section className="canvas-view-manager__panel">
        <div className="canvas-view-manager__panel-heading">
          <h3 className="canvas-view-manager__panel-title">View metadata</h3>
          <p className="canvas-view-manager__panel-description">
            Rename this environment and define its default home viewport.
          </p>
        </div>

        <label className="canvas-view-manager__field">
          <span>View name</span>
          <input
            className="canvas-view-manager__input"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            maxLength={100}
          />
        </label>

        <div className="canvas-view-manager__actions">
          <Button type="button" variant="submit" onClick={() => void saveName()} disabled={!hasNameChanges}>
            Save name
          </Button>
        </div>
      </section>

      <section className="canvas-view-manager__panel">
        <div className="canvas-view-manager__panel-heading">
          <h3 className="canvas-view-manager__panel-title">Baseline viewport</h3>
          <p className="canvas-view-manager__panel-description">
            Snapshot the current viewport or enter precise coordinates manually.
          </p>
        </div>

        <div className="canvas-view-manager__actions">
          <Button type="button" variant="submit" onClick={() => void snapshotCurrentViewport()}>
            Snapshot current viewport
          </Button>
        </div>

        <div className="canvas-view-manager__viewport-grid">
          <NumericField label="Zoom" value={baselineZoom} onChange={setBaselineZoom} />
          <NumericField label="Pan X" value={baselineX} onChange={setBaselineX} />
          <NumericField label="Pan Y" value={baselineY} onChange={setBaselineY} />
        </div>

        <div className="canvas-view-manager__actions">
          <Button type="button" variant="submit" onClick={() => void saveManualBaseline()}>
            Save baseline
          </Button>
        </div>
      </section>
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function NumericField({ label, value, onChange }: NumericFieldProps) {
  return (
    <label className="canvas-view-manager__field">
      <span>{label}</span>
      <input
        className="canvas-view-manager__input"
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
