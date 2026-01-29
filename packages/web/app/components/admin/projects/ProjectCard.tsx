import {
  PencilSimple,
  ArrowSquareOut,
  Folder,
  DotsThree,
  Plus,
  Trash,
  UserPlus,
  Users,
  Wallet,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { ProjectType } from "./types";

interface CreateProjectCardProps {
  onClick: () => void;
  disabled?: boolean;
}

export function CreateProjectCard({
  onClick,
  disabled,
}: CreateProjectCardProps) {
  return (
    <div
      className="cursor-pointer group w-[380px]"
      onClick={disabled ? undefined : onClick}
    >
      {/* Card Container - matches Figma exactly */}
      <div className="border-2 border-dashed border-active rounded-[12px] h-[246px] overflow-hidden relative flex items-center justify-center hover:border-accent-primary transition-colors">
        <div className="bg-[rgba(161,161,170,0.1)] p-3 rounded-full group-hover:bg-[rgba(123,76,255,0.15)] transition-colors">
          <Plus className="w-10 h-10 text-secondary group-hover:text-accent-primary transition-colors" weight="bold" />
        </div>
      </div>
      {/* Label - 12px gap from card */}
      <div className="mt-3">
        <p
          className="text-primary text-[16px] font-medium tracking-[-0.32px] leading-[1.4]"
          style={{ fontFamily: "'Satoshi Variable', sans-serif" }}
        >
          Create new project
        </p>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectType;
  isProjectAdmin: boolean;
  onEdit: (project: ProjectType) => void;
  onAssignAdmin: (project: ProjectType) => void;
  onUnassignAdmin: (project: ProjectType) => void;
  onDelete: (project: ProjectType) => void;
  onManageMembers: (project: ProjectType) => void;
  isUnassigning: boolean;
}

export function ProjectCard({
  project,
  isProjectAdmin,
  onEdit,
  onAssignAdmin,
  onUnassignAdmin,
  onDelete,
  onManageMembers,
  isUnassigning,
}: ProjectCardProps) {
  const navigate = useNavigate();

  // Use project.imageUrl for the preview image
  const previewImage = project.imageUrl;

  const handleCardClick = () => {
    navigate(`/admin/analytics/project/${project.id}`);
  };

  const handleGoToWorkspace = () => {
    navigate(`/workspace?conversationId=${project.conversationId}`);
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `Edited ${diffMins} min ago`;
    if (diffHours < 24)
      return `Edited ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7)
      return `Edited ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return `Edited ${date.toLocaleDateString()}`;
  };

  return (
    <div className="group w-[380px]">
      {/* Card Container - 380x246px with 2px border, 12px radius */}
      <div
        className="border-2 border-subtle rounded-[12px] h-[246px] overflow-hidden relative cursor-pointer hover:border-accent-primary/50 transition-colors"
        onClick={handleCardClick}
      >
        {/* Project Preview - Image or Placeholder */}
        {previewImage ? (
          <>
            <div className="absolute inset-0">
              <img
                src={previewImage}
                alt={project.name}
                className="w-full h-full object-cover object-top"
              />
            </div>
            {/* Gradient overlay - subtle fade at bottom */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 75%, rgba(0,0,0,0.6) 100%)",
              }}
            />
          </>
        ) : (
          <>
            {/* No Image - Placeholder similar to user avatar */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#7b4cff]/20 via-[#6366f1]/15 to-[#8b5cf6]/20 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7b4cff]/30 to-[#8b5cf6]/30 flex items-center justify-center border border-[#7b4cff]/20">
                  <Folder className="w-10 h-10 text-[#a78bfa]" weight="fill" />
                </div>
                <p className="text-[#a78bfa]/60 text-[13px] font-medium">
                  No image
                </p>
              </div>
            </div>
            {/* Gradient overlay for placeholder */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.8) 100%)",
              }}
            />
          </>
        )}
      </div>

      {/* Info Section - 12px gap from card */}
      <div className="mt-3 flex items-center justify-between pr-3">
        <div className="flex flex-col gap-[2px] flex-1 min-w-0">
          <p
            className="text-primary text-[16px] font-medium tracking-[-0.32px] leading-[1.4] truncate"
            style={{ fontFamily: "'Satoshi Variable', sans-serif" }}
          >
            {project.name}
          </p>
          <p
            className="text-secondary text-[13px] tracking-[-0.26px] leading-[1.4]"
            style={{ fontFamily: "'Satoshi Variable', sans-serif" }}
          >
            {formatTimeAgo(project.updatedAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 transition-opacity hover:bg-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <DotsThree className="h-5 w-5 text-primary" weight="bold" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-surface-1 border-subtle"
          >
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleGoToWorkspace();
              }}
              className="cursor-pointer"
            >
              <ArrowSquareOut className="h-4 w-4 mr-2 text-secondary" />
              <span>Go to Workspace</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onManageMembers(project);
              }}
              className="cursor-pointer"
            >
              <Users className="h-4 w-4 mr-2 text-secondary" weight="fill" />
              <span>Manage Team Members</span>
            </DropdownMenuItem>
            {!isProjectAdmin && (
              <>
                <DropdownMenuSeparator className="bg-subtle" />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                  className="cursor-pointer"
                >
                  <PencilSimple className="h-4 w-4 mr-2 text-secondary" />
                  <span>Edit Project</span>
                </DropdownMenuItem>
                {(!project.projectAdmin ||
                  project.invitationStatus !== "accepted") && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssignAdmin(project);
                    }}
                    className="cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4 mr-2 text-secondary" weight="fill" />
                    <span>Assign Project Admin</span>
                  </DropdownMenuItem>
                )}
                {project.projectAdmin && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnassignAdmin(project);
                    }}
                    disabled={isUnassigning}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash className="h-4 w-4 mr-2" weight="fill" />
                    <span>Unassign Project Admin</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-subtle" />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" weight="fill" />
                  <span>Archive Project</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
