import { useEffect, useMemo, useState } from 'react';
import { useViewport } from '@xyflow/react';
import type { CanvasViewRecord } from '../../../../stores/canvas-store';
import { useCanvasStore } from '../../../../stores/canvas-store';

type TabMetadataSettingsProps = {
  isDark: boolean;
  view: CanvasViewRecord;
};

export function TabMetadataSettings({ isDark, view }: TabMetadataSettingsProps) {
  const renameView = useCanvasStore((state) => state.renameView);
  const snapshotBaselineViewport = useCanvasStore((state) => state.snapshotBaselineViewport);
  const { zoom, x, y } = useViewport();

  const [nameDraft, setNameDraft] = useState(view.name);
  const [baselineZoom, setBaselineZoom] = useState<number>(view.baseline_zoom ?? view.zoom_level);
  const [baselineX, setBaselineX] = useState<number>(view.baseline_pan_x ?? view.pan_x);
  const [baselineY, setBaselineY] = useState<number>(view.baseline_pan_y ?? view.pan_y);

  useEffect(() => {
    setNameDraft(view.name);
    setBaselineZoom(view.baseline_zoom ?? view.zoom_level);
    setBaselineX(view.baseline_pan_x ?? view.pan_x);
    setBaselineY(view.baseline_pan_y ?? view.pan_y);
  }, [view]);

  const hasNameChanges = useMemo(() => nameDraft.trim() !== '' && nameDraft.trim() !== view.name, [nameDraft, view.name]);

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
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`, borderRadius: 10, padding: 12, background: isDark ? '#111111' : '#ffffff' }}>
        <h4 style={{ margin: 0, fontSize: 13, color: isDark ? '#f5f5f5' : '#0f172a' }}>View Metadata</h4>
        <p style={{ margin: '6px 0 10px', fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>
          Rename this environment and define its default home viewport.
        </p>

        <label style={{ fontSize: 12, color: isDark ? '#d4d4d8' : '#334155', display: 'grid', gap: 6 }}>
          View name
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            style={{
              borderRadius: 8,
              border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
              background: isDark ? '#0f0f10' : '#fff',
              color: isDark ? '#f5f5f5' : '#0f172a',
              padding: '8px 10px',
              fontSize: 13,
            }}
          />
        </label>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            disabled={!hasNameChanges}
            onClick={() => void saveName()}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: hasNameChanges ? 'pointer' : 'not-allowed',
              background: hasNameChanges ? '#2563eb' : (isDark ? '#27272a' : '#cbd5e1'),
              color: '#fff',
            }}
          >
            Save Name
          </button>
        </div>
      </section>

      <section style={{ border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`, borderRadius: 10, padding: 12, background: isDark ? '#111111' : '#ffffff' }}>
        <h4 style={{ margin: 0, fontSize: 13, color: isDark ? '#f5f5f5' : '#0f172a' }}>Baseline Viewport</h4>
        <p style={{ margin: '6px 0 10px', fontSize: 12, color: isDark ? '#a3a3a3' : '#64748b' }}>
          Snapshot current viewport or enter precise coordinates manually.
        </p>

        <button
          onClick={() => void snapshotCurrentViewport()}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: '#0ea5e9',
            color: '#fff',
          }}
        >
          Snapshot Current Viewport
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 12, minWidth: 0 }}>
          <NumericField label="Zoom" value={baselineZoom} onChange={setBaselineZoom} isDark={isDark} />
          <NumericField label="Pan X" value={baselineX} onChange={setBaselineX} isDark={isDark} />
          <NumericField label="Pan Y" value={baselineY} onChange={setBaselineY} isDark={isDark} />
        </div>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void saveManualBaseline()}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: '#16a34a',
              color: '#fff',
            }}
          >
            Save Baseline
          </button>
        </div>
      </section>
    </div>
  );
}

type NumericFieldProps = {
  isDark: boolean;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function NumericField({ isDark, label, value, onChange }: NumericFieldProps) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 12, color: isDark ? '#d4d4d8' : '#334155', minWidth: 0 }}>
      {label}
      <input
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          borderRadius: 8,
          border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
          background: isDark ? '#0f0f10' : '#fff',
          color: isDark ? '#f5f5f5' : '#0f172a',
          padding: '8px 10px',
          fontSize: 12,
        }}
      />
    </label>
  );
}
