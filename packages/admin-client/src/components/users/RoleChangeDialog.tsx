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
import { UserType } from "./types";
import { UserRole } from "@/types/roles";

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  isLoading,
  onConfirm,
  onCancel,
}: RoleChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {user?.role === UserRole.ADMIN
              ? "Remove Admin Access?"
              : "Grant Admin Access?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {user?.role === UserRole.ADMIN ? (
              <>
                Are you sure you want to remove admin access for{" "}
                <strong>{user.email}</strong>? They will be demoted to a regular
                user.
              </>
            ) : (
              <>
                Are you sure you want to grant admin access to{" "}
                <strong>{user?.email}</strong>? They will receive an email
                notification about their new role.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading
              ? "Updating..."
              : user?.role === UserRole.ADMIN
              ? "Remove Admin"
              : "Grant Admin"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
