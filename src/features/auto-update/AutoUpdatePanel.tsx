import { useState } from 'react';
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  InfoIcon,
  RocketLaunchIcon,
  WarningCircleIcon,
  WifiSlashIcon,
} from '@phosphor-icons/react';
import { ConfirmationModal } from '../../components/Modal/ConfirmationModal';
import { Button } from '../../components/button/Button';
import { useAutoUpdate } from './useAutoUpdate';
import type { UpdateCoordinator } from './coordinator';
import type { UpdateSnapshot, UpdateStatus } from './types';
import './auto-update.css';

const STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: 'Ready to check',
  checking: 'Checking for updates',
  'up-to-date': 'You are up to date',
  available: 'Update available',
  deferred: 'Update deferred for this session',
  downloading: 'Downloading update',
  installing: 'Installing update',
  'ready-to-restart': 'Ready to restart',
  restarting: 'Restarting application',
  offline: 'Updates unavailable right now',
  failed: 'Update check failed',
};

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString();
}

function statusIcon(snapshot: UpdateSnapshot) {
  if (snapshot.runtime === 'unsupported' || snapshot.status === 'offline') return <WifiSlashIcon size={20} aria-hidden="true" />;
  if (snapshot.status === 'failed') return <WarningCircleIcon size={20} aria-hidden="true" />;
  if (snapshot.status === 'up-to-date') return <CheckCircleIcon size={20} aria-hidden="true" />;
  if (snapshot.status === 'available' || snapshot.status === 'downloading' || snapshot.status === 'installing') {
    return <DownloadSimpleIcon size={20} aria-hidden="true" />;
  }
  if (snapshot.status === 'ready-to-restart' || snapshot.status === 'restarting') return <RocketLaunchIcon size={20} aria-hidden="true" />;
  return <InfoIcon size={20} aria-hidden="true" />;
}

function statusMessage(snapshot: UpdateSnapshot): string {
  if (snapshot.runtime === 'unsupported') return 'Updates are disabled in development and browser preview builds. Open a production desktop build to check for updates.';
  if (snapshot.error) return snapshot.error;
  if (snapshot.status === 'available' && snapshot.metadata) return `Version ${snapshot.metadata.availableVersion} is ready when you are.`;
  if (snapshot.status === 'deferred') return 'This version will remain available from this page. Startup reminders are paused until the app session ends.';
  if (snapshot.status === 'ready-to-restart') return 'The update is installed. Restart the application when you are ready to finish.';
  return STATUS_LABELS[snapshot.status];
}

export interface AutoUpdatePanelProps {
  coordinator?: UpdateCoordinator;
}

