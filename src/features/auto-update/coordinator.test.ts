import { describe, expect, it, vi } from 'vitest';
import { UpdateCoordinator } from './coordinator';
import type { NativeUpdate, UpdateApi } from './types';

function createUpdate(version = '0.2.0'): NativeUpdate & { download: ReturnType<typeof vi.fn>; install: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } {
  return {
    currentVersion: '0.1.0',
    version,
    date: '2026-09-15T12:00:00Z',
    body: 'Bug fixes',
    rawJson: { releaseUrl: 'https://example.com/release' },
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

function createApi(overrides: Partial<UpdateApi> = {}): UpdateApi {
  return {
    isSupported: () => true,
    getCurrentVersion: vi.fn(async () => '0.1.0'),
    check: vi.fn(async () => createUpdate()),
    relaunch: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('UpdateCoordinator', () => {
  it('checks metadata without downloading installer bytes', async () => {
    const update = createUpdate();
    const api = createApi({ check: vi.fn(async () => update) });
    const coordinator = new UpdateCoordinator(api);

    await coordinator.check();

    expect(api.check).toHaveBeenCalledOnce();
    expect(update.download).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().status).toBe('available');
    expect(coordinator.getSnapshot().metadata?.releaseUrl).toBe('https://example.com/release');
  });

  it('requires consent for download and install, and uses explicit no-restart installation', async () => {
    const update = createUpdate();
    const coordinator = new UpdateCoordinator(createApi({ check: vi.fn(async () => update) }));

    await coordinator.check();
    expect(await coordinator.download()).toBe(false);
    expect(update.download).not.toHaveBeenCalled();

    expect(await coordinator.download(true)).toBe(true);
    expect(await coordinator.install()).toBe(false);
    expect(await coordinator.install(true)).toBe(true);
    expect(update.install).toHaveBeenCalledWith({ restartAfterInstall: false });
  });

  it('keeps progress monotonic when native events arrive out of order', async () => {
    const update = createUpdate();
    update.download.mockImplementation(async (onEvent: Parameters<NativeUpdate['download']>[0]) => {
      onEvent?.({ event: 'Started', data: { contentLength: 100 } });
      onEvent?.({ event: 'Progress', data: { chunkLength: 60 } });
      onEvent?.({ event: 'Progress', data: { chunkLength: -10 } });
      onEvent?.({ event: 'Progress', data: { chunkLength: 25 } });
      onEvent?.({ event: 'Finished' });
    });
    const coordinator = new UpdateCoordinator(createApi({ check: vi.fn(async () => update) }));
    const percentages: number[] = [];
    coordinator.subscribe(() => percentages.push(coordinator.getSnapshot().progress.percent));

    await coordinator.check();
    await coordinator.download(true);

    expect(percentages).toEqual(expect.arrayContaining([60, 85, 100]));
    expect(percentages.every((value, index) => index === 0 || value >= percentages[index - 1])).toBe(true);
  });

  it('guards duplicate downloads and duplicate checks', async () => {
    const update = createUpdate();
    let resolveDownload: (() => void) | undefined;
    update.download.mockImplementation(() => new Promise<void>((resolve) => { resolveDownload = resolve; }));
    let resolveCheck: ((value: NativeUpdate) => void) | undefined;
    const api = createApi({
      check: vi.fn(() => new Promise<NativeUpdate>((resolve) => { resolveCheck = resolve; })),
    });
    const coordinator = new UpdateCoordinator(api);

    const firstCheck = coordinator.check();
    const secondCheck = coordinator.check();
    expect(firstCheck).toBe(secondCheck);
    await Promise.resolve();
    await Promise.resolve();
    resolveCheck?.(update);
    await firstCheck;

    const firstDownload = coordinator.download(true);
    const secondDownload = coordinator.download(true);
    expect(await secondDownload).toBe(false);
    resolveDownload?.();
    await firstDownload;
    expect(update.download).toHaveBeenCalledOnce();
  });

  it('invalidates a deferred update object before a later manual check', async () => {
    const firstUpdate = createUpdate('0.2.0');
    const secondUpdate = createUpdate('0.3.0');
    const api = createApi({ check: vi.fn()
      .mockResolvedValueOnce(firstUpdate)
      .mockResolvedValueOnce(secondUpdate) });
    const coordinator = new UpdateCoordinator(api);

    await coordinator.check({ startup: true });
    expect(coordinator.defer()).toBe(true);
    expect(firstUpdate.close).toHaveBeenCalledOnce();
    expect(await coordinator.install(true)).toBe(false);

    await coordinator.check();
    expect(coordinator.getSnapshot().metadata?.availableVersion).toBe('0.3.0');
    expect(await coordinator.download(true)).toBe(true);
    expect(secondUpdate.download).toHaveBeenCalledOnce();
  });

  it('suppresses only the deferred version during a startup check', async () => {
    const update = createUpdate('0.2.0');
    const api = createApi({ check: vi.fn(async () => update) });
    const coordinator = new UpdateCoordinator(api);

    await coordinator.check({ startup: true });
    coordinator.defer();
    await coordinator.check({ startup: true });
    expect(coordinator.getSnapshot().status).toBe('deferred');

    await coordinator.check();
    expect(coordinator.getSnapshot().status).toBe('available');
  });

  it('returns retryable offline failures and recovers on retry', async () => {
    const update = createUpdate();
    const api = createApi({ check: vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(update) });
    const coordinator = new UpdateCoordinator(api);

    await coordinator.check();
    expect(coordinator.getSnapshot().status).toBe('offline');
    await coordinator.retry();
    expect(coordinator.getSnapshot().status).toBe('available');
  });

  it('requires explicit restart confirmation', async () => {
    const update = createUpdate();
    const relaunch = vi.fn(async () => undefined);
    const coordinator = new UpdateCoordinator(createApi({ check: vi.fn(async () => update), relaunch }));

    await coordinator.check();
    await coordinator.download(true);
    await coordinator.install(true);
    expect(await coordinator.relaunch()).toBe(false);
    expect(relaunch).not.toHaveBeenCalled();
    expect(await coordinator.relaunch(true)).toBe(true);
    expect(relaunch).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot().status).toBe('restarting');
  });

  it('reports unsupported preview runtime honestly', async () => {
    const api = createApi({ isSupported: () => false });
    const coordinator = new UpdateCoordinator(api);

    await coordinator.check();

    expect(api.check).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().runtime).toBe('unsupported');
    expect(coordinator.getSnapshot().status).toBe('offline');
    expect(coordinator.getSnapshot().error).toContain('browser preview');
  });
});
