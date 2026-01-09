import type {
  TemplateFileSnapshot,
  WorkspaceVersion,
  VersionSnapshotPayload,
} from "../types/versioning";

interface VersionResponse {
  id: string;
  label: string;
  versionNumber: number;
  createdAt: string;
  files: TemplateFileSnapshot[];
  previewUrl: string | null;
  selectedPath?: string;
  anchorMessageId?: string | null;
}

function mapVersionResponse(version: VersionResponse): WorkspaceVersion {
  return {
    id: version.id,
    label: version.label,
    versionNumber: version.versionNumber,
    timestamp: new Date(version.createdAt).getTime(),
    files: version.files,
    previewUrl: version.previewUrl,
    selectedPath: version.selectedPath,
    anchorMessageId: version.anchorMessageId ?? null,
  };
}

export async function fetchConversationVersions(
  conversationId: string
): Promise<WorkspaceVersion[]> {
  const response = await fetch(
    `/api/conversation-versions?conversationId=${conversationId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to load versions: ${response.status}`);
  }

  const data = await response.json();
  return (data.versions as VersionResponse[]).map(mapVersionResponse);
}

export async function createConversationVersion(
  conversationId: string,
  payload: VersionSnapshotPayload
): Promise<WorkspaceVersion> {
  const response = await fetch("/api/conversation-versions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      conversationId,
      payload,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as any)?.error || `Failed to create version: ${response.status}`
    );
  }

  const data = await response.json();
  return mapVersionResponse(data.version as VersionResponse);
}
