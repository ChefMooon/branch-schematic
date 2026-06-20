import Database from '@tauri-apps/plugin-sql';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME: ThemePreference = 'system';

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme = getSystemTheme()): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const db = await Database.load('sqlite:tauri-basic-template.db');
    const rows: Array<{ theme?: string | null }> = await db.select('SELECT theme FROM settings WHERE id = 1');
    const savedTheme = rows[0]?.theme;

    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      return savedTheme;
    }
  } catch (error) {
    console.error('Failed to load theme preference:', error);
  }

  return DEFAULT_THEME;
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    const db = await Database.load('sqlite:tauri-basic-template.db');
    await db.execute('UPDATE settings SET theme = ? WHERE id = 1', [preference]);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}
