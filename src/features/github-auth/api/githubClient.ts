const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com';

export function normalizeGithubApiBaseUrl(apiBaseUrl?: string | null): string {
	const trimmed = apiBaseUrl?.trim();
	return trimmed ? trimmed.replace(/\/+$/, '') : DEFAULT_GITHUB_API_BASE_URL;
}

export function buildGithubHeaders(accessToken: string): HeadersInit {
	return {
		Authorization: `Bearer ${accessToken.trim()}`,
		Accept: 'application/vnd.github.v3+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};
}

export function extractGithubResponseErrorMessage(responseBody: string, status: number): string {
	const trimmed = responseBody.trim();
	if (!trimmed) {
		return `GitHub request failed with status ${status}.`;
	}

	try {
		const parsed = JSON.parse(trimmed) as { message?: unknown; errors?: unknown };
		if (typeof parsed.message === 'string' && parsed.message.trim()) {
			return parsed.message.trim();
		}
	} catch {
		// Ignore non-JSON bodies.
	}

	return trimmed;
}
