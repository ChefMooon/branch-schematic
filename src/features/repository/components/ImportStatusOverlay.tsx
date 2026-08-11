import { useEffect, useRef, useState } from 'react';
import { CircleNotch, DownloadSimple, X } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { useImportStore } from '../stores/import-store';

export function ImportStatusOverlay() {
  const job = useImportStore((state) => state.job);
  const cancelImport = useImportStore((state) => state.cancelImport);
  const retryFailed = useImportStore((state) => state.retryFailed);
  const clearJob = useImportStore((state) => state.clearJob);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<string | null>(null);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } =
    useBackdropDismiss(contentRef, () => setIsExpanded(false), isExpanded);

  useEffect(() => {
    if (!job) {
      startedAtRef.current = null;
      setIsExpanded(false);
      return;
    }
    if (startedAtRef.current !== job.id) {
      startedAtRef.current = job.id;
      setIsExpanded(false);
      const timer = window.setTimeout(() => setIsExpanded(true), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [job]);

  if (!job) return null;

  const isRunning = job.status === 'running';
  const label = isRunning
    ? `${job.counts.completed} of ${job.counts.total} processed`
    : job.status === 'cancelled' ? 'Import cancelled' : 'Import complete';

  if (!isExpanded) {
    return (
      <button
        type="button"
        aria-label="Show import status"
        onClick={() => setIsExpanded(true)}
        style={activityStyle}
      >
        {isRunning ? <CircleNotch size={17} className="animate-spin-svg" /> : <DownloadSimple size={17} />}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div
      role="presentation"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={backdropStyle}
    >
      <div ref={contentRef} role="dialog" aria-label="Import status" style={panelStyle}>
        <div style={headerStyle}>
          <strong>{label}</strong>
          <Button type="button" variant="basic" aria-label="Hide import status" onClick={() => setIsExpanded(false)}>
            <X size={16} />
          </Button>
        </div>
        <p style={textStyle}>{job.currentPath ?? 'Repository import activity'}</p>
        <div style={progressTrackStyle}>
          <div style={{ ...progressStyle, width: `${job.counts.total ? (job.counts.completed / job.counts.total) * 100 : 0}%` }} />
        </div>
        <p style={textStyle}>
          {job.counts.remaining} remaining, {job.counts.added} added, {job.counts.skipped} skipped, {job.counts.failed} failed.
        </p>
        <div style={actionsStyle}>
          {isRunning ? <Button type="button" variant="basic" onClick={cancelImport}>Cancel remaining</Button> : null}
          {!isRunning && job.counts.failed > 0 ? <Button type="button" variant="basic" onClick={() => void retryFailed()}>Retry failed</Button> : null}
          {!isRunning ? <Button type="button" variant="basic" onClick={clearJob}>Dismiss</Button> : null}
        </div>
      </div>
    </div>
  );
}

const activityStyle: React.CSSProperties = { position: 'fixed', right: 16, bottom: 16, zIndex: 45, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--app-border)', borderRadius: 8, padding: '8px 10px', background: 'var(--app-surface)', color: 'var(--app-text)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 44, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.35)' };
const panelStyle: React.CSSProperties = { width: 'min(420px, 92vw)', border: '1px solid var(--app-border)', borderRadius: 10, padding: 16, background: 'var(--app-surface)', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const textStyle: React.CSSProperties = { margin: '10px 0', fontSize: 12, color: 'var(--app-muted)', overflowWrap: 'anywhere' };
const progressTrackStyle: React.CSSProperties = { height: 6, overflow: 'hidden', borderRadius: 4, background: 'var(--app-surface-muted)' };
const progressStyle: React.CSSProperties = { height: '100%', borderRadius: 4, background: 'var(--app-accent)', transition: 'width 180ms ease' };
const actionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' };
