import { ArrowClockwise, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { RemoveUserFromOrgDialog } from "../RemoveUserFromOrgDialog";
import { useOrgUsers, useRemoveOrgUser } from "./hooks";
import type { OrgUser } from "./types";

interface OrgUsersListProps {
  organizationId: string;
}

export function OrgUsersList({ organizationId }: OrgUsersListProps) {
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);

  const { data: orgUsersData, isLoading, isFetching, refetch } = useOrgUsers(organizationId);
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
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!orgUsersData?.users || orgUsersData.users.length === 0) {
    return (
      <div className="text-center py-8 text-tertiary">
        No users found in this organization.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-secondary">
          {orgUsersData.users.length} user{orgUsersData.users.length !== 1 ? 's' : ''}
        </p>
        <Button
          onClick={() => refetch()}
          size="sm"
          variant="ghost"
          disabled={isFetching}
          className="h-8 text-secondary hover:bg-surface-2 hover:text-primary"
        >
          <ArrowClockwise className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {orgUsersData.users.map((orgUser) => (
          <div
            key={orgUser.id}
            className="p-4 border border-subtle rounded-lg flex items-center justify-between hover:bg-surface-2 bg-surface-1"
          >
            <div>
              <p className="font-medium text-primary">{orgUser.name || "No name"}</p>
              <p className="text-sm text-tertiary">{orgUser.email}</p>
              <Badge variant="secondary" className="mt-1 bg-surface-2 text-secondary border-subtle">
                {orgUser.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveUser(orgUser)}
              disabled={removeUserMutation.isPending}
              className="text-[#ef4444] hover:text-[#ef4444] hover:bg-error-500/10"
            >
              <Trash className="h-4 w-4" weight="fill" />
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

