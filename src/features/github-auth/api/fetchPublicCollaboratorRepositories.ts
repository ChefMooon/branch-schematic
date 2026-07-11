import {
	buildGithubHeaders,
	extractGithubResponseErrorMessage,
	normalizeGithubApiBaseUrl,
} from './githubClient';
import type { GitHubRepository } from '../types';

interface GithubRepositoriesArrayResponse {
	repositories?: unknown;
}

function normalizeRepository(candidate: unknown): GitHubRepository | null {
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const entry = candidate as {
		id?: unknown;
		name?: unknown;
		full_name?: unknown;
		owner?: unknown;
		private?: unknown;
		description?: unknown;
		default_branch?: unknown;
		updated_at?: unknown;
		clone_url?: unknown;
		ssh_url?: unknown;
		html_url?: unknown;
	};

	if (typeof entry.id !== 'number' || typeof entry.name !== 'string' || typeof entry.full_name !== 'string') {
		return null;
	}

	const ownerCandidate = entry.owner && typeof entry.owner === 'object' ? (entry.owner as GitHubRepository['owner']) : null;
	const ownerLogin = ownerCandidate && typeof ownerCandidate.login === 'string' ? ownerCandidate.login : 'unknown';

	return {
		id: entry.id.toString(),
		name: entry.name,
		full_name: entry.full_name,
		owner: {
			login: ownerLogin,
			id: typeof ownerCandidate?.id === 'number' ? ownerCandidate.id : undefined,
			type: typeof ownerCandidate?.type === 'string' ? ownerCandidate.type : undefined,
			html_url: typeof ownerCandidate?.html_url === 'string' ? ownerCandidate.html_url : undefined,
			avatar_url: typeof ownerCandidate?.avatar_url === 'string' ? ownerCandidate.avatar_url : undefined,
		},
		description: typeof entry.description === 'string' ? entry.description : null,
		private: Boolean(entry.private),
		default_branch: typeof entry.default_branch === 'string' && entry.default_branch.trim() ? entry.default_branch : 'main',
		updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : '',
		clone_url: typeof entry.clone_url === 'string' ? entry.clone_url : '',
		ssh_url: typeof entry.ssh_url === 'string' ? entry.ssh_url : '',
		html_url: typeof entry.html_url === 'string' ? entry.html_url : '',
	};
}

function extractRepositories(payload: unknown): GitHubRepository[] {
	if (Array.isArray(payload)) {
		return payload.map(normalizeRepository).filter((entry): entry is GitHubRepository => entry !== null);
	}

	if (payload && typeof payload === 'object') {
		const response = payload as GithubRepositoriesArrayResponse;
		if (Array.isArray(response.repositories)) {
			return response.repositories.map(normalizeRepository).filter((entry): entry is GitHubRepository => entry !== null);
		}
	}

	return [];
}

export async function fetchGithubPublicCollaboratorRepositories({
	accessToken,
	apiBaseUrl,
	perPage = 100,
}: {
	accessToken: string;
	apiBaseUrl?: string | null;
	perPage?: number;
}): Promise<GitHubRepository[]> {
	const endpoint = `${normalizeGithubApiBaseUrl(apiBaseUrl)}/user/repos`;
	const url = new URL(endpoint);
	url.searchParams.set('per_page', String(perPage));
	url.searchParams.set('visibility', 'public');
	url.searchParams.set('affiliation', 'collaborator,organization_member');

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: buildGithubHeaders(accessToken),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub public collaborator repositories request failed (${response.status}): ${extractGithubResponseErrorMessage(body, response.status)}`);
	}

	const payload = (await response.json()) as unknown;
	return extractRepositories(payload);
}
