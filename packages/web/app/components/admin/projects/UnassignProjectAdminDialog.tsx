import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface UnassignProjectAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
  adminName: string | null;
  onConfirm: () => void;
  isPending?: boolean;
}

export function UnassignProjectAdminDialog({
  open,
  onOpenChange,
  projectName,
  adminName,
  onConfirm,
  isPending = false,
}: UnassignProjectAdminDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unassign Project Admin</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unassign{" "}
            <span className="font-semibold">{adminName}</span> as the project
            admin for <span className="font-semibold">"{projectName}"</span>?
            This action will remove their admin privileges for this project.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Unassigning..." : "Unassign Admin"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

