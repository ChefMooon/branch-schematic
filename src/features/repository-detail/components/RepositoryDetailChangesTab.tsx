import { useEffect, useMemo, useState } from 'react';
import { ResizeDivider } from '../../../components/resize-divider/ResizeDivider';
import { useResizablePanels, type ResizablePanelConfig } from '../../../hooks/useResizablePanels';
import type { TrackedPath } from '../../../types/git';
import { useRepositoryChanges } from '../hooks/useRepositoryChanges';
import { useRepositoryFileDiff } from '../hooks/useRepositoryFileDiff';
import { groupChanges, type ChangeGroupKey } from '../types/repositoryChanges';
import { RepositoryChangesListPanel } from './RepositoryChangesListPanel';
import { RepositoryChangesPreviewPanel } from './RepositoryChangesPreviewPanel';
import { RepositoryCommitComposer } from './RepositoryCommitComposer';

interface RepositoryDetailChangesTabProps {
  repo: TrackedPath | null;
  persistedPanelRatios?: Record<string, number>;
  onPersistPanelRatios?: (ratios: Record<string, number>) => void;
}

const CHANGES_PANEL_CONFIGS: ResizablePanelConfig[] = [
  { id: 'changes', defaultRatio: 0.28, minRatio: 0.28, maxRatio: 0.72 },
];

const KEYBOARD_NUDGE_STEP = 0.01;

export function RepositoryDetailChangesTab({
  repo,
  persistedPanelRatios,
  onPersistPanelRatios,
}: RepositoryDetailChangesTabProps) {
  const {
    snapshot,
    latestCommit,
    selectedPath,
    setSelectedPath,
    isLoading,
    isRefreshing,
    isBusy,
    isUndoing,
    error,
    statusMessage,
    lastVerifiedAt,
    loadChanges,
    runAction,
    undoLatestCommit,
  } = useRepositoryChanges(repo);
  const {
    registerContainer,
    ratios,
    startResize,
    resizeBy,
    getEffectiveBounds,
  } = useResizablePanels(CHANGES_PANEL_CONFIGS, {
    initialRatios: persistedPanelRatios,
    onRatiosCommit: onPersistPanelRatios,
  });
  const changesBounds = getEffectiveBounds('changes');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [expandedGroups, setExpandedGroups] = useState<Record<ChangeGroupKey, boolean>>({
    staged: true,
    changes: true,
    untracked: true,
    conflicts: true,
  });

  useEffect(() => {
    setTitle('');
    setBody('');
  }, [repo?.id, repo?.absolute_path]);

  const groupedChanges = useMemo(() => groupChanges(snapshot?.entries), [snapshot]);

  const selectedEntry = useMemo(() => {
    return snapshot?.entries.find((entry) => entry.path === selectedPath) ?? null;
  }, [selectedPath, snapshot]);
  const { fileDiff, isDiffLoading, diffError, clearFileDiff } = useRepositoryFileDiff(repo?.absolute_path, selectedEntry);

  const stagedCount = groupedChanges.staged.length;
  const unstagedCount = groupedChanges.changes.length + groupedChanges.untracked.length;

  const handleAction = async (action: 'stage' | 'unstage' | 'commit', paths?: string[]) => {
    clearFileDiff();
    const wasSuccessful = await runAction(action, paths, action === 'commit' ? { title, body } : undefined);
    if (wasSuccessful && action === 'commit') {
      setTitle('');
      setBody('');
    }
  };

  const handleGroupToggle = (group: ChangeGroupKey) => {
    setExpandedGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  return (
    <section className="repository-view-changes-tab" aria-label="Repository changes">
      <div className="repository-view-changes-shell" ref={registerContainer('changes')}>
        <RepositoryChangesListPanel
          repo={repo}
          splitRatio={ratios.changes}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isBusy={isBusy}
          error={error}
          snapshot={snapshot}
          statusMessage={statusMessage}
          lastVerifiedAt={lastVerifiedAt}
          groupedChanges={groupedChanges}
          expandedGroups={expandedGroups}
          selectedEntry={selectedEntry}
          onToggleGroup={handleGroupToggle}
          onSelectPath={setSelectedPath}
          onStage={(paths) => void handleAction('stage', paths)}
          onUnstage={(paths) => void handleAction('unstage', paths)}
          onRefresh={() => void loadChanges()}
        >
          <RepositoryCommitComposer
            title={title}
            body={body}
            stagedCount={stagedCount}
            unstagedCount={unstagedCount}
            isBusy={isBusy}
            latestCommit={latestCommit}
            isUndoing={isUndoing}
            onTitleChange={setTitle}
            onBodyChange={setBody}
            onCommit={() => void handleAction('commit')}
            onUndo={() => void undoLatestCommit()}
          />
        </RepositoryChangesListPanel>

        <ResizeDivider
          label="Resize changes panels"
          ratio={ratios.changes}
          minRatio={changesBounds.min}
          maxRatio={changesBounds.max}
          onResizeStart={startResize('changes')}
          onNudge={(direction) => resizeBy('changes', direction * KEYBOARD_NUDGE_STEP)}
          className="repository-view-changes-divider"
        />

        <RepositoryChangesPreviewPanel
          selectedEntry={selectedEntry}
          fileDiff={fileDiff}
          isDiffLoading={isDiffLoading}
          diffError={diffError}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((current) => (current === 'unified' ? 'split' : 'unified'))}
        />
      </div>
    </section>
  );
}
