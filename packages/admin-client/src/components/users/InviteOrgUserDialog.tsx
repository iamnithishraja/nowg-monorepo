import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OrgUser } from "./types";

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
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {searchedUser.name || "No name"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchedUser.email}
                  </p>
                  <Badge variant="secondary" className="mt-1">
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
