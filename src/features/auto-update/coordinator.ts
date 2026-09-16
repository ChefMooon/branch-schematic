import { createDefaultUpdateApi } from './updaterApi';
import type {
  CheckOptions,
  NativeDownloadEvent,
  NativeUpdate,
  UpdateApi,
  UpdateMetadata,
  UpdateProgress,
  UpdateSnapshot,
} from './types';

const EMPTY_PROGRESS: UpdateProgress = {
  downloadedBytes: 0,
  totalBytes: null,
  percent: 0,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isOfflineError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return typeof navigator !== 'undefined' && navigator.onLine === false
    || /offline|network|fetch failed|connection|timed out|timeout/.test(message);
}

function releaseUrl(rawJson: Record<string, unknown> | undefined): string | null {
  const candidate = rawJson?.releaseUrl ?? rawJson?.release_url;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

function metadataFromUpdate(update: NativeUpdate, currentVersion: string | null): UpdateMetadata {
  return {
    currentVersion: currentVersion ?? update.currentVersion,
    availableVersion: update.version,
    releaseDate: update.date ?? null,
    releaseNotes: update.body ?? null,
    releaseUrl: releaseUrl(update.rawJson),
  };
}

export class UpdateCoordinator {
  private readonly api: UpdateApi;
  private readonly listeners = new Set<() => void>();
  private state: UpdateSnapshot;
  private activeUpdate: NativeUpdate | undefined;
  private operationToken = 0;
  private isDownloaded = false;
  private checkPromise: Promise<UpdateSnapshot> | null = null;
  private downloadPromise: Promise<boolean> | null = null;
  private installPromise: Promise<boolean> | null = null;
  private relaunchPromise: Promise<boolean> | null = null;

  constructor(api: UpdateApi = createDefaultUpdateApi()) {
    this.api = api;
    this.state = {
      runtime: api.isSupported() ? 'desktop' : 'unsupported',
      status: 'idle',
      metadata: null,
      progress: { ...EMPTY_PROGRESS },
      isDownloaded: false,
      deferredVersion: null,
      lastCheckedAt: null,
      error: null,
    };
  }

  getSnapshot = (): UpdateSnapshot => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  check(options: CheckOptions = {}): Promise<UpdateSnapshot> {
    if (this.checkPromise) return this.checkPromise;
    if (this.downloadPromise || this.installPromise || this.relaunchPromise) {
      return Promise.resolve(this.state);
    }

    this.invalidateActiveUpdate();
    const token = ++this.operationToken;
    this.setState({
      runtime: this.api.isSupported() ? 'desktop' : 'unsupported',
      status: 'checking',
      error: null,
      progress: { ...EMPTY_PROGRESS },
      isDownloaded: false,
    });

    const promise = this.performCheck(token, Boolean(options.startup));
    this.checkPromise = promise;
    void promise.then(
      () => {
        if (this.checkPromise === promise) this.checkPromise = null;
      },
      () => {
        if (this.checkPromise === promise) this.checkPromise = null;
      },
    );
    return promise;
  }

  defer(): boolean {
    if (this.state.status !== 'available' || !this.state.metadata) return false;

    const version = this.state.metadata.availableVersion;
    this.invalidateActiveUpdate();
    this.setState({
      status: 'deferred',
      deferredVersion: version,
      isDownloaded: false,
      progress: { ...EMPTY_PROGRESS },
      error: null,
    });
    return true;
  }

  retry(): Promise<UpdateSnapshot> {
    if (this.downloadPromise || this.installPromise || this.relaunchPromise) {
      return Promise.resolve(this.state);
    }

    this.invalidateActiveUpdate();
    this.setState({ status: 'idle', error: null, isDownloaded: false, progress: { ...EMPTY_PROGRESS } });
    return this.check();
  }

  download(consented = false): Promise<boolean> {
    if (!consented || this.state.status !== 'available' || !this.activeUpdate || this.isDownloaded) {
      return Promise.resolve(false);
    }
    if (this.downloadPromise) return this.downloadPromise;
    if (this.installPromise || this.relaunchPromise || this.checkPromise) return Promise.resolve(false);

    const update = this.activeUpdate;
    const token = this.operationToken;
    this.setState({ status: 'downloading', error: null, progress: { ...EMPTY_PROGRESS } });

    const promise = this.performDownload(update, token);
    this.downloadPromise = promise;
    void promise.then(
      () => {
        if (this.downloadPromise === promise) this.downloadPromise = null;
      },
      () => {
        if (this.downloadPromise === promise) this.downloadPromise = null;
      },
    );
    return promise;
  }

  install(consented = false): Promise<boolean> {
    if (!consented || this.state.status !== 'available' || !this.activeUpdate || !this.isDownloaded) {
      return Promise.resolve(false);
    }
    if (this.installPromise) return this.installPromise;
    if (this.downloadPromise || this.relaunchPromise || this.checkPromise) return Promise.resolve(false);

    const update = this.activeUpdate;
    const token = this.operationToken;
    this.setState({ status: 'installing', error: null });

    const promise = this.performInstall(update, token);
    this.installPromise = promise;
    void promise.then(
      () => {
        if (this.installPromise === promise) this.installPromise = null;
      },
      () => {
        if (this.installPromise === promise) this.installPromise = null;
      },
    );
    return promise;
  }

  relaunch(confirmed = false): Promise<boolean> {
    if (!confirmed || this.state.status !== 'ready-to-restart') return Promise.resolve(false);
    if (this.relaunchPromise) return this.relaunchPromise;
    if (this.downloadPromise || this.installPromise || this.checkPromise) return Promise.resolve(false);

    this.setState({ status: 'restarting', error: null });
    const promise = this.api.relaunch().then(
      () => true,
      (error: unknown) => {
        this.setState({ status: 'failed', error: errorMessage(error) });
        return false;
      },
    );
    this.relaunchPromise = promise;
    void promise.then(
      () => {
        if (this.relaunchPromise === promise) this.relaunchPromise = null;
      },
      () => {
        if (this.relaunchPromise === promise) this.relaunchPromise = null;
      },
    );
    return promise;
  }

  private async performCheck(token: number, startup: boolean): Promise<UpdateSnapshot> {
    if (!this.api.isSupported()) {
      const snapshot = this.setState({
        runtime: 'unsupported',
        status: 'offline',
        lastCheckedAt: new Date().toISOString(),
        error: 'Updates are unavailable in browser preview mode.',
      });
      return snapshot;
    }

    try {
      const currentVersion = await this.api.getCurrentVersion().catch(() => null);
      const update = await this.api.check();
      if (token !== this.operationToken) return this.state;

      const checkedAt = new Date().toISOString();
      if (!update) {
        return this.setState({
          runtime: 'desktop',
          status: 'up-to-date',
          metadata: currentVersion ? { currentVersion, availableVersion: currentVersion, releaseDate: null, releaseNotes: null, releaseUrl: null } : null,
          lastCheckedAt: checkedAt,
          error: null,
        });
      }

      const metadata = metadataFromUpdate(update, currentVersion);
      if (startup && this.state.deferredVersion === metadata.availableVersion) {
        this.activeUpdate = undefined;
        return this.setState({
          runtime: 'desktop',
          status: 'deferred',
          metadata,
          lastCheckedAt: checkedAt,
          error: null,
        });
      }

      this.activeUpdate = update;
      this.isDownloaded = false;
      return this.setState({
        runtime: 'desktop',
        status: 'available',
        metadata,
        progress: { ...EMPTY_PROGRESS },
        isDownloaded: false,
        lastCheckedAt: checkedAt,
        error: null,
      });
    } catch (error) {
      if (token !== this.operationToken) return this.state;
      return this.setState({
        runtime: 'desktop',
        status: isOfflineError(error) ? 'offline' : 'failed',
        lastCheckedAt: new Date().toISOString(),
        error: errorMessage(error),
      });
    }
  }

  private async performDownload(update: NativeUpdate, token: number): Promise<boolean> {
    try {
      await update.download((event) => this.handleDownloadEvent(event, token));
      if (!this.isCurrentUpdate(update, token)) return false;
      this.isDownloaded = true;
      this.setState({
        status: 'available',
        isDownloaded: true,
        progress: { ...this.state.progress, percent: 100 },
        error: null,
      });
      return true;
    } catch (error) {
      if (!this.isCurrentUpdate(update, token)) return false;
      this.setState({ status: isOfflineError(error) ? 'offline' : 'failed', error: errorMessage(error) });
      return false;
    }
  }

  private async performInstall(update: NativeUpdate, token: number): Promise<boolean> {
    try {
      await update.install({ restartAfterInstall: false });
      if (!this.isCurrentUpdate(update, token)) return false;
      this.setState({ status: 'ready-to-restart', error: null });
      return true;
    } catch (error) {
      if (!this.isCurrentUpdate(update, token)) return false;
      this.setState({ status: 'failed', error: errorMessage(error) });
      return false;
    }
  }

  private handleDownloadEvent(event: NativeDownloadEvent, token: number): void {
    if (token !== this.operationToken) return;

    if (event.event === 'Started') {
      this.setState({
        progress: {
          downloadedBytes: this.state.progress.downloadedBytes,
          totalBytes: event.data.contentLength ?? null,
          percent: this.state.progress.percent,
        },
      });
      return;
    }

    if (event.event === 'Progress') {
      const downloadedBytes = this.state.progress.downloadedBytes + Math.max(0, event.data.chunkLength);
      const totalBytes = this.state.progress.totalBytes;
      const percent = totalBytes && totalBytes > 0
        ? Math.min(100, Math.max(this.state.progress.percent, (downloadedBytes / totalBytes) * 100))
        : this.state.progress.percent;
      this.setState({ progress: { downloadedBytes, totalBytes, percent } });
      return;
    }

    this.setState({
      progress: {
        downloadedBytes: Math.max(
          this.state.progress.downloadedBytes,
          this.state.progress.totalBytes ?? this.state.progress.downloadedBytes,
        ),
        totalBytes: this.state.progress.totalBytes,
        percent: 100,
      },
    });
  }

  private isCurrentUpdate(update: NativeUpdate, token: number): boolean {
    return token === this.operationToken && this.activeUpdate === update;
  }

  private invalidateActiveUpdate(): void {
    this.operationToken += 1;
    const update = this.activeUpdate;
    this.activeUpdate = undefined;
    this.isDownloaded = false;
    if (update?.close) void update.close().catch(() => undefined);
  }

  private setState(patch: Partial<UpdateSnapshot>): UpdateSnapshot {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
    return this.state;
  }
}
