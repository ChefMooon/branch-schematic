import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGithubRepositories } from './useGithubRepositories';

const fetchInstallationsMock = vi.fn();
const fetchRepositoriesMock = vi.fn();
const fetchPublicCollaboratorRepositoriesMock = vi.fn();

vi.mock('../api/fetchInstallations', () => ({
	fetchGithubInstallations: (...args: unknown[]) => fetchInstallationsMock(...args),
}));

vi.mock('../api/fetchRepositories', () => ({
	fetchGithubInstallationRepositories: (...args: unknown[]) => fetchRepositoriesMock(...args),
}));

vi.mock('../api/fetchPublicCollaboratorRepositories', () => ({
	fetchGithubPublicCollaboratorRepositories: (...args: unknown[]) => fetchPublicCollaboratorRepositoriesMock(...args),
}));

function HookHarness({ accessToken }: { accessToken?: string | null }) {
	const state = useGithubRepositories({ accessToken, enabled: true });

	return (
		<div>
			<span data-testid="loading">{String(state.isLoading)}</span>
			<span data-testid="error">{state.error ?? ''}</span>
			<span data-testid="repo-count">{state.repositories.length}</span>
			<span data-testid="installation-id">{String(state.selectedInstallationId ?? '')}</span>
			<span data-testid="using-cache">{String(state.isUsingCache)}</span>
			<button type="button" onClick={() => void state.loadMore()}>
				Load more
			</button>
			<button type="button" onClick={() => void state.reload()}>
				Reload
			</button>
		</div>
	);
}

beforeEach(() => {
	fetchInstallationsMock.mockReset();
	fetchRepositoriesMock.mockReset();
	fetchPublicCollaboratorRepositoriesMock.mockReset();
	fetchPublicCollaboratorRepositoriesMock.mockResolvedValue([]);
});

