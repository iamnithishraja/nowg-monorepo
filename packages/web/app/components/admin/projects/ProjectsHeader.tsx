import { Separator } from "~/components/ui/separator";

interface ProjectsHeaderProps {
  isProjectAdmin: boolean;
  showArchived?: boolean;
  onShowArchivedChange?: (show: boolean) => void;
}

export function ProjectsHeader({ isProjectAdmin, showArchived = false, onShowArchivedChange }: ProjectsHeaderProps) {
  return (
    <div className="flex flex-col gap-0 pb-4">
      <div className="flex items-start justify-between w-full pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium text-primary">{isProjectAdmin ? "My Project" : "Projects"}</h1>
          <p className="text-base font-medium text-tertiary">
            Manage all your projects and track performance.
          </p>
        </div>
        {onShowArchivedChange && (
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-secondary">Show Archived</span>
          </label>
        )}
      </div>
      <Separator />
    </div>
  );
}

