import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Alert } from "../ui/alert";
import { GitHubConnectPanel } from "./GitHubConnectPanel";
import { GitHubRepoInfo } from "./GitHubRepoInfo";
import { GitHubSuccessAlert } from "./GitHubSuccessAlert";
import type { RepositoryStatus } from "~/types/github";

interface GitHubRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasRepository: boolean;
  repositoryStatus: RepositoryStatus | null;
  hasGitHubConnected: boolean;
  isCheckingToken: boolean;
  githubToken: string;
  setGithubToken: (token: string) => void;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  commitInfo: { sha?: string; url?: string } | null;
  onConnectGitHub: () => Promise<void>;
  onCreateRepository: (
    repoName: string,
    description: string,
    isPrivate: boolean
  ) => Promise<void>;
  onSyncChanges: () => Promise<void>;
  onDeleteClick: () => void;
  onClose: () => void;
}

export function GitHubRepositoryDialog({
  open,
  onOpenChange,
  hasRepository,
  repositoryStatus,
  hasGitHubConnected,
  isCheckingToken,
  githubToken,
  setGithubToken,
  isLoading,
  error,
  success,
  commitInfo,
  onConnectGitHub,
  onCreateRepository,
  onSyncChanges,
  onDeleteClick,
  onClose,
}: GitHubRepositoryDialogProps) {
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const handleCreate = async () => {
    if (!repoName.trim()) return;
    await onCreateRepository(repoName, description, isPrivate);
    setRepoName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {!hasRepository
              ? "Create GitHub Repository"
              : "Sync Changes to GitHub"}
          </DialogTitle>
          <DialogDescription>
            {!hasRepository
              ? "Create a new GitHub repository and push your code to it."
              : "Push your latest changes to the connected GitHub repository."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <p className="text-sm">{error}</p>
            </Alert>
          )}

          {success && (
            <GitHubSuccessAlert
              message={success}
              commitInfo={commitInfo}
              repositoryStatus={repositoryStatus}
            />
          )}

          <GitHubConnectPanel
            hasGitHubConnected={hasGitHubConnected}
            isCheckingToken={isCheckingToken}
            isLoading={isLoading}
            onConnect={onConnectGitHub}
          />

          {!hasRepository && (
            <>
              <div className="space-y-2">
                <Label htmlFor="repoName">Repository Name *</Label>
                <Input
                  id="repoName"
                  placeholder="my-awesome-project"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="A brief description of your project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPrivate"
                  checked={isPrivate}
                  onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
                  disabled={isLoading}
                />
                <Label htmlFor="isPrivate" className="cursor-pointer">
                  Make repository private
                </Label>
              </div>
            </>
          )}

          {hasRepository && repositoryStatus && (
            <GitHubRepoInfo repositoryStatus={repositoryStatus} />
          )}

          {!hasGitHubConnected && (
            <div className="space-y-2">
              <Label htmlFor="githubToken">
                GitHub Access Token (Optional)
              </Label>
              <Input
                id="githubToken"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Alternatively, provide a token from{" "}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Settings
                </a>{" "}
                with 'repo' scope
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasRepository && (
            <Button
              variant="destructive"
              onClick={onDeleteClick}
              disabled={isLoading}
              className="sm:mr-auto"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Unlink Repository
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            {success ? (
              <Button onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={!hasRepository ? handleCreate : onSyncChanges}
                  disabled={
                    isLoading ||
                    (!hasGitHubConnected && !githubToken.trim()) ||
                    (!hasRepository && !repoName.trim())
                  }
                >
                  {isLoading
                    ? "Processing..."
                    : !hasRepository
                    ? "Create & Push"
                    : "Sync Changes"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

