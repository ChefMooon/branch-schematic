import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { applyTheme, DEFAULT_THEME, loadThemePreference, saveThemePreference, type ThemePreference } from '../theme';
import { openAppDatabase } from '../lib/db';

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
};

function RouteComponent() {
  const [hideToTray, setHideToTray] = useState(DEFAULT_SETTINGS.hideToTray);
  const [restoreWindow, setRestoreWindow] = useState(DEFAULT_SETTINGS.restoreWindow);
  const [launchAtLogin, setLaunchAtLogin] = useState(DEFAULT_SETTINGS.launchAtLogin);
  const [startMinimized, setStartMinimized] = useState(DEFAULT_SETTINGS.startMinimized);
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_SETTINGS.theme);

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
      // Execute standard SQL UPDATE command
      await db.execute(
        `UPDATE settings SET ${columnName} = ? WHERE id = 1`,
        [value]
      );
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
    applyTheme(DEFAULT_SETTINGS.theme);
    await saveThemePreference(DEFAULT_SETTINGS.theme);

    try {
      const db = await openAppDatabase();
      // Overwrite row 1 back to original factory parameters
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
    } catch (err) {
      console.error("Failed to reset database settings:", err);
    }
  }

  return (
    <div className="settings-container">
      <h2 className="settings-title">App Settings</h2>

      {/* Group 1: General Settings */}
      <div className="settings-group">
        <h3 className="group-heading">General</h3>
        <div className="settings-list">
          <label className="settings-item">
            <input 
              type="checkbox" 
              checked={hideToTray} 
              onChange={(e) => {
                setHideToTray(e.target.checked);
                updateSetting('hide_to_tray', e.target.checked ? 1 : 0);
              }} 
            />
            <div className="settings-text">
              <span className="settings-label">Hide to tray when closing window</span>
              <span className="settings-description">Keep the app running in the background when closed.</span>
            </div>
          </label>

          <label className="settings-item">
            <input 
              type="checkbox" 
              checked={restoreWindow} 
              onChange={(e) => {
                setRestoreWindow(e.target.checked);
                updateSetting('restore_window', e.target.checked ? 1 : 0);
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
                updateSetting('launch_at_login', e.target.checked ? 1 : 0);
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
                updateSetting('start_minimized', e.target.checked ? 1 : 0);
              }} 
            />
            <div className="settings-text">
              <span className="settings-label">Start app minimized</span>
              <span className="settings-description">Launch the app silently in the background or tray.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Group 2: Appearance Settings */}
      <div className="settings-group">
        <h3 className="group-heading">Appearance</h3>
        <div className="theme-row">
          <span className="settings-label">App Theme</span>
          <div className="segmented-control">
            {/* System */}
            <label className={`segment-button ${theme === 'system' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'system'} onChange={() => {
                const nextTheme: ThemePreference = 'system';
                setTheme(nextTheme);
                applyTheme(nextTheme);
                updateSetting('theme', nextTheme);
                saveThemePreference(nextTheme);
              }} />
              System
            </label>
            {/* Light */}
            <label className={`segment-button ${theme === 'light' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'light'} onChange={() => {
                const nextTheme: ThemePreference = 'light';
                setTheme(nextTheme);
                applyTheme(nextTheme);
                updateSetting('theme', nextTheme);
                saveThemePreference(nextTheme);
              }} />
              Light
            </label>
            {/* Dark */}
            <label className={`segment-button ${theme === 'dark' ? 'active' : ''}`}>
              <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => {
                const nextTheme: ThemePreference = 'dark';
                setTheme(nextTheme);
                applyTheme(nextTheme);
                updateSetting('theme', nextTheme);
                saveThemePreference(nextTheme);
              }} />
              Dark
            </label>
          </div>
        </div>
      </div>

      {/* NEW: Action Footer Container with Reset Button */}
      <div className="settings-footer">
        <button className="btn-reset" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>

    </div>
  );
}