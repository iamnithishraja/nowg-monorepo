export interface RepositoryStatus {
  hasRepository: boolean;
  isSynced: boolean;
  repository?: {
    repoName: string;
    repoFullName: string;
    repoUrl: string;
    owner: string;
    branch: string;
    lastSyncedAt?: string;
  };
}

export interface CommitInfo {
  sha?: string;
  url?: string;
}
