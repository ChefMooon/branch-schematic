import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import type { NativeDownloadEvent, NativeUpdate, UpdateApi } from './types';

function isTauriRuntime(): boolean {
  return !import.meta.env.DEV && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function mapDownloadEvent(event: DownloadEvent): NativeDownloadEvent {
  if (event.event === 'Started') {
    return { event: 'Started', data: { contentLength: event.data.contentLength } };
  }

  if (event.event === 'Progress') {
    return { event: 'Progress', data: { chunkLength: event.data.chunkLength } };
  }

  return { event: 'Finished' };
}

export function createDefaultUpdateApi(): UpdateApi {
  return {
    isSupported: isTauriRuntime,
    getCurrentVersion: async () => {
      if (!isTauriRuntime()) return null;
      return getVersion();
    },
    check: async () => {
      const update = await check();
      if (!update) return null;

      const nativeUpdate: NativeUpdate = {
        currentVersion: update.currentVersion,
        version: update.version,
        date: update.date,
        body: update.body,
        rawJson: update.rawJson,
        download: async (onEvent) => {
          await update.download((event) => onEvent?.(mapDownloadEvent(event)));
        },
        install: (options) => update.install(options),
        close: () => update.close(),
      };
      return nativeUpdate;
    },
    relaunch,
  };
}
