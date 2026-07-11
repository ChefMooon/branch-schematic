import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpenIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import type { DiscoveredRepository } from '../types';

interface RepositoryTrackResult {
  outcome: 'added' | 'already_tracked';
  message: string;
}

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
  const { addToast } = useNotifications();

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
      let addedCount = 0;
      let skippedCount = 0;

      for (const repository of selectedRepositories) {
        const result = await invoke<RepositoryTrackResult>('add_new_tracked_path', {
          absolutePath: repository.absolute_path,
        });

        if (result.outcome === 'added') {
          addedCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      await hydrateFromBackend();
      await hydrateQuickFilterMetadata();

      const summaryMessage =
        skippedCount > 0
          ? `Imported ${addedCount} repository${addedCount === 1 ? '' : 'ies'}. Skipped ${skippedCount} because it was already tracked.`
          : `Imported ${addedCount} repository${addedCount === 1 ? '' : 'ies'}.`;

      addToast({
        title: skippedCount > 0 ? 'Bulk import completed' : 'Repositories imported',
        message: summaryMessage,
        variant: skippedCount > 0 ? 'warning' : 'success',
        target: 'both',
        duration: 7000,
      });

      onClose();
    } catch (err) {
      console.error('Failed to import repositories:', err);
      const message = err instanceof Error ? err.message : 'The selected repositories could not be imported.';
      setError(message);
      addToast({
        title: 'Bulk import failed',
        message,
        variant: 'error',
        target: 'both',
        duration: 7000,
      });
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
          <Button type="button" variant="basic" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="submit"
            onClick={handleImportSelected}
            disabled={isImporting || discoveries.length === 0}
          >
            {isImporting ? 'Importing…' : 'Import selected'}
          </Button>
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
            <Button type="button" variant="basic" onClick={handlePickDirectory}>
              <FolderOpenIcon size={16} weight="bold" />
            </Button>
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
          <Button
            type="button"
            variant="basic"
            onClick={handleRunPreview}
            disabled={isScanning || !rootPath.trim()}
          >
            {isScanning ? 'Scanning…' : 'Scan'}
          </Button>
          <Button
            type="button"
            variant="basic"
            onClick={handleClearSelection}
            disabled={discoveries.length === 0}
          >
            Clear
          </Button>
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
