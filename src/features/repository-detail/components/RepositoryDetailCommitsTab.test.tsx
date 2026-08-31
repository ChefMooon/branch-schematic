import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommitChangedFile, RepositoryFileDiff, TrackedPath } from '../../../types/git';
import type { CommitRecord } from './RepositoryDetail';
import { RepositoryDetailCommitsTab } from './RepositoryDetailCommitsTab';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const repo: TrackedPath = {
  id: 'repo-1',
  display_name: 'Branch Schematic',
  absolute_path: '/tmp/branch-schematic',
  current_branch: 'main',
  default_branch_name: 'main',
  available_branches: ['main'],
  ahead_count: 0,
  behind_count: 0,
  has_upstream: false,
  uncommitted_changes_count: 0,
  remote_url: null,
  github_owner_login: null,
  repo_origin_type: 'LOCAL_ONLY',
  tags: [],
};

const commits: CommitRecord[] = [
  {
    commit_hash: 'hash-one',
    author_name: 'Ada Lovelace',
    commit_message: 'First change',
    committed_at: '2024-01-01T10:00:00Z',
    signature_status: null,
    push_state: null,
  },
  {
    commit_hash: 'hash-two',
    author_name: 'Grace Hopper',
    commit_message: 'Second change',
    committed_at: '2024-01-02T10:00:00Z',
    signature_status: null,
    push_state: null,
  },
];

function mockBackend({
  files = [
    { path: 'src/App.tsx', oldPath: null, status: 'modified', isBinary: false },
    { path: 'src/renamed.tsx', oldPath: 'src/original.tsx', status: 'renamed', isBinary: false },
  ] as CommitChangedFile[],
  diff = {
    path: 'src/App.tsx',
    oldPath: null,
    patch: '@@ -1,2 +1,2 @@\n-old\n unchanged\n+new',
    isBinary: false,
    isTruncated: false,
    unavailableReason: null,
  } as RepositoryFileDiff,
} = {}) {
  invokeMock.mockImplementation((command: string) => {
    if (command === 'get_commit_changed_files') return Promise.resolve(files);
    if (command === 'get_commit_file_diff') return Promise.resolve({ ...diff, path: 'src/App.tsx' });
    return Promise.resolve(null);
  });
}

function renderTab(overrides: Partial<Parameters<typeof RepositoryDetailCommitsTab>[0]> = {}) {
  const props = {
    repo,
    commits,
    selectedCommit: commits[0],
    isLoadingCommits: false,
    branchLabel: 'main',
    onSelectCommit: vi.fn(),
    ...overrides,
  };
  const rendered = render(<RepositoryDetailCommitsTab {...props} />);
  return {
    props,
    rerender: rendered.rerender,
    historyButton: (name: RegExp) =>
      rendered
        .getAllByRole('button', { name })
        .find((button) => button.className.includes('repository-view-commit-item'))!,
    summaryStrip: () =>
      rendered.container.querySelector<HTMLButtonElement>('.repository-view-commit-summary-strip')!,
  };
}