export function AutoUpdatePanel({ coordinator }: AutoUpdatePanelProps) {
  const { snapshot, coordinator: updateCoordinator } = useAutoUpdate(coordinator);
  const [isRestartConfirmationOpen, setIsRestartConfirmationOpen] = useState(false);
  const isBusy = snapshot.status === 'checking'
    || snapshot.status === 'downloading'
    || snapshot.status === 'installing'
    || snapshot.status === 'restarting';
  const canCheck = !isBusy && !snapshot.isDownloaded;
  const releaseDate = formatDate(snapshot.metadata?.releaseDate ?? null);

  return (
    <>
      <section className="auto-update-panel" aria-labelledby="auto-update-heading">
        <div className="auto-update-panel__header">
          <div>
            <p className="settings-kicker">Application</p>
            <h2 id="auto-update-heading" className="settings-title">Updates</h2>
            <p className="settings-subtitle">Check release metadata first, then choose when to download, install, and restart.</p>
          </div>
          <div className="auto-update-panel__status-icon" aria-hidden="true">{statusIcon(snapshot)}</div>
        </div>

        <div className={`auto-update-status auto-update-status--${snapshot.status}`} role={snapshot.status === 'failed' ? 'alert' : 'status'} aria-live="polite">
          <strong>{STATUS_LABELS[snapshot.status]}</strong>
          <span>{statusMessage(snapshot)}</span>
        </div>

        {snapshot.metadata ? (
          <dl className="auto-update-metadata">
            <div>
              <dt>Current version</dt>
              <dd>{snapshot.metadata.currentVersion ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Available version</dt>
              <dd>{snapshot.metadata.availableVersion}</dd>
            </div>
            {releaseDate ? (
              <div>
                <dt>Release date</dt>
                <dd>{releaseDate}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {snapshot.status === 'downloading' || snapshot.status === 'installing' || snapshot.isDownloaded ? (
          <div className="auto-update-progress-block">
            <div className="auto-update-progress-label">
              <span>{snapshot.status === 'installing' ? 'Installing' : snapshot.isDownloaded ? 'Download complete' : 'Download progress'}</span>
              <span>{Math.round(snapshot.progress.percent)}%</span>
            </div>
            <div
              className="auto-update-progress"
              role="progressbar"
              aria-label="Update download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(snapshot.progress.percent)}
            >
              <div style={{ width: `${snapshot.progress.percent}%` }} />
            </div>
          </div>
        ) : null}

        {snapshot.metadata?.releaseNotes ? (
          <div className="auto-update-notes">
            <h3>Release notes</h3>
            <p>{snapshot.metadata.releaseNotes}</p>
          </div>
        ) : null}

        {snapshot.metadata?.releaseUrl ? (
          <a className="auto-update-release-link" href={snapshot.metadata.releaseUrl} target="_blank" rel="noreferrer">
            View release details
          </a>
        ) : null}

        <div className="auto-update-actions">
          <Button type="button" variant="basic" onClick={() => void updateCoordinator.check()} disabled={!canCheck}>
            <ArrowClockwiseIcon size={16} aria-hidden="true" />
            Check for updates
          </Button>

          {snapshot.status === 'available' && !snapshot.isDownloaded ? (
            <>
              <Button type="button" variant="basic" onClick={() => updateCoordinator.defer()} disabled={isBusy}>
                Defer this version
              </Button>
              <Button type="button" variant="submit" onClick={() => void updateCoordinator.download(true)} disabled={isBusy}>
                <DownloadSimpleIcon size={16} aria-hidden="true" />
                Download update
              </Button>
            </>
          ) : null}

          {snapshot.status === 'available' && snapshot.isDownloaded ? (
            <Button type="button" variant="submit" onClick={() => void updateCoordinator.install(true)} disabled={isBusy}>
              Install update
            </Button>
          ) : null}

          {snapshot.status === 'ready-to-restart' ? (
            <Button type="button" variant="submit" onClick={() => setIsRestartConfirmationOpen(true)}>
              <RocketLaunchIcon size={16} aria-hidden="true" />
              Restart to finish
            </Button>
          ) : null}

          {(snapshot.status === 'failed' || snapshot.status === 'offline' || snapshot.status === 'deferred' || snapshot.status === 'up-to-date' || snapshot.status === 'idle') ? (
            <Button type="button" variant={snapshot.status === 'failed' ? 'submit' : 'basic'} onClick={() => void updateCoordinator.retry()} disabled={isBusy}>
              <ArrowClockwiseIcon size={16} aria-hidden="true" />
              {snapshot.status === 'failed' || snapshot.status === 'offline' ? 'Retry' : 'Check again'}
            </Button>
          ) : null}
        </div>

        {snapshot.lastCheckedAt ? <p className="auto-update-last-check">Last checked {formatDate(snapshot.lastCheckedAt)}</p> : null}
      </section>

      <ConfirmationModal
        isOpen={isRestartConfirmationOpen}
        title="Restart to finish update"
        message="The update has been installed. Restart Branch Schematic now to finish applying it?"
        confirmLabel="Restart now"
        cancelLabel="Later"
        isBusy={snapshot.status === 'restarting'}
        onCancel={() => setIsRestartConfirmationOpen(false)}
        onConfirm={async () => {
          const didRelaunch = await updateCoordinator.relaunch(true);
          if (didRelaunch) setIsRestartConfirmationOpen(false);
        }}
      />
    </>
  );
}
