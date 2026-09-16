import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openAppDatabase } from './lib/db';
import {
  DEFAULT_THEME,
  THEME_PREFERENCE_CACHE_KEY,
  isThemePreference,
  loadThemePreference,
  readCachedThemePreference,
  resolveTheme,
  saveThemePreference,
  writeCachedThemePreference,
} from './theme';

vi.mock('./lib/db', () => ({
  openAppDatabase: vi.fn(),
}));

const openAppDatabaseMock = vi.mocked(openAppDatabase);

describe('theme preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    openAppDatabaseMock.mockReset();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });

  it('validates and resolves supported preferences', () => {
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('unknown')).toBe(false);
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('system', 'dark')).toBe('dark');
  });

  it('reads and writes the cached preference defensively', () => {
    expect(readCachedThemePreference()).toBeNull();

    writeCachedThemePreference('dark');

    expect(localStorage.getItem(THEME_PREFERENCE_CACHE_KEY)).toBe('dark');
    expect(readCachedThemePreference()).toBe('dark');
  });

  it('uses the database value as authority and refreshes the cache', async () => {
    writeCachedThemePreference('light');
    openAppDatabaseMock.mockResolvedValue({
      select: vi.fn().mockResolvedValue([{ theme: 'dark' }]),
    } as never);

    await expect(loadThemePreference()).resolves.toBe('dark');
    expect(readCachedThemePreference()).toBe('dark');
  });

  it('uses a valid cached preference when the database is unavailable', async () => {
    writeCachedThemePreference('dark');
    openAppDatabaseMock.mockRejectedValue(new Error('database unavailable'));

    await expect(loadThemePreference()).resolves.toBe('dark');
  });

  it('falls back to the system preference when cache and database are unavailable', async () => {
    openAppDatabaseMock.mockRejectedValue(new Error('database unavailable'));
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    await expect(loadThemePreference()).resolves.toBe(DEFAULT_THEME);
  });

  it('updates the cache before persisting a preference', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    openAppDatabaseMock.mockResolvedValue({ execute } as never);

    await saveThemePreference('dark');

    expect(readCachedThemePreference()).toBe('dark');
    expect(execute).toHaveBeenCalledWith('UPDATE settings SET theme = ? WHERE id = 1', ['dark']);
  });

  it('does not throw when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(readCachedThemePreference()).toBeNull();
    expect(() => writeCachedThemePreference('dark')).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
