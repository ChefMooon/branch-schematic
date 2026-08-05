import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useRepositoryUpdateDiagnostics } from '../hooks/useRepositoryUpdateDiagnostics';
import type { RepositoryDebugEntry, RepositoryPriority } from '../types/repositoryUpdateDiagnostics';
import './RepositoryUpdateDiagnosticsModal.css';

type RepositoryUpdateDiagnosticsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Filter = 'all' | 'running' | 'degraded' | 'polling';

const priorityOrder: Record<RepositoryPriority, number> = {
  foreground: 0,
  visible: 1,
  background: 2,
};

function formatCapturedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleTimeString();
}

function repositoryState(entry: RepositoryDebugEntry) {
  if (entry.failureCount > 0) return 'degraded';
  if (entry.running) return entry.followUp ? 'follow-up' : 'running';
  return 'idle';
}

export function RepositoryUpdateDiagnosticsModal({ isOpen, onClose }: RepositoryUpdateDiagnosticsModalProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { snapshot, isLoading, error, refresh } = useRepositoryUpdateDiagnostics(isOpen);
  const repos = useWorkspaceStore((state) => state.repos);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const backdropDismiss = useBackdropDismiss(contentRef, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const repositoryNames = useMemo(
    () => new Map(repos.map((repo) => [repo.id, repo.alias_name || repo.display_name || repo.id])),
    [repos],
  );

  const filteredRepositories = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return [...(snapshot?.repositories ?? [])]
      .filter((entry) => {
        const name = repositoryNames.get(entry.repositoryId) ?? entry.repositoryId;
        const matchesSearch = !normalizedSearch || `${name} ${entry.repositoryId}`.toLocaleLowerCase().includes(normalizedSearch);
        const state = repositoryState(entry);
        const matchesFilter = filter === 'all' || state === filter || (filter === 'polling' && entry.monitorMode === 'polling');
        return matchesSearch && matchesFilter;
      })
      .sort((left, right) => {
        const degradedDelta = Number(right.failureCount > 0) - Number(left.failureCount > 0);
        if (degradedDelta !== 0) return degradedDelta;
        return priorityOrder[left.priority] - priorityOrder[right.priority] || left.repositoryId.localeCompare(right.repositoryId);
      });
  }, [filter, repositoryNames, search, snapshot]);

  if (!isOpen) return null;

  const diagnostics = snapshot?.diagnostics;

  return (
    <div
      className="repository-update-diagnostics-modal-backdrop"
      {...backdropDismiss}
      style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.52)' }}
    >
      <div ref={contentRef} className="repository-update-diagnostics-modal" role="dialog" aria-modal="true" aria-labelledby="repository-update-diagnostics-title">
        <div className="repository-update-diagnostics-modal__header">
          <div className="repository-update-diagnostics-modal__heading">
            <h2 id="repository-update-diagnostics-title">Repository Update Diagnostics</h2>
            <p>Manager-owned runtime priority and refresh state</p>
          </div>
          <div className="repository-update-diagnostics-modal__header-actions">
            <Button type="button" variant="basic" onClick={() => void refresh()} title="Refresh diagnostics" aria-label="Refresh diagnostics">
              <ArrowClockwiseIcon size={16} weight="bold" />
            </Button>
            <Button type="button" variant="close" onClick={onClose} title="Close" aria-label="Close diagnostics">
              <XIcon size={18} weight="bold" />
            </Button>
          </div>
        </div>

        {diagnostics && (
          <div className="repository-update-diagnostics-modal__summary">
            {[
              ['Active', diagnostics.activeEntries],
              ['Running', diagnostics.runningRefreshes],
              ['Watchers', diagnostics.watcherCount],
              ['Polling', diagnostics.pollingCount],
              ['Degraded', diagnostics.degradedEntries],
              ['Coalesced', diagnostics.coalescedRequests],
            ].map(([label, value]) => (
              <div className="repository-update-diagnostics-modal__metric" key={label}>
                <span className="repository-update-diagnostics-modal__metric-label">{label}</span>
                <span className="repository-update-diagnostics-modal__metric-value">{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="repository-update-diagnostics-modal__filters">
          <input className="repository-update-diagnostics-modal__search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repository or ID" aria-label="Search repository or ID" />
          <select className="repository-update-diagnostics-modal__select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="Filter diagnostics">
            <option value="all">All states</option>
            <option value="running">Running</option>
            <option value="degraded">Degraded</option>
            <option value="polling">Polling</option>
          </select>
        </div>

        {error && <div className="repository-update-diagnostics-modal__message">Unable to read diagnostics: {error}</div>}
        {!error && isLoading && !snapshot && <div className="repository-update-diagnostics-modal__message">Loading manager state...</div>}
        {!error && snapshot && filteredRepositories.length === 0 && <div className="repository-update-diagnostics-modal__message">No repositories match the current filter.</div>}
        {!error && snapshot && filteredRepositories.length > 0 && (
          <div className="repository-update-diagnostics-modal__table-wrap">
            <table className="repository-update-diagnostics-modal__table">
              <thead>
                <tr><th>Priority</th><th>Repository</th><th>Runtime</th><th>Monitor</th><th>Detail</th><th>Trigger</th><th>Failures</th><th>Generation</th></tr>
              </thead>
              <tbody>
                {filteredRepositories.map((entry) => {
                  const state = repositoryState(entry);
                  const name = repositoryNames.get(entry.repositoryId) ?? entry.repositoryId;
                  return (
                    <tr key={entry.repositoryId}>
                      <td><span className={`repository-update-diagnostics-modal__priority repository-update-diagnostics-modal__priority--${entry.priority}`}>{entry.priority}</span></td>
                      <td><div className="repository-update-diagnostics-modal__repository" title={name}>{name}</div><div className="repository-update-diagnostics-modal__repository-id">{entry.repositoryId}</div></td>
                      <td><span className={`repository-update-diagnostics-modal__status repository-update-diagnostics-modal__status--${state === 'degraded' ? 'degraded' : state === 'running' || state === 'follow-up' ? 'running' : ''}`}>{state}</span></td>
                      <td>{entry.monitorMode}</td>
                      <td>{entry.detailActive ? 'active' : 'idle'}</td>
                      <td className="repository-update-diagnostics-modal__muted">{entry.triggerReason || 'none'}</td>
                      <td>{entry.failureCount}</td>
                      <td>{entry.generation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="repository-update-diagnostics-modal__footer">
          {snapshot ? `Snapshot ${formatCapturedAt(snapshot.capturedAt)}` : 'Waiting for snapshot'}
          {isLoading && snapshot ? ' | Refreshing...' : ''}
        </div>
      </div>
    </div>
  );
}