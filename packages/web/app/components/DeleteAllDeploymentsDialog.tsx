import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteAllDeploymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentCount: number;
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteAllDeploymentsDialog({
  open,
  onOpenChange,
  deploymentCount,
  onDelete,
  isDeleting = false,
}: DeleteAllDeploymentsDialogProps) {
  const handleDeleteAll = async () => {
    await onDelete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent max-w-md">
        <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
          <DialogHeader className="pb-4 px-6 pt-6">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete All Deployments
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deploymentCount}</span> deployment{deploymentCount !== 1 ? 's' : ''}?
              This action cannot be undone and will permanently remove all your deployment history.
            </DialogDescription>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Warning: This action is irreversible
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 gap-3">
            <Button
              variant="outline"
              className="border-border/50 hover:bg-muted/50"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md hover:shadow-lg transition-all duration-200 px-3 py-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Deleting All...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete All Deployments
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}