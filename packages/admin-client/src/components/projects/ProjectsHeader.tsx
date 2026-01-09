import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ProjectsHeaderProps {
  isProjectAdmin: boolean;
  onCreateClick: () => void;
  canCreate: boolean;
}

export function ProjectsHeader({
  isProjectAdmin,
  onCreateClick,
  canCreate,
}: ProjectsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">
          {isProjectAdmin ? "My Project" : "Projects"}
        </h1>
        <p className="text-muted-foreground">
          {isProjectAdmin
            ? "View and manage your project"
            : "Manage projects and assign project admins"}
        </p>
      </div>
      {!isProjectAdmin && (
        <Button onClick={onCreateClick} disabled={!canCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      )}
    </div>
  );
}
