import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useGitHubAuth } from "~/hooks/useGitHubAuth";
import { useGitHubRepository } from "~/hooks/useGitHubRepository";
import { GitHubRepositoryDialog } from "./github/GitHubRepositoryDialog";
import { GitHubDeleteDialog } from "./github/GitHubDeleteDialog";

interface GitHubRepositoryButtonProps {
  conversationId?: string;
  onSuccess?: () => void;
  conversationChangeKey?: number;
}

export function GitHubRepositoryButton({
  conversationId,
  onSuccess,
  conversationChangeKey,
}: GitHubRepositoryButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    isCheckingToken,
    hasGitHubConnected,
    githubToken,
    setGithubToken,
    checkGitHubToken,
    handleConnectGitHub,
  } = useGitHubAuth();

  const {
    repositoryStatus,
    isLoading,
    error,
    success,
    commitInfo,
    createRepository,
    syncRepository,
    deleteRepository,
    checkRepositoryStatus: recheckStatus,
    clearMessages,
  } = useGitHubRepository(conversationId, conversationChangeKey);

  // Check status and token when dialog opens
  useEffect(() => {
    if (conversationId && showDialog) {
      recheckStatus();
      checkGitHubToken();
      clearMessages();
    }
  }, [conversationId, showDialog]);

  const handleCreateRepository = async (
    repoName: string,
    description: string,
    isPrivate: boolean
  ) => {
    const result = await createRepository(
      repoName,
      description,
      isPrivate,
      githubToken
    );
    if (result) {
      setGithubToken("");
      onSuccess?.();
    }
  };

  const handleSyncChanges = async () => {
    const result = await syncRepository(githubToken);
    if (result) {
      setGithubToken("");
      onSuccess?.();
    }
  };

  const handleDelete = async (deleteFromGitHub: boolean) => {
    setIsDeleting(true);
    const result = await deleteRepository(githubToken, deleteFromGitHub);
    setIsDeleting(false);

    if (result) {
      setShowDeleteDialog(false);
      setShowDialog(false);
      onSuccess?.();
    }
  };

  const handleConnectGitHubWrapper = async () => {
    try {
      await handleConnectGitHub();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    clearMessages();
  };

  if (!conversationId) {
    return null;
  }

  const hasRepository = repositoryStatus?.hasRepository || false;
  const isSynced = repositoryStatus?.isSynced !== false;
  const buttonText = !hasRepository
    ? "Create Repository"
    : isSynced
    ? "Repository Synced"
    : "Sync Changes";

  const buttonIcon = !hasRepository ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ) : isSynced ? (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );

  return (
    <>
      <Button
        size="sm"
        className={`hidden md:inline-flex items-center h-9 gap-2 px-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 ${
          hasRepository && isSynced
            ? "text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-emerald-500/25 hover:shadow-emerald-500/40"
            : hasRepository && !isSynced
            ? "text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 hover:shadow-amber-500/40"
            : "text-white bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-gray-700/25 hover:shadow-gray-700/40"
        }`}
        onClick={() => setShowDialog(true)}
        title={buttonText}
      >
        {buttonIcon}
        <span>{buttonText}</span>
      </Button>

      <GitHubRepositoryDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        hasRepository={hasRepository}
        repositoryStatus={repositoryStatus}
        hasGitHubConnected={hasGitHubConnected}
        isCheckingToken={isCheckingToken}
        githubToken={githubToken}
        setGithubToken={setGithubToken}
        isLoading={isLoading}
        error={error}
        success={success}
        commitInfo={commitInfo}
        onConnectGitHub={handleConnectGitHubWrapper}
        onCreateRepository={handleCreateRepository}
        onSyncChanges={handleSyncChanges}
        onDeleteClick={() => setShowDeleteDialog(true)}
        onClose={handleClose}
      />

      <GitHubDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        error={error}
      />
    </>
  );
}
