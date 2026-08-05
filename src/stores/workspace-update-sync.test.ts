import { beforeEach, describe, expect, it, vi } from 'vitest';

const listenMock = vi.hoisted(() => vi.fn());
const invokeMock = vi.hoisted(() => vi.fn());
const hydrateWorkspaceNodesMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('./canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({ hydrateWorkspaceNodes: hydrateWorkspaceNodesMock }),
  },
}));

import { parseWorkspaceUpdatedEvent, useWorkspaceStore } from './workspace-store';

describe('workspace update synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue([]);
  });

  it('rejects malformed and oversized invalidation payloads', () => {
    expect(parseWorkspaceUpdatedEvent({ version: 2 })).toBeNull();
    expect(
      parseWorkspaceUpdatedEvent({
        version: 1,
        eventId: 'event',
        revision: 1,
        repositoryIds: Array.from({ length: 251 }, (_, index) => `repo-${index}`),
        triggerReason: 'filesystem',
        batchIndex: 0,
        batchCount: 2,
        emittedAt: new Date().toISOString(),
      }),
    ).toBeNull();
  });

  it('shares one listener and ignores duplicate repository revisions', async () => {
    let handler: ((event: { payload: unknown }) => void) | undefined;
    const unlisten = vi.fn();
    listenMock.mockImplementation(async (_eventName, nextHandler) => {
      handler = nextHandler;
      return unlisten;
    });

    const releaseFirst = await useWorkspaceStore.getState().subscribeToWorkspaceUpdates();
    const releaseSecond = await useWorkspaceStore.getState().subscribeToWorkspaceUpdates();

    expect(listenMock).toHaveBeenCalledTimes(1);
    const payload = {
      version: 1,
      eventId: 'event-1',
      revision: 1,
      repositoryIds: ['repo-1'],
      triggerReason: 'filesystem',
      batchIndex: 0,
      batchCount: 1,
      emittedAt: new Date().toISOString(),
    };
    handler?.({ payload });
    handler?.({ payload: { ...payload, eventId: 'event-duplicate' } });

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_tracked_workspaces');
    });
    expect(invokeMock.mock.calls.filter(([command]) => command === 'get_tracked_workspaces')).toHaveLength(1);
    expect(hydrateWorkspaceNodesMock).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(unlisten).not.toHaveBeenCalled();
    releaseSecond();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
