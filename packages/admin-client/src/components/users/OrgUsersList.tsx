import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { RemoveUserFromOrgDialog } from "@/components/remove-user-from-org-dialog";
import { useOrgUsers, useRemoveOrgUser } from "./hooks";
import { OrgUser } from "./types";

interface OrgUsersListProps {
  organizationId: string;
}

export function OrgUsersList({ organizationId }: OrgUsersListProps) {
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);

  const { data: orgUsersData, isLoading } = useOrgUsers(organizationId);
  const removeUserMutation = useRemoveOrgUser(organizationId);

  const handleRemoveUser = (user: OrgUser) => {
    setSelectedUser(user);
    setRemoveUserDialogOpen(true);
  };

  const handleConfirmRemoveUser = () => {
    if (!selectedUser) return;
    removeUserMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        setRemoveUserDialogOpen(false);
        setSelectedUser(null);
      },
    });
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading users...</div>;
  }

  if (!orgUsersData?.users || orgUsersData.users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found in this organization.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {orgUsersData.users.map((orgUser) => (
          <div
            key={orgUser.id}
            className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">{orgUser.name || "No name"}</p>
              <p className="text-sm text-muted-foreground">{orgUser.email}</p>
              <Badge variant="secondary" className="mt-1">
                {orgUser.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveUser(orgUser)}
              disabled={removeUserMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <RemoveUserFromOrgDialog
        open={removeUserDialogOpen}
        onOpenChange={(open) => {
          setRemoveUserDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
          }
        }}
        userName={selectedUser?.name || null}
        userEmail={selectedUser?.email || null}
        onConfirm={handleConfirmRemoveUser}
        isPending={removeUserMutation.isPending}
      />
    </>
  );
}
