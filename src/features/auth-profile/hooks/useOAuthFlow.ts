import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openWithShell } from '@tauri-apps/plugin-shell';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useProfileStore } from '../stores/profileStore';
import type { UserProfile } from '../types';
import {
  resolveAuthorizationUrl,
  resolveClientId,
  resolveRedirectUri,
  resolveTokenUrl,
} from './oauthConfig';

interface UseOAuthFlowOptions {
  profileId?: string;
  providerUrl?: string;
  redirectUri?: string;
}

interface OAuthFlowResult {
  username?: string | null;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

function formatOAuthError(error: unknown) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return 'The authorization request could not be completed.';
}

export function useOAuthFlow({ profileId, providerUrl, redirectUri }: UseOAuthFlowOptions = {}) {
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [redirectUriValue, setRedirectUriValue] = useState('');
  const hydrateProfiles = useProfileStore((state) => state.hydrateProfiles);
  const refreshTokenHealth = useProfileStore((state) => state.refreshTokenHealth);

  const startFlow = useCallback(async (draft: Partial<UserProfile>): Promise<OAuthFlowResult | null> => {
    setIsWorking(true);
    setStatus('Starting authorization…');

    try {
      const resolvedRedirectUriValue = resolveRedirectUri(redirectUri);
      const effectiveRedirectUri = resolvedRedirectUriValue;
      setRedirectUriValue(effectiveRedirectUri);
      const callbackPayload = await invoke<string>('begin_oauth_loopback_listener', {
        profileId: draft.id ?? profileId ?? 'pending-profile',
        redirectUri: resolvedRedirectUriValue ?? undefined,
      });
      const [resolvedProfileId, resolvedRedirectUri, state, codeVerifier, codeChallenge] = callbackPayload.split('|');
      const clientId = resolveClientId();
      const apiBaseUrl = providerUrl ?? draft.api_base_url ?? undefined;
      const tokenUrl = resolveTokenUrl(apiBaseUrl);
      const authorizationUrl = new URL(resolveAuthorizationUrl(providerUrl ?? draft.api_base_url ?? undefined));
      authorizationUrl.searchParams.set('client_id', clientId);
      const finalRedirectUri = resolvedRedirectUri || effectiveRedirectUri;
      setRedirectUriValue(finalRedirectUri);
      authorizationUrl.searchParams.set('redirect_uri', finalRedirectUri);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('scope', 'repo read:org');
      authorizationUrl.searchParams.set('state', state || resolvedProfileId);
      authorizationUrl.searchParams.set('code_challenge', codeChallenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');

      return await new Promise<OAuthFlowResult | null>((resolve) => {
        let settled = false;
        let unlisten: (() => void) | undefined;

        void listen<string>('oauth://url', async (event) => {
          let callbackUrl: URL | null = null;
          try {
            callbackUrl = new URL(event.payload);
          } catch {
            callbackUrl = null;
          }

          const error = callbackUrl?.searchParams.get('error');
          const errorDescription = callbackUrl?.searchParams.get('error_description');
          const code = callbackUrl?.searchParams.get('code');

          if (error) {
            const normalizedError = error.trim().toLowerCase();
            let message = 'Authorization was cancelled. You can try again when you are ready.';

            if (normalizedError === 'access_denied') {
              message = 'Authorization was cancelled by you. No changes were made.';
            } else if (normalizedError === 'invalid_request') {
              message = 'The authorization request was invalid. Please try again.';
            } else if (normalizedError === 'server_error') {
              message = 'GitHub returned a server error during authorization. Please try again shortly.';
            } else if (normalizedError === 'unsupported_response_type') {
              message = 'The authorization flow is not supported by this app configuration.';
            } else if (errorDescription?.trim()) {
              message = errorDescription.trim();
            }

            unlisten?.();
            setStatus(message);
            setIsWorking(false);
            if (!settled) {
              settled = true;
              resolve(null);
            }
            return;
          }

          if (!code) {
            unlisten?.();
            setStatus('The authorization response did not include an access code.');
            setIsWorking(false);
            if (!settled) {
              settled = true;
              resolve(null);
            }
            return;
          }

          setStatus('Exchanging authorization code…');
          try {
            const exchangeResult = await invoke<{
              username?: string | null;
              email?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            }>('exchange_code_for_token', {
              payload: {
                profileId: resolvedProfileId,
                code,
                redirectUri: resolvedRedirectUri,
                providerUrl: apiBaseUrl,
                tokenUrl,
                clientId,
                codeVerifier,
                state,
              },
            });
            unlisten?.();
            setStatus('Authorization complete.');
            await hydrateProfiles();
            await refreshTokenHealth();
            if (!settled) {
              settled = true;
              resolve({
                username: exchangeResult?.username ?? null,
                email: exchangeResult?.email ?? null,
                display_name: exchangeResult?.display_name ?? null,
                avatar_url: exchangeResult?.avatar_url ?? null,
              });
            }
          } catch (error) {
            console.warn('Unable to exchange OAuth code:', error);
            unlisten?.();
            setStatus(`Authorization failed: ${formatOAuthError(error)}`);
            if (!settled) {
              settled = true;
              resolve(null);
            }
          } finally {
            setIsWorking(false);
          }
        }).then(async (listenerUnlisten) => {
          unlisten = listenerUnlisten;
          try {
            await openWithShell(authorizationUrl.toString());
          } catch (error) {
            console.warn('Shell plugin could not open the browser:', error);
            try {
              await openUrl(authorizationUrl.toString());
            } catch (fallbackError) {
              console.warn('Opener plugin could not open the browser:', fallbackError);
            }
          }
          setStatus('Waiting for authorization callback…');
          return listenerUnlisten;
        }).catch(() => {
          setStatus('Authorization could not be started.');
          setIsWorking(false);
          if (!settled) {
            settled = true;
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.warn('Unable to start OAuth flow:', error);
      setStatus('Authorization could not be started.');
      setIsWorking(false);
      return null;
    }
  }, [hydrateProfiles, profileId, providerUrl, redirectUri, refreshTokenHealth]);

  return useMemo(() => ({ isWorking, status, redirectUriValue, startFlow }), [isWorking, status, redirectUriValue, startFlow]);
}
