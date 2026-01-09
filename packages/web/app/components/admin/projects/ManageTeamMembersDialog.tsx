import { SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";
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
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import type { ProjectType } from "./types";

interface TeamMember {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  role: string;
  status: string;
  assignedAt: string;
  walletLimit: number | null;
  currentSpending: number;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ManageTeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectType | null;
  currentMembers: TeamMember[];
  availableUsers: AvailableUser[];
  isLoadingMembers: boolean;
  isLoadingAvailableUsers: boolean;
  onAddMember: (userId: string) => void;
  onRemoveMember: (memberId: string) => void;
  isSubmitting: boolean;
}

export function ManageTeamMembersDialog({
  open,
  onOpenChange,
  project,
  currentMembers,
  availableUsers,
  isLoadingMembers,
  isLoadingAvailableUsers,
  onAddMember,
  onRemoveMember,
  isSubmitting,
}: ManageTeamMembersDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter available users to exclude current members
  const currentMemberIds = currentMembers.map((m) => m.userId);
  const usersToAdd = availableUsers.filter(
    (u) => !currentMemberIds.includes(u.id)
  );

  // Filter by search query
  const filteredUsersToAdd = usersToAdd.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter current members by search
  const filteredCurrentMembers = currentMembers.filter(
    (m) =>
      m.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-1 border-subtle">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Manage Team Members {project?.name && `- ${project.name}`}
          </DialogTitle>
          <DialogDescription>
            Add or remove team members for this project. Members can use the project and view analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div>
            <Input
              placeholder="Search members or available users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
            />
          </div>

          {/* Current Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">
                Current Members ({currentMembers.length})
              </h3>
            </div>

            {isLoadingMembers ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-3 border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : currentMembers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredCurrentMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 border border-subtle rounded-lg flex items-center justify-between hover:bg-surface-2/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-primary truncate">
                          {member.user?.name || "Unknown User"}
                        </p>
                        <p className="text-sm text-tertiary truncate">
                          {member.user?.email}
                        </p>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {member.role || "Member"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember(member.id)}
                      disabled={isSubmitting}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2"
                    >
                      {isSubmitting ? (
                        <SpinnerGap className="h-4 w-4 animate-spin" />
                      ) : (
                        "Remove"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-tertiary border border-dashed rounded-lg">
                No members in this project yet.
              </div>
            )}
          </div>

          {/* Available Users Section */}
          {usersToAdd.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-subtle">
              <h3 className="text-sm font-medium text-primary">
                Add Members ({usersToAdd.length} available)
              </h3>

              {isLoadingAvailableUsers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-3 border rounded-lg flex items-center justify-between"
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
              ) : filteredUsersToAdd.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredUsersToAdd.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 border border-subtle rounded-lg flex items-center justify-between hover:bg-surface-2/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <p className="font-medium text-primary">
                            {user.name || "Unknown User"}
                          </p>
                          <p className="text-sm text-tertiary">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onAddMember(user.id)}
                        disabled={isSubmitting}
                        className="bg-accent-primary text-white hover:bg-accent-primary/90"
                      >
                        {isSubmitting ? (
                          <SpinnerGap className="h-4 w-4 animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                searchQuery && (
                  <div className="text-center py-6 text-tertiary border border-dashed rounded-lg">
                    No available users match your search.
                  </div>
                )
              )}
            </div>
          )}

          {usersToAdd.length === 0 && currentMembers.length > 0 && (
            <div className="text-center py-6 text-tertiary border border-dashed rounded-lg">
              All organization members are already part of this project.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSearchQuery("");
            }}
            disabled={isSubmitting}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
