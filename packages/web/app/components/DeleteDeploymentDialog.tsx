import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteDeploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentTitle: string;
  deploymentId: string;
  onDelete: (deploymentId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteDeploymentDialog({
  open,
  onOpenChange,
  deploymentTitle,
  deploymentId,
  onDelete,
  isDeleting = false,
}: DeleteDeploymentDialogProps) {
  const handleDelete = async () => {
    await onDelete(deploymentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent max-w-md">
        <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
          <DialogHeader className="pb-4 px-6 pt-6">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Deployment
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete the deployment "{deploymentTitle}"? This action cannot be undone.
            </DialogDescription>
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
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md hover:shadow-lg transition-all duration-200 px-3 py-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Deployment
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}