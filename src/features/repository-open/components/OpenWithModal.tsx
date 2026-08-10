import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Spinner, X } from '@phosphor-icons/react';
import { Button } from '../../../components/button/Button';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import { launchEditor, resolveDefaultApplicationTarget } from '../repositoryOpenApi';
import type { EditorDescriptor } from '../types';

interface OpenWithModalProps {
  isOpen: boolean;
  repositoryPath: string;
  onClose: () => void;
  onError: (message: string) => void;
  detectEditors: () => Promise<EditorDescriptor[]>;
}

function dialogPath(result: string | string[] | null): string | null {
  if (typeof result === 'string' && result.trim()) return result;
  if (Array.isArray(result) && result.length > 0 && result[0].trim()) return result[0];
  return null;
}

export function OpenWithModal({ isOpen, repositoryPath, onClose, onError, detectEditors }: OpenWithModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [editors, setEditors] = useState<EditorDescriptor[]>([]);
  const [selectedEditorId, setSelectedEditorId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } = useBackdropDismiss(dialogRef, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    let cancelled = false;
    setEditors([]);
    setSelectedEditorId('');
    setLoadError(null);
    setIsLoading(true);
    void detectEditors()
      .then((nextEditors) => {
        if (cancelled) return;
        setEditors(nextEditors);
        setSelectedEditorId(nextEditors[0]?.id ?? '');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Editors could not be detected.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [detectEditors, isOpen, onClose]);

  if (!isOpen) return null;

  const selectedEditor = editors.find((editor) => editor.id === selectedEditorId) ?? null;

  const chooseExecutable = async () => {
    setIsBrowsing(true);
    try {
      const result = await open({ title: 'Choose an editor executable', multiple: false });
      const executablePath = dialogPath(result);
      if (executablePath) {
        const customEditor: EditorDescriptor = {
          id: `custom:${executablePath}`,
          label: executablePath.split(/[\\/]/).pop() ?? 'Custom editor',
          executablePath,
          folderSupport: 'Unknown',
          source: 'Path',
        };
        setEditors((current) => [...current.filter((editor) => editor.id !== customEditor.id), customEditor]);
        setSelectedEditorId(customEditor.id);
      }
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : 'The editor executable could not be selected.');
    } finally {
      setIsBrowsing(false);
    }
  };

  const chooseRepositoryFile = async () => {
    const result = await open({
      title: 'Choose a file in the repository',
      multiple: false,
      defaultPath: repositoryPath,
    });
    return dialogPath(result);
  };

  const launchSelectedEditor = async () => {
    if (!selectedEditor) return;
    setIsLoading(true);
    try {
      let targetPath: string | undefined;
      if (selectedEditor.folderSupport !== 'KnownSupported') {
        const defaultTarget = await resolveDefaultApplicationTarget(repositoryPath);
        targetPath = defaultTarget === repositoryPath ? (await chooseRepositoryFile() ?? undefined) : defaultTarget;
        if (!targetPath) return;
      }
      await launchEditor(selectedEditor.executablePath, repositoryPath, targetPath);
      onClose();
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : 'The editor could not be opened.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="repository-open-modal-overlay"
      onMouseDown={(event) => { event.stopPropagation(); handleMouseDown(event); }}
      onMouseUp={(event) => { event.stopPropagation(); handleMouseUp(event); }}
      onMouseLeave={(event) => { event.stopPropagation(); handleMouseLeave(); }}
      onTouchStart={(event) => { event.stopPropagation(); handleTouchStart(event); }}
      onTouchEnd={(event) => { event.stopPropagation(); handleTouchEnd(event); }}
    >
      <div ref={dialogRef} className="repository-open-modal" role="dialog" aria-modal="true" aria-labelledby="repository-open-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="repository-open-modal__header">
          <div>
            <h3 id="repository-open-modal-title">Open with...</h3>
            <p>Select an editor for this repository.</p>
          </div>
          <button ref={closeButtonRef} type="button" className="repository-open-modal__close" onClick={onClose} aria-label="Close Open with dialog" title="Close">
            <X size={18} weight="bold" color="var(--modal-text)" style={{ display: 'block' }} />
          </button>
        </div>

        <div className="repository-open-modal__body">
          {isLoading && editors.length === 0 ? (
            <div className="repository-open-modal__status" role="status"><Spinner className="repository-open-modal__spinner" size={18} /> Detecting editors...</div>
          ) : null}
          {loadError ? <div className="repository-open-modal__error" role="alert">{loadError}</div> : null}
          {!isLoading && editors.length === 0 && !loadError ? <div className="repository-open-modal__empty">No supported editors were detected.</div> : null}
          {editors.length > 0 ? (
            <label className="repository-open-modal__field">
              <span>Editor</span>
              <select value={selectedEditorId} onChange={(event) => setSelectedEditorId(event.target.value)} disabled={isLoading || isBrowsing}>
                {editors.map((editor) => <option key={editor.id} value={editor.id}>{editor.label}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="repository-open-modal__browse" onClick={() => { void chooseExecutable(); }} disabled={isLoading || isBrowsing}>
            <FolderOpen size={16} /> Browse for an executable
          </button>
        </div>

        <div className="repository-open-modal__actions">
          <Button type="button" variant="basic" onClick={onClose} disabled={isLoading && editors.length === 0}>Cancel</Button>
          <Button type="button" variant="submit" onClick={() => { void launchSelectedEditor(); }} disabled={!selectedEditor || isLoading || isBrowsing}>Open</Button>
        </div>
      </div>
    </div>
  );
}
