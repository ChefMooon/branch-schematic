import { openAppDatabase } from './lib/db';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME: ThemePreference = 'system';
export const THEME_PREFERENCE_CACHE_KEY = 'branch-schematic.theme-preference';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readCachedThemePreference(): ThemePreference | null {
  try {
    const cachedTheme = window.localStorage.getItem(THEME_PREFERENCE_CACHE_KEY);
    return isThemePreference(cachedTheme) ? cachedTheme : null;
  } catch {
    return null;
  }
}

export function writeCachedThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_PREFERENCE_CACHE_KEY, preference);
  } catch {
  }
}

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
  document.documentElement.style.backgroundColor = resolvedTheme === 'dark' ? '#1f1f1f' : '#f6f6f6';
  return resolvedTheme;
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const db = await openAppDatabase();
    const rows: Array<{ theme?: string | null }> = await db.select('SELECT theme FROM settings WHERE id = 1');
    const savedTheme = rows[0]?.theme;

    if (isThemePreference(savedTheme)) {
      writeCachedThemePreference(savedTheme);
      return savedTheme;
    }
  } catch (error) {
    console.error('Failed to load theme preference:', error);
  }

  return readCachedThemePreference() ?? DEFAULT_THEME;
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  writeCachedThemePreference(preference);
  try {
    const db = await openAppDatabase();
    await db.execute('UPDATE settings SET theme = ? WHERE id = 1', [preference]);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}
