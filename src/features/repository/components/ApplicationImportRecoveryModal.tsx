import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, WarningCircle } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { RepositoryModalShell } from './RepositoryModalShell';
import { useWorkspaceStore } from '../../../stores/workspace-store';

export interface ImportRecoveryRepository {
  id: string;
  displayName: string;
  absolutePath: string;
}

interface ApplicationImportRecoveryModalProps {
  isOpen: boolean;
  repositories: ImportRecoveryRepository[];
  conflicts: string[];
  skippedLayoutRecords: number;
  onClose: () => void;
}

export function ApplicationImportRecoveryModal({
  isOpen,
  repositories,
  conflicts,
  skippedLayoutRecords,
  onClose,
}: ApplicationImportRecoveryModalProps) {
  const relinkRepositoryPath = useWorkspaceStore((state) => state.relinkRepositoryPath);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const visibleRepositories = repositories.filter((repository) => !resolvedIds.includes(repository.id));

  const handleLocate = async (repository: ImportRecoveryRepository) => {
    setPendingId(repository.id);
    setErrors((current) => ({ ...current, [repository.id]: '' }));
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: `Locate ${repository.displayName}`,
      });
      if (typeof selectedPath !== 'string' || !selectedPath.trim()) return;

      await relinkRepositoryPath(repository.id, selectedPath);
      setResolvedIds((current) => [...current, repository.id]);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [repository.id]: error instanceof Error ? error.message : 'The selected folder could not be attached.',
      }));
    } finally {
      setPendingId(null);
    }
  };

  const hasDiagnostics = conflicts.length > 0 || skippedLayoutRecords > 0;

  return (
    <RepositoryModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Finish application import"
      description="Some imported data needs your attention before it is fully restored."
      size="wide"
      footer={<Button type="button" variant="basic" onClick={onClose}>Close</Button>}
    >
      {visibleRepositories.length > 0 ? (
        <section aria-labelledby="import-recovery-repositories" style={{ display: 'grid', gap: 8 }}>
          <h4 id="import-recovery-repositories" style={{ margin: '0 0 2px', color: 'var(--app-text)', fontSize: 14 }}>
            Repository paths to relink
          </h4>
          {visibleRepositories.map((repository) => (
            <div key={repository.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--app-border)', borderRadius: 8 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: 'var(--app-text)', fontSize: 13 }}>{repository.displayName}</strong>
                <span style={{ display: 'block', overflowWrap: 'anywhere', color: 'var(--app-muted)', fontSize: 12 }}>{repository.absolutePath}</span>
                {errors[repository.id] ? <span style={{ display: 'block', marginTop: 4, color: 'var(--app-danger)', fontSize: 12 }}>{errors[repository.id]}</span> : null}
              </div>
              <Button type="button" variant="basic" onClick={() => void handleLocate(repository)} disabled={pendingId !== null}>
                <FolderOpen size={15} />
                {pendingId === repository.id ? 'Locating...' : 'Locate'}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {hasDiagnostics ? (
        <section aria-labelledby="import-recovery-diagnostics" style={{ display: 'grid', gap: 8, marginTop: visibleRepositories.length > 0 ? 18 : 0 }}>
          <h4 id="import-recovery-diagnostics" style={{ margin: 0, color: 'var(--app-text)', fontSize: 14 }}>Import diagnostics</h4>
          {skippedLayoutRecords > 0 ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--app-muted)', fontSize: 12 }}>
              <WarningCircle size={16} weight="fill" color="var(--app-warning)" />
              <span>{skippedLayoutRecords} layout record{skippedLayoutRecords === 1 ? '' : 's'} could not be restored because a repository was unavailable.</span>
            </div>
          ) : null}
          {conflicts.map((conflict, index) => (
            <div key={`${index}-${conflict}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--app-muted)', fontSize: 12 }}>
              <WarningCircle size={16} weight="fill" color="var(--app-warning)" />
              <span>{conflict}</span>
            </div>
          ))}
        </section>
      ) : null}

      {visibleRepositories.length === 0 && !hasDiagnostics ? (
        <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 13 }}>All imported application data was restored.</p>
      ) : null}
    </RepositoryModalShell>
  );
}