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

export type RepositoryModalAction = 'create' | 'add-local' | 'bulk-import' | 'clone' | 'create-view';
