import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

export async function openAppDatabase() {
  const dbPath = await invoke<string>('get_database_path');
  return Database.load(`sqlite:${dbPath}`);
}
