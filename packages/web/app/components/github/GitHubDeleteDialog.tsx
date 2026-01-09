import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Alert } from "../ui/alert";

interface GitHubDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (deleteFromGitHub: boolean) => void;
  isDeleting: boolean;
  error: string | null;
}

export function GitHubDeleteDialog({
  open,
  onOpenChange,
  onDelete,
  isDeleting,
  error,
}: GitHubDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Delete Repository
          </DialogTitle>
          <DialogDescription className="pt-3">
            <p className="text-gray-600">
              How would you like to handle the GitHub repository?
            </p>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <p className="text-sm">{error}</p>
          </Alert>
        )}

        <div className="space-y-3 py-4">
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ Choose an option:
            </p>
            <div className="space-y-2 text-sm text-yellow-800">
              <p>
                <strong>Just Unlink:</strong> Removes connection, keeps
                repository on GitHub
              </p>
              <p>
                <strong>Delete from GitHub:</strong> Permanently deletes the
                repository (cannot be undone!)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDelete(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? "Unlinking..." : "Just Unlink"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDelete(true)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? "Deleting..." : "Delete from GitHub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

