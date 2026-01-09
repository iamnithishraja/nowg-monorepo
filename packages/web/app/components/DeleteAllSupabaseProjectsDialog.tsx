import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface DeleteAllSupabaseProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCount: number;
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteAllSupabaseProjectsDialog({
  open,
  onOpenChange,
  projectCount,
  onDelete,
  isDeleting = false,
}: DeleteAllSupabaseProjectsDialogProps) {
  const handleDeleteAll = async () => {
    await onDelete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent max-w-md">
        <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
          <DialogHeader className="pb-4 px-6 pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
              </div>
              <DialogTitle className="text-foreground text-xl">
                Delete All Supabase Projects
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-4">
            <DialogDescription className="text-muted-foreground leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {projectCount} {projectCount === 1 ? "project" : "projects"}
              </span>
              ? This action cannot be undone and will permanently remove:
            </DialogDescription>

            <div className="bg-muted/30 border border-border/40 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                All PostgreSQL databases and their data
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Authentication configurations
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Storage buckets and files
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                API keys and configurations
              </div>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4" />
                Warning: This action is irreversible
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0 px-6 pb-6">
            <Button
              variant="outline"
              className="border-border/50 hover:bg-muted/50 transition-all duration-200"
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting All...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Projects
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


