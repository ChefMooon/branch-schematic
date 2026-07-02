import { useMemo } from 'react';
import { ArrowSquareOut, CheckCircle, SpinnerGap } from '@phosphor-icons/react';
import type { UserProfile } from '../types';
import { useOAuthFlow } from '../hooks/useOAuthFlow';

interface OAuthConnectButtonProps {
  draft: Partial<UserProfile>;
  onChange: (changes: Partial<UserProfile>) => void;
}

export function OAuthConnectButton({ draft, onChange }: OAuthConnectButtonProps) {
  const { isWorking, status, startFlow } = useOAuthFlow({
    profileId: draft.id ?? undefined,
    providerUrl: draft.api_base_url ?? undefined,
  });

  const isOAuthProfile = draft.auth_level === 'full_oauth';
  const hasToken = useMemo(() => String(draft.token_value ?? '').trim().length > 0, [draft.token_value]);

  if (!isOAuthProfile) {
    return null;
  }

  const handleConnect = async () => {
    const result = await startFlow(draft);
    if (result?.token) {
      onChange({
        token_value: result.token,
        username: result.username ?? draft.username ?? null,
        email: result.email ?? draft.email ?? null,
        display_name: result.display_name ?? draft.display_name ?? undefined,
        avatar_url: result.avatar_url ?? draft.avatar_url ?? null,
        commit_name: result.display_name ?? draft.commit_name ?? null,
        commit_email: result.email ?? draft.commit_email ?? null,
      });
    }
  };

  const handleRetry = async () => {
    if (isWorking) {
      return;
    }

    await handleConnect();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
      <button type="button" onClick={() => { void handleConnect(); }} disabled={isWorking} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: '10px',
        border: '1px solid var(--app-border)',
        backgroundColor: 'transparent',
        color: 'inherit',
        padding: '8px 12px',
        cursor: isWorking ? 'wait' : 'pointer',
      }}>
        {isWorking ? <SpinnerGap size={16} className="spin" /> : hasToken ? <CheckCircle size={16} color="var(--accent, #3b82f6)" /> : <ArrowSquareOut size={16} />}
        <span>{hasToken ? 'Re-authorize' : 'Connect OAuth'}</span>
      </button>
      {status ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: '12px',
            color: 'var(--app-text-muted, #64748b)',
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid var(--app-border)',
            backgroundColor: 'var(--app-surface-2, rgba(255,255,255,0.04))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span>{status}</span>
          </div>
          {status !== 'Authorization complete.' ? (
            <button
              type="button"
              onClick={() => { void handleRetry(); }}
              disabled={isWorking}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent, #3b82f6)',
                cursor: isWorking ? 'wait' : 'pointer',
                padding: 0,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
