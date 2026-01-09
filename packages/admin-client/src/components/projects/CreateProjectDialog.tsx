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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrganizationType } from "./types";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectDescription: string;
  organizationId: string;
  organizations: OrganizationType[];
  isOrgAdmin: boolean;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onOrganizationIdChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  projectName,
  projectDescription,
  organizationId,
  organizations,
  isOrgAdmin,
  onProjectNameChange,
  onProjectDescriptionChange,
  onOrganizationIdChange,
  onSubmit,
  onReset,
  isLoading,
}: CreateProjectDialogProps) {
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
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new project for an organization
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isOrgAdmin ? (
            <div>
              <Label htmlFor="org-display">Organization</Label>
              <div
                id="org-display"
                className="mt-2 p-3 border rounded-md bg-muted/50"
              >
                {organizations.length > 0 ? (
                  <p className="font-medium">{organizations[0].name}</p>
                ) : (
                  <p className="text-muted-foreground">
                    Loading organization...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="org-select">Organization *</Label>
              <Select
                value={organizationId}
                onValueChange={onOrganizationIdChange}
              >
                <SelectTrigger id="org-select" className="mt-2">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={projectDescription}
              onChange={(e) => onProjectDescriptionChange(e.target.value)}
              placeholder="Project description"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
