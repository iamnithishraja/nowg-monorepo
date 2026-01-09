import { Warning } from "@phosphor-icons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../ui/alert-dialog";

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  onConfirm: () => void;
  isRemoving: boolean;
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  memberName,
  onConfirm,
  isRemoving,
}: RemoveMemberDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface-1 border-subtle">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-primary">
            <Warning className="h-5 w-5 text-[#ef4444]" weight="fill" />
            Remove Team Member
          </AlertDialogTitle>
          <AlertDialogDescription className="text-secondary">
            Are you sure you want to remove{" "}
            <span className="font-medium text-primary">{memberName}</span> from
            this project? They will lose access to all project resources.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-surface-2 border-subtle text-primary hover:bg-surface-3">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isRemoving}
            className="bg-[#ef4444] text-white hover:bg-[#ef4444]/90"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
