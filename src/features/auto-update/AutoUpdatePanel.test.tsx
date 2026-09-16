import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoUpdatePanel } from './AutoUpdatePanel';
import { UpdateCoordinator } from './coordinator';
import type { NativeUpdate, UpdateApi } from './types';

function createUpdate(): NativeUpdate {
  return {
    currentVersion: '0.1.0',
    version: '0.2.0',
    date: '2026-09-15T12:00:00Z',
    body: 'Improved update controls.',
    rawJson: {},
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

function createApi(update: NativeUpdate, supported = true): UpdateApi {
  return {
    isSupported: () => supported,
    getCurrentVersion: vi.fn(async () => '0.1.0'),
    check: vi.fn(async () => update),
    relaunch: vi.fn(async () => undefined),
  };
}

describe('AutoUpdatePanel', () => {
  it('exposes status and progressbar semantics for an available update', async () => {
    const coordinator = new UpdateCoordinator(createApi(createUpdate()));
    render(<AutoUpdatePanel coordinator={coordinator} />);

    await act(async () => {
      await coordinator.check();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Update available');
    expect(screen.getByRole('button', { name: /Download update/i })).toBeEnabled();

    await act(async () => {
      await coordinator.download(true);
    });

    expect(screen.getByRole('progressbar', { name: 'Update download progress' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('button', { name: /Install update/i })).toBeEnabled();
  });

  it('disables check actions while checking and reports preview mode honestly', async () => {
    const update = createUpdate();
    let resolveCheck: ((value: NativeUpdate) => void) | undefined;
    const api = createApi(update);
    api.check = vi.fn(() => new Promise<NativeUpdate>((resolve) => { resolveCheck = resolve; }));
    const coordinator = new UpdateCoordinator(api);
    render(<AutoUpdatePanel coordinator={coordinator} />);

    act(() => {
      void coordinator.check();
    });
    expect(screen.getByRole('button', { name: /Check for updates/i })).toBeDisabled();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      resolveCheck?.(update);
      await coordinator.check();
    });

    const previewCoordinator = new UpdateCoordinator(createApi(createUpdate(), false));
    render(<AutoUpdatePanel coordinator={previewCoordinator} />);
    await act(async () => {
      await previewCoordinator.check();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses[statuses.length - 1]).toHaveTextContent('browser preview');
  });

  it('requires an explicit restart confirmation after installation', async () => {
    const update = createUpdate();
    const coordinator = new UpdateCoordinator(createApi(update));
    render(<AutoUpdatePanel coordinator={coordinator} />);

    await act(async () => {
      await coordinator.check();
    });
    await act(async () => {
      await coordinator.download(true);
    });
    await act(async () => {
      await coordinator.install(true);
    });
    fireEvent.click(screen.getByRole('button', { name: /Restart to finish/i }));

    expect(screen.getByRole('dialog', { name: 'Restart to finish update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart now' })).toBeEnabled();
  });
});
