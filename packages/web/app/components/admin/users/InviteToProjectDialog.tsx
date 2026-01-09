import { User } from "@phosphor-icons/react";
import { Badge } from "~/components/ui/badge";
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
import type { OrgUser } from "./types";

interface InviteToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: OrgUser[];
  onAddUser: (userId: string) => void;
  isLoading: boolean;
  isFetching?: boolean;
}

export function InviteToProjectDialog({
  open,
  onOpenChange,
  users,
  onAddUser,
  isLoading,
  isFetching = false,
}: InviteToProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite Users to Project</DialogTitle>
          <DialogDescription>
            Select users from your organization to add to your project. Only
            users who are not already project members are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isFetching ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-9 w-28 ml-4" />
                </div>
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((availableUser) => (
                <div
                  key={availableUser.id}
                  className="flex items-center justify-between p-3 border border-subtle rounded-lg hover:bg-surface-2 bg-surface-1"
                >
                  <div>
                    <p className="font-medium text-primary">
                      {availableUser.name || "No name"}
                    </p>
                    <p className="text-sm text-tertiary">
                      {availableUser.email}
                    </p>
                    <Badge variant="outline" className="mt-1 border-subtle text-secondary">
                      {availableUser.role === "org_admin"
                        ? "Org Admin"
                        : "Org User"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAddUser(availableUser.id)}
                    disabled={isLoading}
                    className="accent-primary hover:bg-[#8c63f2] text-white"
                  >
                    {isLoading ? "Adding..." : "Add to Project"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-tertiary">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-primary">No available users</p>
              <p className="text-sm">
                All users from your organization are already members of this
                project.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

