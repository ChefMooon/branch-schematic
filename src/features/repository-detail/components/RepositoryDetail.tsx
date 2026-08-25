import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { useBackdropDismiss } from '../../../hooks/useBackdropDismiss';
import type { TrackedPath } from '../../../types/git';
import { RepositoryDetailBody } from './RepositoryDetailBody';
import { RepositoryDetailHeader } from './RepositoryDetailHeader';
import './RepositoryDetail.css';

interface RepositoryDetailProps {
  isOpen: boolean;
  repo: TrackedPath | null;
  onClose: () => void;
}

export type CommitRecord = {
  commit_hash: string;
  author_name: string;
  commit_message: string;
  committed_at: string;
  signature_status: string | null;
  push_state?: 'pushed' | 'unpushed' | 'unknown' | null;
};

export function RepositoryDetail({ isOpen, repo, onClose }: RepositoryDetailProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { handleMouseDown, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchEnd } = useBackdropDismiss(dialogRef, onClose, isOpen);
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const selectedCommitHashRef = useRef<string | null>(null);
  const [commitsRefreshToken, setCommitsRefreshToken] = useState(0);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [previewBranch, setPreviewBranch] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'commits' | 'changes'>('commits');
  const [persistedPanelRatios, setPersistedPanelRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) return;
    setPersistedPanelRatios({});
  }, [isOpen]);

  useEffect(() => {
    selectedCommitHashRef.current = selectedCommitHash;
  }, [selectedCommitHash]);

  const handleHistoryChanged = useCallback(() => {
    setCommitsRefreshToken((token) => token + 1);
  }, []);

  const handlePersistPanelRatios = useCallback((ratios: Record<string, number>) => {
    setPersistedPanelRatios((current) => ({ ...current, ...ratios }));
  }, []);

  useEffect(() => {
    if (!isOpen || !repo) return;

    const nextBranch = repo.current_branch ?? 'main';
    setPreviewBranch(nextBranch);
    setSelectedCommitHash(null);
    setActiveTab('commits');
  }, [isOpen, repo?.id, repo?.current_branch]);

  useEffect(() => {
    if (!isOpen || !repo || !previewBranch) return;

    let isMounted = true;
    const branchId = `${repo.id}-${previewBranch}`;
    const previouslySelectedHash = selectedCommitHashRef.current;

    const loadCommits = async () => {
      setIsLoadingCommits(true);
      setSelectedCommitHash(null);
      try {
        const result = await invoke<CommitRecord[]>('get_branch_commits', {
          branchId,
          limit: 25,
        });
        if (!isMounted) return;

        setCommits(result ?? []);
        setSelectedCommitHash(
          previouslySelectedHash && result?.some((commit) => commit.commit_hash === previouslySelectedHash)
            ? previouslySelectedHash
            : result?.[0]?.commit_hash ?? null,
        );
      } catch (error) {
        console.error('Failed to load branch commits', error);
        if (isMounted) {
          setCommits([]);
          setSelectedCommitHash(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCommits(false);
        }
      }
    };

    void loadCommits();

    return () => {
      isMounted = false;
    };
  }, [isOpen, previewBranch, repo?.id, commitsRefreshToken]);

  useEffect(() => {
    if (!isOpen || !repo) return;

    let disposed = false;
    let detailSessionActive = false;
    const sessionId = `${repo.id}-${Date.now()}-${Math.random()}`;

    const activateDetailSession = async () => {
      await invoke('begin_repository_detail_session_command', {
        pathId: repo.id,
        absolutePath: repo.absolute_path,
        sessionId,
      });
      if (disposed) {
        await invoke('set_repository_detail_active_command', {
          pathId: repo.id,
          sessionId,
          active: false,
        });
        return;
      }
      detailSessionActive = true;
    };

    void activateDetailSession().catch((error) => {
      if (!disposed) console.error('Failed to promote repository detail refresh:', error);
    });

    return () => {
      disposed = true;
      if (!detailSessionActive) return;
      void Promise.resolve(
        invoke('set_repository_detail_active_command', {
          pathId: repo.id,
          sessionId,
          active: false,
        }),
      ).catch(() => undefined);
    };
  }, [isOpen, repo?.id, repo?.absolute_path]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleScrollLock = (event: Event) => {
      const target = event.target as Node | null;
      if (dialogRef.current?.contains(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleScrollLock, { passive: false });
    document.addEventListener('touchmove', handleScrollLock, { passive: false });
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleScrollLock);
      document.removeEventListener('touchmove', handleScrollLock);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [isOpen, onClose]);

  const selectedCommit = useMemo(() => {
    return commits.find((commit) => commit.commit_hash === selectedCommitHash) ?? commits[0] ?? null;
  }, [commits, selectedCommitHash]);

  if (!isOpen || !repo || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="repository-view-overlay"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="repository-view-title"
        className="repository-view-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <RepositoryDetailHeader
          repo={repo}
          activeBranch={repo.current_branch ?? 'main'}
          previewBranch={previewBranch ?? repo.current_branch ?? 'main'}
          onSelectPreviewBranch={setPreviewBranch}
          onClose={onClose}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onHistoryChanged={handleHistoryChanged}
        />

        <div className="repository-view-body">
          <RepositoryDetailBody
            repo={repo}
            commits={commits}
            selectedCommit={selectedCommit}
            isLoadingCommits={isLoadingCommits}
            activeBranch={repo.current_branch ?? 'main'}
            previewBranch={previewBranch ?? repo.current_branch ?? 'main'}
            onSelectCommit={setSelectedCommitHash}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            persistedPanelRatios={persistedPanelRatios}
            onPersistPanelRatios={handlePersistPanelRatios}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
