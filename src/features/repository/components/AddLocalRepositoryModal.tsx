import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpenIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useNotifications } from '../../../components/notifications/NotificationProvider';

interface RepositoryTrackResult {
  outcome: 'added' | 'already_tracked';
  message: string;
}

interface AddLocalRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddLocalRepositoryModal({ isOpen, onClose }: AddLocalRepositoryModalProps) {
  const [localPath, setLocalPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hydrateFromBackend, hydrateQuickFilterMetadata } = useWorkspaceStore();
  const { addToast } = useNotifications();

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
      const result = await invoke<RepositoryTrackResult>('add_new_tracked_path', { absolutePath: trimmedPath });
      await hydrateFromBackend();
      await hydrateQuickFilterMetadata();

      addToast({
        title: result.outcome === 'already_tracked' ? 'Repository already tracked' : 'Repository added',
        message: result.message,
        variant: result.outcome === 'already_tracked' ? 'warning' : 'success',
        target: 'both',
        duration: 6000,
      });

      onClose();
    } catch (err) {
      console.error('Failed to add local repository:', err);
      const message = err instanceof Error ? err.message : 'The repository could not be added.';
      setError(message);
      addToast({
        title: 'Repository could not be added',
        message,
        variant: 'error',
        target: 'both',
        duration: 7000,
      });
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
          <Button type="button" variant="basic" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
             variant="basic"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('open-bulk-import-modal'));
            }}
          >
            Bulk import
          </Button>
          <Button type="button" variant="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add Repository'}
          </Button>
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
              placeholder="C:/Users/you/projects"
              style={inputStyle}
            />
            <Button type="button" variant="basic" onClick={handlePickDirectory}>
              <FolderOpenIcon size={16} weight="bold" />
            </Button>
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