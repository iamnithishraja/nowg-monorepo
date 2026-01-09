import { WarningCircle } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
import { Label } from "~/components/ui/label";
import type { OrgUser } from "./types";

interface InviteOrgUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  searchedUser: OrgUser | null;
  isSearching: boolean;
  onEmailChange: (value: string) => void;
  onSearch: () => void;
  onInvite: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function InviteOrgUserDialog({
  open,
  onOpenChange,
  email,
  searchedUser,
  isSearching,
  onEmailChange,
  onSearch,
  onInvite,
  isLoading,
  error,
}: InviteOrgUserDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onEmailChange("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User to Organization</DialogTitle>
          <DialogDescription>
            Enter the email address of the user you want to invite to your
            organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <WarningCircle className="h-4 w-4" weight="fill" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div>
            <Label htmlFor="invite-email">User Email</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSearch();
                  }
                }}
              />
              <Button
                onClick={onSearch}
                disabled={isSearching || !email.trim()}
              >
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>

          {searchedUser && (
            <div className="p-4 border border-subtle rounded-lg bg-surface-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary">
                    {searchedUser.name || "No name"}
                  </p>
                  <p className="text-sm text-tertiary">
                    {searchedUser.email}
                  </p>
                  <Badge variant="secondary" className="mt-1 bg-surface-1 text-secondary border-subtle">
                    {searchedUser.role}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onEmailChange("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onInvite}
            disabled={isLoading || !searchedUser || !email.trim()}
          >
            {isLoading ? "Inviting..." : "Invite User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

