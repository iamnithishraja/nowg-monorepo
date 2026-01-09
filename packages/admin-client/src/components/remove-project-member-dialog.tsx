import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RemoveProjectMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string | null;
  memberEmail: string | null;
  projectName: string | null;
  onConfirm: () => void;
  isPending?: boolean;
}

export function RemoveProjectMemberDialog({
  open,
  onOpenChange,
  memberName,
  memberEmail,
  projectName,
  onConfirm,
  isPending = false,
}: RemoveProjectMemberDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member from Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-semibold">
              {memberName || memberEmail || "this member"}
            </span>{" "}
            from the project{" "}
            <span className="font-semibold">"{projectName}"</span>? This action
            will revoke their access to this project.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Removing..." : "Remove Member"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

