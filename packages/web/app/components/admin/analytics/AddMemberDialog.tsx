import { MagnifyingGlass, UserPlus, Users, X } from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";

interface AvailableUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableUsers: AvailableUser[];
  isLoading: boolean;
  onAddMember: (userId: string) => void;
  isAddingMember: boolean;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  availableUsers,
  isLoading,
  onAddMember,
  isAddingMember,
}: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = availableUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface-1 border-subtle p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-subtle/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-primary/20 to-violet-500/20 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-primary">
                Add Team Member
              </DialogTitle>
              <DialogDescription className="text-sm text-tertiary mt-0.5">
                Add a member from your organization
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:ring-accent-primary/20 focus:border-accent-primary/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 rounded-full bg-surface-3 flex items-center justify-center hover:bg-surface-3/80 transition-colors"
              >
                <X className="h-3 w-3 text-tertiary" />
              </button>
            )}
          </div>

          {/* User List */}
          <div className="max-h-[320px] overflow-y-auto -mx-2 px-2 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-10 w-10 rounded-full border-2 border-accent-primary/30 border-t-accent-primary animate-spin mb-3" />
                <p className="text-sm text-tertiary">Loading available users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-tertiary" />
                </div>
                <p className="text-sm font-medium text-secondary mb-1">
                  {searchQuery
                    ? "No users match your search"
                    : "No available users to add"}
                </p>
                <p className="text-xs text-tertiary max-w-[200px]">
                  {searchQuery
                    ? "Try a different search term"
                    : "All organization members are already in this project"}
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="group flex items-center justify-between p-3 rounded-xl border border-subtle bg-surface-2 hover:bg-surface-3 hover:border-accent-primary/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-surface-3 ring-2 ring-transparent group-hover:ring-accent-primary/10 transition-all">
                      {user.image ? (
                        <AvatarImage src={user.image} alt={user.name} />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-accent-primary/20 text-primary text-sm font-medium">
                          {user.name?.charAt(0)?.toUpperCase() ||
                            user.email?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-primary text-sm truncate max-w-[180px]">
                        {user.name || "Unnamed User"}
                      </p>
                      <p className="text-xs text-tertiary truncate max-w-[180px]">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onAddMember(user.id)}
                    disabled={isAddingMember}
                    className="h-8 px-4 bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-medium rounded-lg shadow-sm shadow-accent-primary/20 transition-all hover:shadow-md hover:shadow-accent-primary/30"
                  >
                    {isAddingMember ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer with count */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-subtle bg-surface-2">
            <p className="text-xs text-tertiary text-center">
              Showing {filteredUsers.length} of {availableUsers.length} available members
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
