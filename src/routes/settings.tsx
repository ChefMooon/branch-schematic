import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, type CSSProperties } from 'react';
import { Button } from '../components/button/Button';
import { applyTheme, DEFAULT_THEME, loadThemePreference, saveThemePreference, type ThemePreference } from '../theme';
import { openAppDatabase } from '../lib/db';
import { useOnboarding } from '../features/onboarding/hooks/useOnboarding';
import { useNotifications } from '../components/notifications/NotificationProvider';
import { ApplicationImportRecoveryModal, type ImportRecoveryRepository } from '../features/repository/components/ApplicationImportRecoveryModal';
import { AutoUpdatePanel } from '../features/auto-update/AutoUpdatePanel';

export const Route = createFileRoute('/settings')({
  component: RouteComponent,
});

// Option 1: Centralized Frontend Defaults
const DEFAULT_SETTINGS = {
  hideToTray: false,
  restoreWindow: true,
  launchAtLogin: false,
  startMinimized: false,
  theme: DEFAULT_THEME
  ,detailStatusRefreshInterval: 5
};

function RouteComponent() {
  const [hideToTray, setHideToTray] = useState(DEFAULT_SETTINGS.hideToTray);
  const [restoreWindow, setRestoreWindow] = useState(DEFAULT_SETTINGS.restoreWindow);
  const [launchAtLogin, setLaunchAtLogin] = useState(DEFAULT_SETTINGS.launchAtLogin);
  const [startMinimized, setStartMinimized] = useState(DEFAULT_SETTINGS.startMinimized);
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_SETTINGS.theme);
  const [detailStatusRefreshInterval, setDetailStatusRefreshInterval] = useState(DEFAULT_SETTINGS.detailStatusRefreshInterval);
  const { openReplay } = useOnboarding();
  const { addToast } = useNotifications();
  const [isTransferBusy, setIsTransferBusy] = useState(false);
  const [importRecovery, setImportRecovery] = useState<{
    repositories: ImportRecoveryRepository[];
    conflicts: string[];
    skippedLayoutRecords: number;
  } | null>(null);

  // 1. LOAD SETTINGS FROM DATABASE ON MOUNT
  useEffect(() => {
    async function loadSettings() {
      try {
        // Connect to our SQLite database file
        const db = await openAppDatabase();
        
        // Fetch our single row of settings
        const result: any[] = await db.select('SELECT * FROM settings WHERE id = 1');
        
        if (result.length > 0) {
          const saved = result[0];
          // Convert database integers (0 or 1) back into React booleans
          setHideToTray(saved.hide_to_tray === 1);
          setRestoreWindow(saved.restore_window === 1);
          setLaunchAtLogin(saved.launch_at_login === 1);
          setStartMinimized(saved.start_minimized === 1);
          const savedTheme = typeof saved.theme === 'string' && (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system')
            ? saved.theme
            : DEFAULT_SETTINGS.theme;
          setTheme(savedTheme);
          applyTheme(savedTheme);
        } else {
          applyTheme(DEFAULT_SETTINGS.theme);
        }
      } catch (err) {
        console.error("Failed to load settings from DB:", err);
      }
      const interval = await invoke<number>('get_detail_status_refresh_interval');
      setDetailStatusRefreshInterval(Math.min(5, Math.max(2, Number(interval) || 5)));
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function initializeTheme() {
      const savedTheme = await loadThemePreference();
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }

    initializeTheme();
  }, []);

  // 2. HELPER FUNCTION TO SAVE CHANGES TO DATABASE
  // This takes individual keys and updates them in the SQLite table
  async function updateSetting(columnName: string, value: any) {
    try {
      const db = await openAppDatabase();
      await db.execute(
        `UPDATE settings SET ${columnName} = ? WHERE id = 1`,
        [value]
      );
      await invoke('sync_runtime_settings_command');
    } catch (err) {
      console.error(`Failed to save ${columnName}:`, err);
    }
  }

  // 3. RESET TO DEFAULTS ACTION
  async function handleReset() {
    // Update frontend state immediately
    setHideToTray(DEFAULT_SETTINGS.hideToTray);
    setRestoreWindow(DEFAULT_SETTINGS.restoreWindow);
    setLaunchAtLogin(DEFAULT_SETTINGS.launchAtLogin);
    setStartMinimized(DEFAULT_SETTINGS.startMinimized);
    setTheme(DEFAULT_SETTINGS.theme);
    setDetailStatusRefreshInterval(DEFAULT_SETTINGS.detailStatusRefreshInterval);
    applyTheme(DEFAULT_SETTINGS.theme);
    await saveThemePreference(DEFAULT_SETTINGS.theme);

    try {
      const db = await openAppDatabase();
      await db.execute(
        `UPDATE settings SET 
          hide_to_tray = ?, 
          restore_window = ?, 
          launch_at_login = ?, 
          start_minimized = ?, 
          theme = ? 
         WHERE id = 1`,
        [
          DEFAULT_SETTINGS.hideToTray ? 1 : 0,
          DEFAULT_SETTINGS.restoreWindow ? 1 : 0,
          DEFAULT_SETTINGS.launchAtLogin ? 1 : 0,
          DEFAULT_SETTINGS.startMinimized ? 1 : 0,
          DEFAULT_SETTINGS.theme
        ]
      );
      await invoke('sync_runtime_settings_command');
      await invoke('set_detail_status_refresh_interval', { value: DEFAULT_SETTINGS.detailStatusRefreshInterval });
    } catch (err) {
      console.error('Failed to reset database settings:', err);
    }
  }

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    void updateSetting('theme', nextTheme);
    void saveThemePreference(nextTheme);
  }

  function handleDetailIntervalChange(value: number) {
    const nextValue = Math.min(5, Math.max(2, value));
    setDetailStatusRefreshInterval(nextValue);
    void invoke('set_detail_status_refresh_interval', { value: nextValue }).catch((err) => {
      console.error('Failed to save detail status refresh interval:', err);
    });
  }

  async function handleExport() {
    setIsTransferBusy(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = await save({
        defaultPath: `branch-schematic-backup-${timestamp}.json`,
        filters: [{ name: 'Branch Schematic application export', extensions: ['json'] }],
      });
      if (!path) return;
      await invoke('export_application_command', { path });
      addToast({ variant: 'success', title: 'Application export created', message: 'Your workspace and canvas layout were exported.' });
    } catch (error) {
      addToast({ variant: 'error', title: 'Export failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsTransferBusy(false);
    }
  }

  async function handleImport() {
    setIsTransferBusy(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Branch Schematic export', extensions: ['json'] }],
      });
      const path = typeof selected === 'string' ? selected : null;
      if (!path) return;
      const summary = await invoke<{
        importedRepositories: number;
        newRepositories: number;
        existingRepositories: number;
        restoredArchivedRepositories: number;
        importedViews: number;
        newViews: number;
        existingViews: number;
        skippedViews: number;
        unavailableRepositories: string[];
        unavailableRepositoryDetails: ImportRecoveryRepository[];
        skippedLayoutRecords: number;
        conflicts: string[];
      }>('import_application_command', { path });
      const unavailableCount = summary.unavailableRepositoryDetails.length || summary.unavailableRepositories.length;
      const unavailableMessage = unavailableCount > 0
        ? ` ${unavailableCount} repository path${unavailableCount === 1 ? '' : 's'} need relinking.`
        : '';
      const hasImportIssues = unavailableCount > 0 || summary.conflicts.length > 0 || summary.skippedLayoutRecords > 0;
      const repositoryBreakdown = `${summary.newRepositories} new, ${summary.existingRepositories} existing${summary.restoredArchivedRepositories > 0 ? `, ${summary.restoredArchivedRepositories} restored from Archive` : ''}`;
      const viewBreakdown = `${summary.newViews} new, ${summary.existingViews} existing${summary.skippedViews > 0 ? `, ${summary.skippedViews} archived skipped` : ''}`;
      const skippedLayoutMessage = summary.skippedLayoutRecords > 0
        ? ` ${summary.skippedLayoutRecords} layout record${summary.skippedLayoutRecords === 1 ? '' : 's'} skipped.`
        : '';
      addToast({
        variant: hasImportIssues ? 'warning' : 'success',
        title: 'Application imported',
        message: `${summary.importedRepositories} repositories processed (${repositoryBreakdown}); ${summary.importedViews} views processed (${viewBreakdown}).${unavailableMessage}${skippedLayoutMessage}${summary.conflicts.length > 0 ? ` ${summary.conflicts.length} import diagnostic${summary.conflicts.length === 1 ? '' : 's'} need review.` : ''}`,
      });
      if (hasImportIssues) {
        setImportRecovery({
          repositories: summary.unavailableRepositoryDetails,
          conflicts: summary.conflicts,
          skippedLayoutRecords: summary.skippedLayoutRecords,
        });
      }
      const importedTheme = await loadThemePreference();
      setTheme(importedTheme);
      applyTheme(importedTheme);
      const importedInterval = await invoke<number>('get_detail_status_refresh_interval');
      setDetailStatusRefreshInterval(Math.min(5, Math.max(2, Number(importedInterval) || 5)));
    } catch (error) {
      addToast({ variant: 'error', title: 'Import failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsTransferBusy(false);
    }
  }

  const detailStatusRefreshProgress = ((detailStatusRefreshInterval - 2) / 3) * 100;

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <p className="settings-kicker">Preferences</p>
        <h2 className="settings-title">App Settings</h2>
        <p className="settings-subtitle">Fine-tune the app experience to match the way you work.</p>
      </header>

      <section className="settings-card" aria-labelledby="general-settings-heading">
        <div className="settings-card-header">
          <h3 id="general-settings-heading" className="group-heading">General</h3>
        </div>
        <div className="settings-list">
          <label className="settings-item">
            <input
              type="checkbox"
              checked={hideToTray}
              onChange={(e) => {
                setHideToTray(e.target.checked);
                void updateSetting('hide_to_tray', e.target.checked ? 1 : 0);
              }}
            />
            <div className="settings-text">
              <span className="settings-label">Hide to tray when closing window</span>
              <span className="settings-description">Keep the app running in the background when closed.</span>
            </div>
          </label>

          <div className="settings-item settings-item-range">
            <div className="settings-text">
              <span className="settings-label">Detail status refresh interval</span>
              <span className="settings-description">How often the open repository view checks local working-tree status.</span>
            </div>
            <div className="settings-range-control">
              <input
                type="range"
                min="2"
                max="5"
                step="1"
                value={detailStatusRefreshInterval}
                style={{ '--range-progress': `${detailStatusRefreshProgress}%` } as CSSProperties}
                onChange={(event) => handleDetailIntervalChange(Number(event.target.value))}
                aria-label="Detail status refresh interval"
              />
              <output>{detailStatusRefreshInterval}s</output>
            </div>
          </div>

          <label className="settings-item">
            <input
              type="checkbox"
              checked={restoreWindow}
              onChange={(e) => {
                setRestoreWindow(e.target.checked);
                void updateSetting('restore_window', e.target.checked ? 1 : 0);
              }}
            />
            <div className="settings-text">
              <span className="settings-label">Restore last window size and position</span>
              <span className="settings-description">Remember where you left the app window.</span>
            </div>
          </label>

          <label className="settings-item">
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => {
                setLaunchAtLogin(e.target.checked);
                void updateSetting('launch_at_login', e.target.checked ? 1 : 0);
              }}
            />
            <div className="settings-text">
              <span className="settings-label">Launch at login</span>
              <span className="settings-description">Automatically start the app when you turn on your computer.</span>
            </div>
          </label>

          <label className="settings-item">
            <input
              type="checkbox"
              checked={startMinimized}
              onChange={(e) => {
                setStartMinimized(e.target.checked);
                void updateSetting('start_minimized', e.target.checked ? 1 : 0);
              }}
            />
            <div className="settings-text">
              <span className="settings-label">Start app minimized</span>
              <span className="settings-description">Launch the app silently in the background or tray.</span>
            </div>
          </label>
        </div>
      </section>

      <section className="settings-card" aria-labelledby="appearance-settings-heading">
        <div className="settings-card-header">
          <h3 id="appearance-settings-heading" className="group-heading">Appearance</h3>
        </div>
        <div className="theme-row">
          <span className="settings-label">App Theme</span>
          <div className="segmented-control" role="radiogroup" aria-label="App theme">
            <label className={`segment-button ${theme === 'system' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'system'} onChange={() => handleThemeChange('system')} />
              <span>System</span>
            </label>
            <label className={`segment-button ${theme === 'light' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'light'} onChange={() => handleThemeChange('light')} />
              <span>Light</span>
            </label>
            <label className={`segment-button ${theme === 'dark' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => handleThemeChange('dark')} />
              <span>Dark</span>
            </label>
          </div>
        </div>
      </section>

      <AutoUpdatePanel />

      <section className="settings-card" aria-labelledby="onboarding-settings-heading">
        <div className="settings-card-header">
          <h3 id="onboarding-settings-heading" className="group-heading">Getting started</h3>
        </div>
        <div className="settings-item">
          <div className="settings-text">
            <span className="settings-label">Onboarding guide</span>
            <span className="settings-description">Review the local-first workflow, profiles, and repository setup.</span>
          </div>
          <Button type="button" variant="basic" onClick={openReplay}>Replay onboarding</Button>
        </div>
      </section>

      <section className="settings-card" aria-labelledby="backup-transfer-heading">
        <div className="settings-card-header">
          <h3 id="backup-transfer-heading" className="group-heading">Backup &amp; Transfer</h3>
        </div>
        <div className="settings-item settings-transfer-item">
          <div className="settings-text">
            <span className="settings-label">Portable application export</span>
            <span className="settings-description">
              Save repository metadata, canvas layouts, theme, and refresh preferences as a JSON file. Git caches, tokens, and machine-specific settings are never exported.
            </span>
            <span className="settings-description settings-transfer-warning">
              Export files include local repository paths and remote URLs. Keep them private.
            </span>
          </div>
          <div className="settings-transfer-actions">
            <Button type="button" variant="basic" onClick={() => void handleImport()} disabled={isTransferBusy}>Import</Button>
            <Button type="button" variant="submit" onClick={() => void handleExport()} disabled={isTransferBusy}>Export</Button>
          </div>
        </div>
      </section>

      <div className="settings-footer">
        <Button type="button" variant="danger" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
      {importRecovery ? (
        <ApplicationImportRecoveryModal
          isOpen
          repositories={importRecovery.repositories}
          conflicts={importRecovery.conflicts}
          skippedLayoutRecords={importRecovery.skippedLayoutRecords}
          onClose={() => setImportRecovery(null)}
        />
      ) : null}
    </div>
  );
}