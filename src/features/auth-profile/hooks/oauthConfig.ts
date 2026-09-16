export const DEFAULT_OAUTH_REDIRECT_URI = 'http://127.0.0.1:3000/callback';
export const GITHUB_AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

interface OAuthEnvironment {
  DEV?: boolean;
  MODE?: string;
  VITE_GITHUB_CLIENT_ID?: string;
  VITE_OAUTH_CLIENT_ID?: string;
  VITE_OAUTH_REDIRECT_URI?: string;
  VITE_GITHUB_REDIRECT_URI?: string;
}

export function resolveClientId(environment: OAuthEnvironment = import.meta.env) {
  const configuredClientId = [environment.VITE_GITHUB_CLIENT_ID, environment.VITE_OAUTH_CLIENT_ID]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (configuredClientId) {
    return configuredClientId;
  }

  if (environment.DEV || environment.MODE === 'development') {
    return 'branch-schematic';
  }

  throw new Error('VITE_GITHUB_CLIENT_ID must be configured for production OAuth builds.');
}

export function resolveRedirectUri(explicitRedirectUri?: string, environment: OAuthEnvironment = import.meta.env) {
  return [explicitRedirectUri, environment.VITE_OAUTH_REDIRECT_URI, environment.VITE_GITHUB_REDIRECT_URI]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) ?? DEFAULT_OAUTH_REDIRECT_URI;
}

export function resolveAuthorizationUrl(baseUrl?: string) {
  if (!baseUrl || !baseUrl.includes('http')) {
    return GITHUB_AUTHORIZATION_URL;
  }

  const trimmed = baseUrl.trim();
  if (trimmed.includes('api.github.com')) {
    return GITHUB_AUTHORIZATION_URL;
  }

  try {
    const parsed = new URL(trimmed);
    return new URL('/login/oauth/authorize', parsed.origin).toString();
  } catch {
    return GITHUB_AUTHORIZATION_URL;
  }
}

export function resolveTokenUrl(baseUrl?: string) {
  if (!baseUrl || !baseUrl.includes('http')) {
    return GITHUB_TOKEN_URL;
  }

  const trimmed = baseUrl.trim();
  if (trimmed.includes('api.github.com')) {
    return GITHUB_TOKEN_URL;
  }

  try {
    const parsed = new URL(trimmed);
    return new URL('/login/oauth/access_token', parsed.origin).toString();
  } catch {
    return GITHUB_TOKEN_URL;
  }
}