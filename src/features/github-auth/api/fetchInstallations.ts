import {
	buildGithubHeaders,
	extractGithubResponseErrorMessage,
	normalizeGithubApiBaseUrl,
} from './githubClient';
import type { GitHubAppInstallation } from '../types';

interface GithubInstallationsArrayResponse {
	installations?: unknown;
}

function normalizeInstallation(candidate: unknown): GitHubAppInstallation | null {
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const entry = candidate as Partial<GitHubAppInstallation> & {
		id?: unknown;
		account?: unknown;
	};

	if (typeof entry.id !== 'number') {
		return null;
	}

	let account: GitHubAppInstallation['account'] = null;
	if (entry.account && typeof entry.account === 'object') {
		const accountEntry = entry.account as GitHubAppInstallation['account'];
		if (accountEntry && typeof accountEntry.login === 'string') {
			account = {
				id: typeof accountEntry.id === 'number' ? accountEntry.id : undefined,
				login: accountEntry.login,
				type: accountEntry.type,
				html_url: accountEntry.html_url,
				avatar_url: accountEntry.avatar_url,
			};
		}
	}

	return {
		id: entry.id,
		account,
		app_slug: typeof entry.app_slug === 'string' ? entry.app_slug : undefined,
		repository_selection: typeof entry.repository_selection === 'string' ? entry.repository_selection : undefined,
		permissions: entry.permissions && typeof entry.permissions === 'object' ? (entry.permissions as Record<string, string>) : undefined,
		target_type: typeof entry.target_type === 'string' ? entry.target_type : undefined,
		created_at: typeof entry.created_at === 'string' ? entry.created_at : undefined,
		updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : undefined,
		html_url: typeof entry.html_url === 'string' ? entry.html_url : undefined,
	};
}

function extractInstallations(payload: unknown): GitHubAppInstallation[] {
	if (Array.isArray(payload)) {
		return payload.map(normalizeInstallation).filter((entry): entry is GitHubAppInstallation => entry !== null);
	}

	if (payload && typeof payload === 'object') {
		const response = payload as GithubInstallationsArrayResponse;
		if (Array.isArray(response.installations)) {
			return response.installations.map(normalizeInstallation).filter((entry): entry is GitHubAppInstallation => entry !== null);
		}
	}

	return [];
}

export async function fetchGithubInstallations(accessToken: string, apiBaseUrl?: string | null): Promise<GitHubAppInstallation[]> {
	const endpoint = `${normalizeGithubApiBaseUrl(apiBaseUrl)}/user/installations`;
	const response = await fetch(endpoint, {
		method: 'GET',
		headers: buildGithubHeaders(accessToken),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub installations request failed (${response.status}): ${extractGithubResponseErrorMessage(body, response.status)}`);
	}

	const payload = (await response.json()) as unknown;
	return extractInstallations(payload);
}
