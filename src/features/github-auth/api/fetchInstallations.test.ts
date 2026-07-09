import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubInstallations } from './fetchInstallations';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('fetchGithubInstallations', () => {
	it('requests the installations endpoint with GitHub headers and normalizes the response', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => [
				{ id: 42, account: { login: 'octocat' }, app_slug: 'branch-schematic' },
				{ id: 'skip-me' },
			],
		})
			;

		const installations = await fetchGithubInstallations('token-123');

		expect(installations).toHaveLength(1);
		expect(installations[0]).toMatchObject({
			id: 42,
			account: { login: 'octocat' },
			app_slug: 'branch-schematic',
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/user/installations',
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

	it('throws a descriptive error when GitHub rejects the installations request', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 403,
			text: async () => JSON.stringify({ message: 'Resource not accessible by integration' }),
		});

		await expect(fetchGithubInstallations('token-123')).rejects.toThrow(
			'GitHub installations request failed (403): Resource not accessible by integration'
		);
	});
});