describe('useGithubRepositories', () => {
	it('loads the first installation and repositories automatically', async () => {
		fetchInstallationsMock.mockResolvedValue([
			{ id: 99, account: { login: 'octocat' } },
		]);
		fetchRepositoriesMock.mockResolvedValue({
			items: [
				{
					id: '1',
					name: 'branch-schematic',
					full_name: 'octocat/branch-schematic',
					owner: { login: 'octocat' },
					description: 'repo',
					private: true,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/branch-schematic.git',
					ssh_url: 'git@github.com:octocat/branch-schematic.git',
					html_url: 'https://github.com/octocat/branch-schematic',
				},
			],
			page: 1,
			per_page: 30,
			has_more: false,
		});
		fetchPublicCollaboratorRepositoriesMock.mockResolvedValue([
			{
				id: '2',
				name: 'shared-public-repo',
				full_name: 'octocat/shared-public-repo',
				owner: { login: 'octocat' },
				description: null,
				private: false,
				default_branch: 'main',
				updated_at: '2026-07-09T00:00:00Z',
				clone_url: 'https://github.com/octocat/shared-public-repo.git',
				ssh_url: 'git@github.com:octocat/shared-public-repo.git',
				html_url: 'https://github.com/octocat/shared-public-repo',
			},
		]);

		render(<HookHarness accessToken="token-123" />);

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		expect(fetchInstallationsMock).toHaveBeenCalledWith('token-123', undefined);
		expect(fetchRepositoriesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				accessToken: 'token-123',
				installationId: 99,
				page: 1,
				perPage: 30,
				apiBaseUrl: undefined,
			})
		);
		expect(fetchPublicCollaboratorRepositoriesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				accessToken: 'token-123',
				apiBaseUrl: undefined,
			})
		);
		expect(screen.getByTestId('installation-id')).toHaveTextContent('99');
		expect(screen.getByTestId('repo-count')).toHaveTextContent('2');
	});

	it('surfaces a useful error when no installations exist', async () => {
		fetchInstallationsMock.mockResolvedValue([]);

		render(<HookHarness accessToken="token-123" />);

		await waitFor(() => {
			expect(screen.getByTestId('error')).toHaveTextContent('No GitHub App installations were found for the authenticated user.');
		});
	});

	it('reuses cached data within the TTL window', async () => {
		const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-09T12:00:00Z'));

		fetchInstallationsMock.mockResolvedValue([{ id: 101, account: { login: 'octocat' } }]);
		fetchRepositoriesMock.mockResolvedValue({
			items: [
				{
					id: 'repo-1',
					name: 'cached-repo',
					full_name: 'octocat/cached-repo',
					owner: { login: 'octocat' },
					description: null,
					private: false,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/cached-repo.git',
					ssh_url: 'git@github.com:octocat/cached-repo.git',
					html_url: 'https://github.com/octocat/cached-repo',
				},
			],
			page: 1,
			per_page: 30,
			has_more: false,
		});

		const { rerender } = render(<HookHarness accessToken="token-123" />);

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		expect(fetchInstallationsMock).toHaveBeenCalledTimes(1);
		expect(fetchRepositoriesMock).toHaveBeenCalledTimes(1);

		rerender(<HookHarness accessToken={null} />);
		await waitFor(() => {
			expect(screen.getByTestId('repo-count')).toHaveTextContent('0');
		});

		dateNowSpy.mockReturnValue(Date.parse('2026-07-09T12:03:00Z'));
		rerender(<HookHarness accessToken="token-123" />);

		await waitFor(() => {
			expect(screen.getByTestId('using-cache')).toHaveTextContent('true');
		});

		expect(fetchInstallationsMock).toHaveBeenCalledTimes(1);
		expect(fetchRepositoriesMock).toHaveBeenCalledTimes(1);
		dateNowSpy.mockRestore();
	});

	it('fetches again when cached data is older than TTL', async () => {
		const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-09T12:00:00Z'));

		fetchInstallationsMock.mockResolvedValue([{ id: 202, account: { login: 'octocat' } }]);
		fetchRepositoriesMock.mockResolvedValue({
			items: [
				{
					id: 'repo-2',
					name: 'ttl-repo',
					full_name: 'octocat/ttl-repo',
					owner: { login: 'octocat' },
					description: null,
					private: false,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/ttl-repo.git',
					ssh_url: 'git@github.com:octocat/ttl-repo.git',
					html_url: 'https://github.com/octocat/ttl-repo',
				},
			],
			page: 1,
			per_page: 30,
			has_more: false,
		});

		const { rerender } = render(<HookHarness accessToken="token-abc" />);

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		rerender(<HookHarness accessToken={null} />);
		await waitFor(() => {
			expect(screen.getByTestId('repo-count')).toHaveTextContent('0');
		});

		dateNowSpy.mockReturnValue(Date.parse('2026-07-09T12:06:00Z'));
		rerender(<HookHarness accessToken="token-abc" />);

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		expect(fetchInstallationsMock).toHaveBeenCalledTimes(2);
		expect(fetchRepositoriesMock).toHaveBeenCalledTimes(2);
		dateNowSpy.mockRestore();
	});

	it('reload always bypasses cache and refetches from the network', async () => {
		fetchInstallationsMock.mockResolvedValue([{ id: 303, account: { login: 'octocat' } }]);
		fetchRepositoriesMock.mockResolvedValue({
			items: [
				{
					id: 'repo-3',
					name: 'force-refresh-repo',
					full_name: 'octocat/force-refresh-repo',
					owner: { login: 'octocat' },
					description: null,
					private: true,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/force-refresh-repo.git',
					ssh_url: 'git@github.com:octocat/force-refresh-repo.git',
					html_url: 'https://github.com/octocat/force-refresh-repo',
				},
			],
			page: 1,
			per_page: 30,
			has_more: false,
		});

		render(<HookHarness accessToken="token-force" />);

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		screen.getByRole('button', { name: 'Reload' }).click();

		await waitFor(() => {
			expect(fetchInstallationsMock).toHaveBeenCalledTimes(2);
		});
		expect(fetchRepositoriesMock).toHaveBeenCalledTimes(2);
	});
});
