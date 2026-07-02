export type AuthLevel = 'basic' | 'local_system' | 'full_oauth';
export type TokenHealthStatus = 'healthy' | 'expired' | 'unreachable' | 'none';

export interface UserProfile {
  id: string;
  display_name: string;
  auth_level: AuthLevel;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  api_base_url?: string | null;
  repository_scope?: string[] | null;
  folder_scope?: string[] | null;
  commit_name?: string | null;
  commit_email?: string | null;
  token_value?: string | null;
  token_expires_at?: string | null;
  last_token_check_at?: string | null;
  is_active?: number | boolean;
  is_favorite?: number | boolean;
  created_at?: string | null;
  updated_at?: string | null;
}
