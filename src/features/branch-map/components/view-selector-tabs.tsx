import { useState } from 'react';
import { GearSix } from '@phosphor-icons/react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { ViewManagerModal } from '../../canvas-views/components/ViewManagerModal';

type ViewSelectorTabsProps = {
  isDark?: boolean;
  isModalOpen?: boolean;
  onModalOpenChange?: (isOpen: boolean) => void;
};

export function ViewSelectorTabs({
  isDark = false,
  isModalOpen: isModalOpenProp,
  onModalOpenChange,
}: ViewSelectorTabsProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = isModalOpenProp ?? internalModalOpen;

  const setModalOpen = (isOpen: boolean) => {
    onModalOpenChange?.(isOpen);
    if (isModalOpenProp === undefined) {
      setInternalModalOpen(isOpen);
    }
  };
  const views = useCanvasStore((state) => state.views);
  const activeViewId = useCanvasStore((state) => state.activeViewId);
  const setActiveView = useCanvasStore((state) => state.setActiveView);
  const createNewView = useCanvasStore((state) => state.createNewView);

  const handlePromptCreateView = () => {
    const name = prompt('Enter a name for your new canvas view layer:');
    if (name && name.trim().length > 0) {
      createNewView(name.trim());
    }
  };

  return (
    <>
      <div 
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          background: isDark ? '#171717' : '#ffffff',
          padding: '6px',
          borderRadius: '8px',
          border: `1px solid ${isDark ? '#262626' : '#e2e8f0'}`,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}
      >
        {views.map((v) => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setActiveView(v.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: activeViewId === v.id 
                  ? (isDark ? '#262626' : '#f1f5f9') 
                  : 'transparent',
                color: activeViewId === v.id
                  ? (isDark ? '#ffffff' : '#0f172a')
                  : (isDark ? '#a3a3a3' : '#64748b'),
                transition: 'all 0.15s ease'
              }}
            >
              {v.name}
            </button>
          </div>
        ))}
        
        <button
          onClick={handlePromptCreateView}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
        >
          ＋ New View
        </button>

        <button
          onClick={() => setModalOpen(true)}
          title="Manage views"
          style={{
            padding: '6px',
            borderRadius: '6px',
            border: `1px solid ${isDark ? '#404040' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#111111' : '#ffffff',
            color: isDark ? '#d4d4d4' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <GearSix size={16} />
        </button>
      </div>

      <ViewManagerModal isDark={isDark} isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}