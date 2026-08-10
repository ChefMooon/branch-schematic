import { useCallback, useState } from 'react';
import { detectEditors, launchEditor, launchFileExplorer, launchTerminal, resolveDefaultEditor } from '../repositoryOpenApi';

export type RepositoryOpenActions = {
  isOpenWithOpen: boolean;
  openDefaultApplication: () => Promise<void>;
  openFileExplorer: () => Promise<void>;
  openTerminal: () => Promise<void>;
  openWith: () => void;
  closeOpenWith: () => void;
  detectEditors: typeof detectEditors;
};

export function useRepositoryOpenActions(repositoryPath: string): RepositoryOpenActions {
  const [isOpenWithOpen, setIsOpenWithOpen] = useState(false);

  const openDefaultApplicationAction = useCallback(async () => {
    const target = await resolveDefaultEditor(repositoryPath);
    await launchEditor(target.editor.executablePath, repositoryPath, target.targetPath);
  }, [repositoryPath]);
  const openTerminalAction = useCallback(() => launchTerminal(repositoryPath), [repositoryPath]);
  const openFileExplorerAction = useCallback(() => launchFileExplorer(repositoryPath), [repositoryPath]);
  const openWithAction = useCallback(() => setIsOpenWithOpen(true), []);
  const closeOpenWithAction = useCallback(() => setIsOpenWithOpen(false), []);

  return {
    isOpenWithOpen,
    openDefaultApplication: openDefaultApplicationAction,
    openFileExplorer: openFileExplorerAction,
    openTerminal: openTerminalAction,
    openWith: openWithAction,
    closeOpenWith: closeOpenWithAction,
    detectEditors,
  };
}
