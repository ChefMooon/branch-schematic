import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubInstallationRepositories } from './fetchRepositories';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('fetchGithubInstallationRepositories', () => {
	it('requests installation repositories and normalizes the response', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			headers: new Headers({ link: '<https://api.github.com/user/installations/42/repositories?page=2>; rel="next"' }),
			json: async () => [
				{
					id: 11,
					name: 'branch-schematic',
					full_name: 'octocat/branch-schematic',
					owner: { login: 'octocat' },
					private: true,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/branch-schematic.git',
					ssh_url: 'git@github.com:octocat/branch-schematic.git',
					html_url: 'https://github.com/octocat/branch-schematic',
				},
			],
		});

		const page = await fetchGithubInstallationRepositories({
			accessToken: 'token-123',
			installationId: 42,
			page: 2,
			perPage: 50,
		});

		expect(page).toMatchObject({
			page: 2,
			per_page: 50,
			has_more: true,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			id: '11',
			name: 'branch-schematic',
			full_name: 'octocat/branch-schematic',
			owner: { login: 'octocat' },
			private: true,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/user/installations/42/repositories?page=2&per_page=50',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer token-123',
					Accept: 'application/vnd.github.v3+json',
					'X-GitHub-Api-Version': '2022-11-28',
				}),
			})
		);
	});

	it('throws a descriptive error when GitHub rejects the repositories request', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 422,
			text: async () => JSON.stringify({ message: 'Unprocessable Entity' }),
			headers: new Headers(),
		});

		await expect(
			fetchGithubInstallationRepositories({
				accessToken: 'token-123',
				installationId: 42,
			})
		).rejects.toThrow('GitHub repositories request failed (422): Unprocessable Entity');
	});
});
