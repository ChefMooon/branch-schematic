import { useMemo, useState } from 'react';
import { Check, CopySimple, PencilSimple, Trash, X } from '@phosphor-icons/react';
import type { CanvasViewRecord } from '../../../stores/canvas-store';

type ViewManagerSidebarProps = {
  isDark: boolean;
  views: CanvasViewRecord[];
  selectedViewId: string | null;
  onSelect: (viewId: string) => void;
  onCreate: () => void;
  onDuplicate: (view: CanvasViewRecord) => void;
  onRename: (viewId: string, newName: string) => Promise<void>;
  onDelete: (view: CanvasViewRecord) => Promise<void>;
};

export function ViewManagerSidebar({
  isDark,
  views,
  selectedViewId,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}: ViewManagerSidebarProps) {
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const selectedView = useMemo(
    () => views.find((view) => view.id === selectedViewId) ?? null,
    [views, selectedViewId],
  );

  const startEditing = (view: CanvasViewRecord) => {
    setEditingViewId(view.id);
    setDraftName(view.name);
  };

  const cancelEditing = () => {
    setEditingViewId(null);
    setDraftName('');
  };

  const saveRename = async (viewId: string) => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    await onRename(viewId, trimmed);
    cancelEditing();
  };

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        borderRight: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
        background: isDark ? '#101010' : '#f8fafc',
      }}
    >
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${isDark ? '#262626' : '#e2e8f0'}` }}>
        <button
          onClick={onCreate}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 700,
            background: '#4f46e5',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          + Create View
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {views.length === 0 && (
          <div style={{ borderRadius: 8, padding: 10, color: isDark ? '#a3a3a3' : '#64748b', fontSize: 12 }}>
            No views available.
          </div>
        )}

        {views.map((view) => {
          const selected = view.id === selectedViewId;
          const isEditing = editingViewId === view.id;
          const nameColor = selected
            ? (isDark ? '#f5f5f5' : '#0f172a')
            : (isDark ? '#e5e5e5' : '#1e293b');

          return (
            <div
              key={view.id}
              style={{
                border: `1px solid ${selected ? '#6366f1' : (isDark ? '#262626' : '#dbe3ef')}`,
                borderRadius: 10,
                background: selected ? (isDark ? '#191b2f' : '#eef2ff') : (isDark ? '#151515' : '#fff'),
                padding: '12px 14px',
                overflow: 'hidden',
              }}
            >
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      borderRadius: 6,
                      border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
                      background: isDark ? '#0f0f10' : '#fff',
                      color: isDark ? '#fafafa' : '#0f172a',
                      padding: '6px 8px',
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={() => void saveRename(view.id)}
                    title="Save"
                    style={{ border: 'none', background: 'transparent', color: '#10b981', cursor: 'pointer' }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={cancelEditing}
                    title="Cancel"
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <button
                      onClick={() => onSelect(view.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        padding: 0,
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: nameColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {view.name}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: isDark ? '#a3a3a3' : '#64748b',
                          marginTop: 0,
                        }}
                      >
                        Zoom: {(view.baseline_zoom ?? view.zoom_level).toFixed(2)}
                      </div>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => onDuplicate(view)}
                      title={`Duplicate ${view.name}`}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#27272a' : '#e2e8f0';
                        event.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#18181b' : '#f1f5f9';
                        event.currentTarget.style.transform = 'translateY(0)';
                      }}
                      style={{
                        border: 'none',
                        background: isDark ? '#18181b' : '#f1f5f9',
                        color: isDark ? '#d4d4d8' : '#475569',
                        cursor: 'pointer',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 140ms ease, transform 140ms ease',
                        flexShrink: 0,
                        lineHeight: 0,
                      }}
                    >
                      <CopySimple size={16} weight="bold" style={{ display: 'block' }} />
                    </button>
                    <button
                      onClick={() => startEditing(view)}
                      title={`Rename ${view.name}`}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#27272a' : '#e2e8f0';
                        event.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#18181b' : '#f1f5f9';
                        event.currentTarget.style.transform = 'translateY(0)';
                      }}
                      style={{
                        border: 'none',
                        background: isDark ? '#18181b' : '#f1f5f9',
                        color: isDark ? '#d4d4d8' : '#475569',
                        cursor: 'pointer',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 140ms ease, transform 140ms ease',
                        flexShrink: 0,
                        lineHeight: 0,
                      }}
                    >
                      <PencilSimple size={16} weight="bold" style={{ display: 'block' }} />
                    </button>
                    <button
                      onClick={() => void onDelete(view)}
                      title={`Delete ${view.name}`}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#3f1d22' : '#fee2e2';
                        event.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = isDark ? '#2b1418' : '#fff1f2';
                        event.currentTarget.style.transform = 'translateY(0)';
                      }}
                      style={{
                        border: 'none',
                        background: isDark ? '#2b1418' : '#fff1f2',
                        color: '#ef4444',
                        cursor: 'pointer',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 140ms ease, transform 140ms ease',
                        flexShrink: 0,
                        lineHeight: 0,
                      }}
                    >
                      <Trash size={16} weight="bold" style={{ display: 'block' }} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {selectedView && (
        <div style={{ borderTop: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`, padding: 10, fontSize: 11, color: isDark ? '#a3a3a3' : '#64748b' }}>
          Active: {selectedView.name}
        </div>
      )}
    </aside>
  );
}
