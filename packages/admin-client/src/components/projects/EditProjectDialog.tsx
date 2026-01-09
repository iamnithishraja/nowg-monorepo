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
import { ProjectType } from "./types";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectType | null;
  projectName: string;
  projectDescription: string;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  projectName,
  projectDescription,
  onProjectNameChange,
  onProjectDescriptionChange,
  onStatusChange,
  onSubmit,
  onReset,
  isLoading,
}: EditProjectDialogProps) {
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
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={projectDescription}
              onChange={(e) => onProjectDescriptionChange(e.target.value)}
              placeholder="Project description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={project?.status || "active"}
              onValueChange={onStatusChange}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
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
            {isLoading ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