describe('RepositoryDetailCommitsTab', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders relative commit dates with full-date tooltips', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-03T10:00:00Z'));
    const relativeCommits = commits.map((commit, index) => ({
      ...commit,
      committed_at: index === 0 ? '2024-01-03T09:07:00Z' : '2024-01-01T10:00:00Z',
    }));

    renderTab({ commits: relativeCommits, selectedCommit: relativeCommits[0] });

    const minuteDate = screen.getByText('53 minutes ago');
    expect(minuteDate).toHaveAttribute(
      'title',
      new Date('2024-01-03T09:07:00Z').toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('renders loading, empty, and loaded history states', () => {
    const { rerender } = render(
      <RepositoryDetailCommitsTab
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits
        branchLabel="main"
        onSelectCommit={vi.fn()}
      />,
    );
    expect(screen.getByText('Loading commits…')).toBeInTheDocument();

    rerender(
      <RepositoryDetailCommitsTab
        repo={repo}
        commits={[]}
        selectedCommit={null}
        isLoadingCommits={false}
        branchLabel="main"
        onSelectCommit={vi.fn()}
      />,
    );
    expect(screen.getByText('No branch commits available yet.')).toBeInTheDocument();

    rerender(
      <RepositoryDetailCommitsTab
        repo={repo}
        commits={commits}
        selectedCommit={commits[0]}
        isLoadingCommits={false}
        branchLabel="main"
        onSelectCommit={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: /first change/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /second change/i })).toBeInTheDocument();
    const historyItem = screen
      .getAllByRole('button', { name: /first change/i })
      .find((button) => button.className.includes('repository-view-commit-item'));
    expect(historyItem?.className).toContain('is-selected');
  });

  it('fetches changed files when a commit is selected and renders rows with badges', async () => {
    mockBackend();
    const { props, rerender, historyButton } = renderTab({ selectedCommit: null });

    expect(invokeMock).not.toHaveBeenCalledWith('get_commit_changed_files', expect.anything());

    fireEvent.click(historyButton(/second change/i));
    expect(props.onSelectCommit).toHaveBeenCalledWith('hash-two');

    rerender(
      <RepositoryDetailCommitsTab
        {...props}
        selectedCommit={commits[1]}
      />,
    );
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_commit_changed_files', {
        absolutePath: '/tmp/branch-schematic',
        commitHash: 'hash-two',
      });
    });
    expect(await screen.findByTitle('src/original.tsx → src/renamed.tsx')).toBeInTheDocument();
    expect(screen.getAllByText('renamed').length).toBeGreaterThan(0);
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('auto-selects the first file, loads its diff, and flips view modes', async () => {
    mockBackend();
    renderTab();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_commit_file_diff', {
        absolutePath: '/tmp/branch-schematic',
        commitHash: 'hash-one',
        path: 'src/App.tsx',
      });
    });
    expect(await screen.findByLabelText('unified diff')).toHaveTextContent('old');

    fireEvent.click(screen.getByRole('button', { name: /split view/i }));
    expect(screen.getByLabelText('split diff')).toHaveTextContent('new');

    fireEvent.click(screen.getByRole('button', { name: /unified view/i }));
    expect(await screen.findByLabelText('unified diff')).toBeInTheDocument();
  });

  it('loads the diff when the user picks another file', async () => {
    mockBackend();
    renderTab();

    await screen.findByLabelText('unified diff');
    fireEvent.click(screen.getByTitle('src/original.tsx → src/renamed.tsx'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_commit_file_diff', {
        absolutePath: '/tmp/branch-schematic',
        commitHash: 'hash-one',
        path: 'src/renamed.tsx',
      });
    });
  });

  it('shows the empty-commit state without collapsing the layout', async () => {
    mockBackend({ files: [] });
    renderTab();

    expect(await screen.findByText('No changed files in this commit.')).toBeInTheDocument();
    expect(screen.getByText('Select a file to preview its diff.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('get_commit_file_diff', expect.anything());
  });

  it('surfaces binary files with the established empty-state message', async () => {
    mockBackend({
      files: [{ path: 'assets/logo.png', oldPath: null, status: 'modified', isBinary: true }],
      diff: {
        path: 'assets/logo.png',
        oldPath: null,
        patch: null,
        isBinary: true,
        isTruncated: false,
        unavailableReason: 'Binary files cannot be previewed as text diffs.',
      },
    });
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/Binary or unsupported files cannot be previewed/i)).toBeInTheDocument();
    });
  });

  it('shows the truncation notice above a partial diff', async () => {
    mockBackend({
      diff: {
        path: 'src/App.tsx',
        oldPath: null,
        patch: '@@ -1 +1 @@\n+partial',
        isBinary: false,
        isTruncated: true,
        unavailableReason: 'The preview was truncated to keep the application responsive.',
      },
    });
    renderTab();

    expect(
      await screen.findByText('The preview was truncated to keep the application responsive.'),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('unified diff')).toBeInTheDocument();
  });

  it('expands the commit summary strip with metadata and resets expansion per commit', async () => {
    mockBackend();
    const { props, rerender, summaryStrip } = renderTab();

    fireEvent.click(summaryStrip());
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();

    rerender(<RepositoryDetailCommitsTab {...props} selectedCommit={commits[1]} />);
    expect(screen.queryByText('Signature')).not.toBeInTheDocument();

    fireEvent.click(summaryStrip());
    expect(screen.getByText('Signature')).toBeInTheDocument();
  });

  it('adjusts panel flex-basis within clamp bounds when dividers are dragged', async () => {
    mockBackend();
    renderTab();
    await screen.findByText('2 files');

    const shell = document.querySelector<HTMLElement>('.repository-view-history-shell')!;
    const region = document.querySelector<HTMLElement>('.repository-view-commit-region')!;
    shell.getBoundingClientRect = () => rect(1000);
    region.getBoundingClientRect = () => ({ ...rect(780), left: 220 });

    const historyDivider = screen.getByRole('separator', { name: 'Resize commit history panels' });
    const filesDivider = screen.getByRole('separator', { name: 'Resize commit file panels' });
    const historyPanel = document.querySelector<HTMLElement>('.repository-view-history-panel')!;
    const filesPanel = document.querySelector<HTMLElement>('.repository-view-commit-files-panel')!;
    expect(historyPanel.style.flexBasis).toBe('22%');
    expect(filesPanel.style.flexBasis).toBe('20%');

    fireEvent.mouseDown(historyDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 400 });
    expect(historyPanel.style.flexBasis).toBe('40%');
    expect(filesPanel.style.flexBasis).toBe('20%');
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(historyDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 10 });
    expect(historyPanel.style.flexBasis).toBe('28%');
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(filesDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 700 });
    expect(filesPanel.style.flexBasis).toBe('60%');
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(historyDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 100 });
    expect(filesPanel.style.flexBasis).toBe('60%');
    fireEvent.mouseUp(window);
  });

  it('nudges the files ratio with arrow keys on the focused divider', async () => {
    mockBackend();
    renderTab();
    await screen.findByText('2 files');

    const region = document.querySelector<HTMLElement>('.repository-view-commit-region')!;
    region.getBoundingClientRect = () => rect(1000);
    const filesPanel = document.querySelector<HTMLElement>('.repository-view-commit-files-panel')!;

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize commit file panels' }), { key: 'ArrowRight' });
    expect(filesPanel.style.flexBasis).toBe('21%');

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize commit file panels' }), { key: 'ArrowLeft' });
    expect(filesPanel.style.flexBasis).toBe('20%');
  });

  it('restores persisted panel ratios on mount and reports them upward', async () => {
    mockBackend();
    const onPersistPanelRatios = vi.fn();
    renderTab({ persistedPanelRatios: { history: 0.3, files: 0.25 }, onPersistPanelRatios });
    await screen.findByText('2 files');

    expect(document.querySelector<HTMLElement>('.repository-view-history-panel')!.style.flexBasis).toBe('30%');
    expect(document.querySelector<HTMLElement>('.repository-view-commit-files-panel')!.style.flexBasis).toBe('25%');
    await waitFor(() => {
      expect(onPersistPanelRatios).toHaveBeenCalledWith(expect.objectContaining({ history: 0.3, files: 0.25 }));
    });
  });

  it('commits the final ratio to the persistence handler after a drag completes', async () => {
    mockBackend();
    const onPersistPanelRatios = vi.fn();
    renderTab({ onPersistPanelRatios });
    await screen.findByText('2 files');

    const shell = document.querySelector<HTMLElement>('.repository-view-history-shell')!;
    shell.getBoundingClientRect = () => rect(1000);
    const historyDivider = screen.getByRole('separator', { name: 'Resize commit history panels' });

    fireEvent.mouseDown(historyDivider, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 400 });
    fireEvent.mouseUp(window);

    expect(document.querySelector<HTMLElement>('.repository-view-history-panel')!.style.flexBasis).toBe('40%');
    await waitFor(() => {
      expect(onPersistPanelRatios).toHaveBeenLastCalledWith(expect.objectContaining({ history: 0.4, files: 0.2 }));
    });
    expect(onPersistPanelRatios).toHaveBeenCalledTimes(2);
  });
});

function rect(width: number): DOMRect {
  return {
    width,
    left: 0,
    top: 0,
    right: width,
    bottom: 100,
    x: 0,
    y: 0,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect;
}
