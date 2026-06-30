import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from '@phosphor-icons/react';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';

interface AddLocalRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddLocalRepositoryModal({ isOpen, onClose }: AddLocalRepositoryModalProps) {
  const [localPath, setLocalPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hydrateFromBackend, hydrateQuickFilterMetadata } = useWorkspaceStore();

  useEffect(() => {
    if (!isOpen) return;

    setLocalPath('');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  const handlePickDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Local Repository Folder',
      });

      if (typeof selectedPath === 'string') {
        setLocalPath(selectedPath);
      }
    } catch (err) {
      console.error('Failed to select repository folder:', err);
    }
  };

  const handleSubmit = async () => {
    const trimmedPath = localPath.trim();
    if (!trimmedPath) {
      setError('Choose a local repository path before continuing.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await invoke('add_new_tracked_path', { absolutePath: trimmedPath });
      await hydrateFromBackend();
      await hydrateQuickFilterMetadata();
      onClose();
    } catch (err) {
      console.error('Failed to add local repository:', err);
      setError(err instanceof Error ? err.message : 'The repository could not be added.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RepositoryModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Add Local Repository"
      description="Attach an existing Git repository from your machine to the workspace catalog."
      footer={
        <>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} style={primaryButtonStyle}>
            {isSubmitting ? 'Adding…' : 'Add Repository'}
          </button>
        </>
      }
    >
      <div style={formContainerStyle}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Local path</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={localPath}
              onChange={(event) => setLocalPath(event.target.value)}
              placeholder="C:/Users/you/projects/my-repo"
              style={inputStyle}
            />
            <button type="button" onClick={handlePickDirectory} style={iconButtonStyle}>
              <FolderOpen size={16} weight="bold" />
            </button>
          </div>
        </label>

        {error ? <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p> : null}
      </div>
    </RepositoryModalShell>
  );
}

const formContainerStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingBottom: 14,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid var(--app-border)',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--app-bg)',
  color: 'var(--app-text)',
};

const iconButtonStyle: React.CSSProperties = {
  border: '1px solid var(--app-border)',
  background: 'var(--app-surface-muted)',
  color: 'var(--app-text)',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--app-border)',
  background: 'transparent',
  color: 'var(--app-text)',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#4f46e5',
  color: '#ffffff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
};