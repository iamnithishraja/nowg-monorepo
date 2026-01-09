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

interface RemoveUserFromOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string | null;
  userEmail: string | null;
  onConfirm: () => void;
  isPending?: boolean;
}

export function RemoveUserFromOrgDialog({
  open,
  onOpenChange,
  userName,
  userEmail,
  onConfirm,
  isPending = false,
}: RemoveUserFromOrgDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove User from Organization</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-semibold">
              {userName || userEmail || "this user"}
            </span>{" "}
            from the organization? This action will revoke their access and
            remove them from all associated projects.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Removing..." : "Remove User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}



