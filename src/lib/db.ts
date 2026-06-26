import Database from '@tauri-apps/plugin-sql';
import { appDataDir, join } from '@tauri-apps/api/path';

export async function openAppDatabase() {
  const appData = await appDataDir();
  const dbPath = await join(appData, 'branch-schematic.db');
  return Database.load(`sqlite:${dbPath}`);
}
