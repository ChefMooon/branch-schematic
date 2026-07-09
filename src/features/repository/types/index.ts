export interface RepositoryImportOptions {
  absolutePath: string;
}

export interface RepositoryCreateOptions {
  name: string;
  localPath: string;
  initializeWithReadme: boolean;
  gitIgnore?: string | null;
  license?: string | null;
}

export interface DiscoveredRepository {
  id?: string;
  display_name: string;
  absolute_path: string;
  is_git_repository: boolean;
  depth?: number;
  selected?: boolean;
}

export interface RemoteRepository {
  id: string;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  description: string | null;
  private: boolean;
  default_branch: string;
  updated_at: string;
  clone_url: string;
  ssh_url: string;
  html_url: string;
}

export interface RemoteRepositoryPage {
  items: RemoteRepository[];
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface RemoteBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface RemoteBranchPage {
  items: RemoteBranch[];
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface CloneRemoteRepositoryResult {
  path_id: string;
  absolute_path: string;
  message: string;
}

export type RepositoryModalAction = 'create' | 'add-local' | 'bulk-import' | 'clone' | 'create-view';
