import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from '@phosphor-icons/react';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import type { DiscoveredRepository } from '../types';

interface BulkImportLocalRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkImportLocalRepositoryModal({
  isOpen,
  onClose,
}: BulkImportLocalRepositoryModalProps) {
  const [rootPath, setRootPath] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<DiscoveredRepository[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const { hydrateFromBackend, hydrateQuickFilterMetadata } = useWorkspaceStore();

  useEffect(() => {
    if (!isOpen) return;

    setRootPath('');
    setMaxDepth(3);
    setIsScanning(false);
    setIsImporting(false);
    setError(null);
    setDiscoveries([]);
    setSelectedPaths({});
  }, [isOpen]);

  const handlePickDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Folder to Scan',
      });

      if (typeof selectedPath === 'string') {
        setRootPath(selectedPath);
      }
    } catch (err) {
      console.error('Failed to select bulk import folder:', err);
    }
  };

  const handleRunPreview = async () => {
    const trimmedRootPath = rootPath.trim();
    if (!trimmedRootPath) {
      setError('Choose a folder to scan before previewing repositories.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const discovered = await invoke<DiscoveredRepository[]>('crawl_repositories_command', {
        rootPath: trimmedRootPath,
        maxDepth,
      });

      const validDiscoveries = discovered.filter((item) => item.is_git_repository);
      setDiscoveries(validDiscoveries);
      setSelectedPaths(
        Object.fromEntries(validDiscoveries.map((item) => [item.absolute_path, true]))
      );
    } catch (err) {
      console.error('Failed to preview repositories:', err);
      setError(err instanceof Error ? err.message : 'The repository scan could not be completed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectionChange = (path: string, selected: boolean) => {
    setSelectedPaths((current) => ({ ...current, [path]: selected }));
  };

  const handleClearSelection = () => {
    setSelectedPaths({});
    setDiscoveries([]);
    setError(null);
  };

  const handleImportSelected = async () => {
    const selectedRepositories = discoveries.filter((item) => Boolean(selectedPaths[item.absolute_path]));
    if (selectedRepositories.length === 0) {
      setError('Select at least one repository to import.');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      for (const repository of selectedRepositories) {
        await invoke('add_new_tracked_path', { absolutePath: repository.absolute_path });
      }

      await hydrateFromBackend();
      await hydrateQuickFilterMetadata();
      onClose();
    } catch (err) {
      console.error('Failed to import repositories:', err);
      setError(err instanceof Error ? err.message : 'The selected repositories could not be imported.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <RepositoryModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Import Repositories"
      description="Scan a folder tree for Git repositories and import the ones you want."
      footer={
        <>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportSelected}
            disabled={isImporting || discoveries.length === 0}
            style={primaryButtonStyle}
          >
            {isImporting ? 'Importing…' : 'Import selected'}
          </button>
        </>
      }
    >
      <div style={formContainerStyle}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Scan root path</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder="C:/Users/you/projects"
              style={inputStyle}
            />
            <button type="button" onClick={handlePickDirectory} style={iconButtonStyle}>
              <FolderOpen size={16} weight="bold" />
            </button>
          </div>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>Max depth</span>
          <input
            type="number"
            min={1}
            max={6}
            value={maxDepth}
            onChange={(event) => setMaxDepth(Number(event.target.value))}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRunPreview}
            disabled={isScanning || !rootPath.trim()}
            style={secondaryButtonStyle}
          >
            {isScanning ? 'Scanning…' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={discoveries.length === 0}
            style={secondaryButtonStyle}
          >
            Clear
          </button>
        </div>

        {error ? <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p> : null}

        <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
          {discoveries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--app-muted)' }}>
              No preview results yet. Choose a folder and run a scan.
            </p>
          ) : (
            discoveries.map((repository) => (
              <label
                key={repository.absolute_path}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-surface-muted)',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedPaths[repository.absolute_path])}
                  onChange={(event) => handleSelectionChange(repository.absolute_path, event.target.checked)}
                />
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text)' }}>
                    {repository.display_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--app-muted)' }}>{repository.absolute_path}</span>
                </span>
              </label>
            ))
          )}
        </div>
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
  background: 'var(--app-accent)',
  color: '#ffffff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
};
