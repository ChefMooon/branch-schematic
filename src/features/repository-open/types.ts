export type FolderSupport = 'KnownSupported' | 'KnownUnsupported' | 'Unknown';
export type EditorSource = 'Known' | 'Path';

export type EditorDescriptor = {
  id: string;
  label: string;
  executablePath: string;
  shellCommand?: string;
  folderSupport: FolderSupport;
  source: EditorSource;
};

export type DefaultEditorTarget = {
  editor: EditorDescriptor;
  targetPath: string;
};

export type RepositoryOpenError = {
  code: string;
  message: string;
};

export type RepositoryOpenResult<T> = {
  success: boolean;
  data: T | null;
  error: RepositoryOpenError | null;
};
