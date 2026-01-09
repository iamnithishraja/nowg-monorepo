import { useState, useEffect } from "react";
import type { RepositoryStatus, CommitInfo } from "~/types/github";

// Re-export types for convenience
export type { RepositoryStatus, CommitInfo };

export function useGitHubRepository(
  conversationId?: string,
  conversationChangeKey?: number
) {
  const [repositoryStatus, setRepositoryStatus] =
    useState<RepositoryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [commitInfo, setCommitInfo] = useState<CommitInfo | null>(null);

  useEffect(() => {
    if (conversationId) {
      checkRepositoryStatus();
    }
  }, [conversationId, conversationChangeKey]);

  const checkRepositoryStatus = async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(
        `/api/github/repository/status?conversationId=${conversationId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRepositoryStatus(data);
      }
    } catch (err) {
      // Handle error silently
    }
  };

  const createRepository = async (
    repoName: string,
    description: string,
    isPrivate: boolean,
    githubToken: string
  ) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const createResponse = await fetch("/api/github/repository/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          repoName,
          description,
          isPrivate,
          accessToken: githubToken,
        }),
      });

      const createData = await createResponse.json();

      if (!createData.success) {
        throw new Error(createData.error || "Failed to create repository");
      }

      const pushResponse = await fetch("/api/github/repository/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          accessToken: githubToken,
        }),
      });

      const pushData = await pushResponse.json();

      if (!pushData.success) {
        throw new Error(pushData.error || "Failed to push code to repository");
      }

      setCommitInfo({
        sha: pushData.commit?.sha,
        url: pushData.commit?.url,
      });

      setSuccess(
        `Repository created and ${
          pushData.filesCount || 0
        } files pushed successfully!`
      );

      await checkRepositoryStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const syncRepository = async (githubToken: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setCommitInfo(null);

    try {
      const response = await fetch("/api/github/repository/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          accessToken: githubToken,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to sync changes");
      }

      setCommitInfo({
        sha: data.commit?.sha,
        url: data.commit?.url,
      });

      setSuccess(`Changes synced successfully!`);
      await checkRepositoryStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRepository = async (
    githubToken: string,
    deleteFromGitHub: boolean
  ) => {
    setError(null);

    try {
      const response = await fetch("/api/github/repository/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          accessToken: githubToken,
          deleteFromGitHub,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to delete repository");
      }

      await checkRepositoryStatus();
      setSuccess(data.message);
      setTimeout(() => setSuccess(null), 3000);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
    setCommitInfo(null);
  };

  return {
    repositoryStatus,
    isLoading,
    error,
    success,
    commitInfo,
    createRepository,
    syncRepository,
    deleteRepository,
    checkRepositoryStatus,
    clearMessages,
  };
}

