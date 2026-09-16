import {
  DEFAULT_OAUTH_REDIRECT_URI,
  GITHUB_TOKEN_URL,
  resolveAuthorizationUrl,
  resolveClientId,
  resolveRedirectUri,
  resolveTokenUrl,
} from './oauthConfig';
import { describe, expect, it } from 'vitest';

describe('OAuth configuration', () => {
  it('uses the configured client ID', () => {
    expect(resolveClientId({ VITE_GITHUB_CLIENT_ID: ' production-client ', MODE: 'production' })).toBe('production-client');
  });

  it('fails production configuration when the client ID is missing', () => {
    expect(() => resolveClientId({ MODE: 'production' })).toThrow('VITE_GITHUB_CLIENT_ID');
  });

  it('keeps the fixed loopback redirect URI', () => {
    expect(resolveRedirectUri(undefined, {})).toBe(DEFAULT_OAUTH_REDIRECT_URI);
  });

  it('builds GitHub authorization and token URLs from the API base URL', () => {
    expect(resolveAuthorizationUrl('https://api.github.com')).toBe('https://github.com/login/oauth/authorize');
    expect(resolveTokenUrl('https://api.github.com')).toBe(GITHUB_TOKEN_URL);
  });
});