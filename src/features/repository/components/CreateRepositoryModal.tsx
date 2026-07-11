import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpenIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';

interface CreateRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRepositoryModal({ isOpen, onClose }: CreateRepositoryModalProps) {
  const [name, setName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [description, setDescription] = useState('');
  const [initializeWithReadme, setInitializeWithReadme] = useState(false);
  const [createInSubfolder, setCreateInSubfolder] = useState(false);
  const [gitIgnore, setGitIgnore] = useState('none');
  const [license, setLicense] = useState('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hydrateFromBackend, hydrateQuickFilterMetadata } = useWorkspaceStore();

  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setLocalPath('');
    setDescription('');
    setInitializeWithReadme(false);
    setCreateInSubfolder(false);
    setGitIgnore('none');
    setLicense('none');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  const handlePickDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Choose Repository Destination',
      });

      if (typeof selectedPath === 'string') {
        setLocalPath(selectedPath);
      }
    } catch (err) {
      console.error('Failed to select repository destination:', err);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedPath = localPath.trim();

    if (!trimmedName || !trimmedPath) {
      setError('Please provide both a repository name and a local path.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const targetPath = trimmedPath;
      const isPathReady = targetPath.length > 0;

      if (!isPathReady) {
        throw new Error('The selected destination is not ready for onboarding.');
      }

      if (initializeWithReadme) {
        console.info('README initialization requested for', trimmedName);
      }

      await invoke('initialize_new_repository', {
        name: trimmedName,
        absolutePath: targetPath,
        initializeWithReadme: initializeWithReadme,
        description,
        createInSubfolder,
        gitignoreTemplate: gitIgnore,
        licenseTemplate: license,
      });
      await hydrateFromBackend();
      await hydrateQuickFilterMetadata();
      onClose();
    } catch (err) {
      console.error('Failed to initialize repository:', err);
      setError(err instanceof Error ? err.message : 'The repository could not be initialized.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RepositoryModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="New Repository"
      description="Create a local Git workspace footprint for a new repository entry."
      footer={
        <>
          <Button type="button" variant="basic" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Repository'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="my-new-repo"
            style={inputStyle}
          />
        </label>

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

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short description for the initial README"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-surface-muted)' }}>
          <span style={{ fontSize: 13, color: 'var(--app-text)' }}>Initialize this repository with a README</span>
          <input type="checkbox" checked={initializeWithReadme} onChange={(event) => setInitializeWithReadme(event.target.checked)} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-surface-muted)' }}>
          <span style={{ fontSize: 13, color: 'var(--app-text)' }}>Create repository in a subfolder</span>
          <input type="checkbox" checked={createInSubfolder} onChange={(event) => setCreateInSubfolder(event.target.checked)} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Git ignore</span>
          <select value={gitIgnore} onChange={(event) => setGitIgnore(event.target.value)} style={inputStyle}>
            <option value="none">None</option>
            <option value="basic">Basic</option>
            <option value="node">Node</option>
            <option value="rust">Rust</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>License</span>
          <select value={license} onChange={(event) => setLicense(event.target.value)} style={inputStyle}>
            <option value="none">None</option>
            <option value="mit">MIT</option>
            <option value="apache">Apache 2.0</option>
          </select>
        </label>

        {error ? <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p> : null}
      </div>
    </RepositoryModalShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid var(--app-border)',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--app-bg)',
  color: 'var(--app-text)',
};
