import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubPublicCollaboratorRepositories } from './fetchPublicCollaboratorRepositories';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('fetchGithubPublicCollaboratorRepositories', () => {
	it('requests public collaborator repositories with the expected query', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => [
				{
					id: 22,
					name: 'shared-public-repo',
					full_name: 'octocat/shared-public-repo',
					owner: { login: 'octocat' },
					private: false,
					default_branch: 'main',
					updated_at: '2026-07-09T00:00:00Z',
					clone_url: 'https://github.com/octocat/shared-public-repo.git',
					ssh_url: 'git@github.com:octocat/shared-public-repo.git',
					html_url: 'https://github.com/octocat/shared-public-repo',
				},
			],
		});

		const repositories = await fetchGithubPublicCollaboratorRepositories({
			accessToken: 'token-123',
		});

		expect(repositories).toHaveLength(1);
		expect(repositories[0]).toMatchObject({
			id: '22',
			private: false,
			owner: { login: 'octocat' },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/user/repos?per_page=100&visibility=public&affiliation=collaborator%2Corganization_member',
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

	it('throws a descriptive error when the collaborator request fails', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 403,
			text: async () => JSON.stringify({ message: 'Resource not accessible by integration' }),
		});

		await expect(
			fetchGithubPublicCollaboratorRepositories({
				accessToken: 'token-123',
			})
		).rejects.toThrow('GitHub public collaborator repositories request failed (403): Resource not accessible by integration');
	});
});
