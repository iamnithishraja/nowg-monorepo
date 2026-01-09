import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { OrgUser } from "./types";

interface InviteToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: OrgUser[];
  onAddUser: (userId: string) => void;
  isLoading: boolean;
}

export function InviteToProjectDialog({
  open,
  onOpenChange,
  users,
  onAddUser,
  isLoading,
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
          {users && users.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((availableUser) => (
                <div
                  key={availableUser.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {availableUser.name || "No name"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {availableUser.email}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {availableUser.role === "org_admin"
                        ? "Org Admin"
                        : "Org User"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAddUser(availableUser.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Adding..." : "Add to Project"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No available users</p>
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
