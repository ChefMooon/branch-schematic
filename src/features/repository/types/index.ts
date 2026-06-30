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

export type RepositoryModalAction = 'create' | 'add-local' | 'clone' | 'create-view';
