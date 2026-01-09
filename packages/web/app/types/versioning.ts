export interface TemplateFileSnapshot {
  name: string;
  path: string;
  content: string;
}

export interface WorkspaceVersion {
  id: string;
  label: string;
  versionNumber: number;
  timestamp: number;
  files: TemplateFileSnapshot[];
  previewUrl: string | null;
  selectedPath?: string;
  anchorMessageId?: string | null;
}

export interface VersionSnapshotPayload {
  label?: string;
  files: TemplateFileSnapshot[];
  previewUrl?: string | null;
  selectedPath?: string;
  anchorMessageId?: string | null;
}
