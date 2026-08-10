import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowClockwiseIcon, ArchiveBoxIcon, PowerIcon, WarningIcon } from '@phosphor-icons/react';
import { Button } from '../button/Button';
import { ConfirmationModal } from '../Modal/ConfirmationModal';
import './DatabaseRecoveryGate.css';

const STARTUP_POLL_INTERVAL_MS = 100;
const MAX_STARTUP_POLLS = 30;

type DatabaseStartupInfo = {
  status: 'starting' | 'ready' | 'recovery_required';
  message: string | null;
  databasePath: string;
};

type DatabaseRecoveryGateProps = {
  children: React.ReactNode;
};

export function DatabaseRecoveryGate({ children }: DatabaseRecoveryGateProps) {
  const [startup, setStartup] = useState<DatabaseStartupInfo | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollCount = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    async function loadStartupState() {
      try {
        const nextStartup = await invoke<DatabaseStartupInfo>('get_database_startup_state');
        if (!isMounted) return;

        setStartup(nextStartup);
        if (nextStartup.status === 'starting' && pollCount < MAX_STARTUP_POLLS) {
          pollCount += 1;
          retryTimeout = setTimeout(() => void loadStartupState(), STARTUP_POLL_INTERVAL_MS);
        } else if (nextStartup.status === 'starting') {
          setStartupError('Database startup timed out.');
        }
      } catch (error) {
        if (isMounted) {
          setStartupError(String(error));
        }
      }
    }

    void loadStartupState();
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  if (!startup && !startupError) {
    return <div className="database-recovery-loading" aria-live="polite">Preparing database...</div>;
  }

  if (startup?.status === 'starting' && !startupError) {
    return <div className="database-recovery-loading" aria-live="polite">Preparing database...</div>;
  }

  if (startup?.status === 'ready') {
    return <>{children}</>;
  }

  const errorMessage = startup?.message ?? startupError ?? 'The database could not be prepared.';

  async function handleBackup() {
    setIsBusy(true);
    setActionMessage(null);
    try {
      const backupPath = await invoke<string>('backup_database');
      setActionMessage(`Backup created at ${backupPath}`);
    } catch (error) {
      setActionMessage(String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReset() {
    setIsBusy(true);
    setActionMessage(null);
    try {
      const message = await invoke<string>('reset_database');
      setActionMessage(message);
    } catch (error) {
      setActionMessage(String(error));
    } finally {
      setIsBusy(false);
      setIsResetConfirmationOpen(false);
    }
  }

  async function handleExit() {
    await invoke('exit_for_database_recovery');
  }

  return (
    <main className="database-recovery" aria-labelledby="database-recovery-title">
      <section className="database-recovery__panel">
        <div className="database-recovery__icon" aria-hidden="true">
          <WarningIcon weight="fill" size={30} />
        </div>
        <p className="database-recovery__eyebrow">Database recovery</p>
        <h1 id="database-recovery-title">The workspace database needs attention</h1>
        <p className="database-recovery__message">{errorMessage}</p>
        <p className="database-recovery__path">{startup?.databasePath ?? 'Database path unavailable'}</p>

        {actionMessage && (
          <p className="database-recovery__action-message" role="status">
            {actionMessage}
          </p>
        )}

        <div className="database-recovery__actions">
          <Button type="button" variant="basic" onClick={handleBackup} disabled={isBusy}>
            <ArchiveBoxIcon size={18} />
            Back up database
          </Button>
          <Button type="button" variant="danger" onClick={() => setIsResetConfirmationOpen(true)} disabled={isBusy}>
            <ArrowClockwiseIcon size={18} />
            Reset database
          </Button>
          <Button type="button" variant="close" onClick={handleExit} disabled={isBusy}>
            <PowerIcon size={18} />
            Exit
          </Button>
        </div>
      </section>

      <ConfirmationModal
        isOpen={isResetConfirmationOpen}
        title="Reset database?"
        message="The current database will be backed up first, then replaced with a blank database. Restart the app afterward to apply migrations."
        confirmLabel="Back up and reset"
        variant="danger"
        isBusy={isBusy}
        onConfirm={handleReset}
        onCancel={() => setIsResetConfirmationOpen(false)}
      />
    </main>
  );
}
