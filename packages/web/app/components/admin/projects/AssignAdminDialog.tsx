import { CheckCircle } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import type { AvailableUser } from "./index";

interface AssignAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AvailableUser[];
  isLoading: boolean;
  selectedUserId: string;
  onUserSelect: (userId: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isSubmitting: boolean;
  currentUserId?: string;
}

export function AssignAdminDialog({
  open,
  onOpenChange,
  users,
  isLoading,
  selectedUserId,
  onUserSelect,
  onSubmit,
  onReset,
  isSubmitting,
  currentUserId,
}: AssignAdminDialogProps) {
  const filteredUsers = users.filter((u) => u.id !== currentUserId);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onReset();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Project Admin</DialogTitle>
          <DialogDescription>
            Select a user from your organization to assign as project admin. The
            user will be assigned immediately (no invitation required).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((availableUser) => (
                <div
                  key={availableUser.id}
                  className={`p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedUserId === availableUser.id
                      ? "bg-primary/5 border-primary"
                      : ""
                  }`}
                  onClick={() => onUserSelect(availableUser.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedUserId === availableUser.id
                          ? "border-[#7b4cff] accent-primary"
                          : "border-tertiary"
                      }`}
                    >
                      {selectedUserId === availableUser.id && (
                        <CheckCircle className="h-3 w-3 text-white" weight="fill" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-primary">
                        {availableUser.name || "No name"}
                      </p>
                      <p className="text-sm text-tertiary">
                        {availableUser.email}
                      </p>
                    </div>
                  </div>
                  {selectedUserId === availableUser.id && (
                    <CheckCircle className="h-5 w-5 text-[#7b4cff]" weight="fill" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-tertiary">
              No available users found in this organization. Users must be
              members of the organization before they can be assigned as project
              admin.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting || !selectedUserId}>
            {isSubmitting ? "Assigning..." : "Assign Project Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

