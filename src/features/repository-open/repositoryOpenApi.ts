import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import type { DefaultEditorTarget, EditorDescriptor, RepositoryOpenResult } from './types';

async function invokeRepositoryOpen<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const result = await invoke<RepositoryOpenResult<T>>(command, args);
  if (!result.success) {
    throw new Error(result.error?.message ?? 'The repository action failed.');
  }
  return result.data as T;
}

export function detectEditors() {
  return invokeRepositoryOpen<EditorDescriptor[]>('detect_repository_editors');
}

export function resolveDefaultApplicationTarget(repositoryPath: string) {
  return invokeRepositoryOpen<string>('resolve_default_application_target', { repositoryPath });
}

export function resolveDefaultEditor(repositoryPath: string) {
  return invokeRepositoryOpen<DefaultEditorTarget>('resolve_default_editor', { repositoryPath });
}

export function launchTerminal(repositoryPath: string) {
  return invokeRepositoryOpen<void>('launch_repository_terminal', { repositoryPath });
}

export function launchEditor(executablePath: string, repositoryPath: string, targetPath?: string) {
  return invokeRepositoryOpen<void>('launch_repository_editor', {
    request: { executablePath, repositoryPath, targetPath: targetPath ?? null },
  });
}

export function openDefaultApplication(targetPath: string) {
  return openPath(targetPath);
}
