import { FolderOpen, UserGear } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";

import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import type { TeamMember } from "./TeamMembersTable";

export type ProjectRole = "project_admin" | "project_member";

interface Project {
  id: string;
  name: string;
  role: string;
  status?: string;
}

interface ManageRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  projects: Project[];
  isLoading?: boolean;
  isSaving?: boolean;
  showOrgRole?: boolean;
  onSave: (data: {
    memberId: string;
    orgRole: string;
    projectRoles: Array<{ projectId: string; role: ProjectRole }>;
  }) => void;
}

// Helper to get user initials
const getUserInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "U";
};



const projectRoleOptions: Array<{
  value: ProjectRole;
  label: string;
  description: string;
}> = [
  {
    value: "project_admin",
    label: "Project Admin",
    description: "Can manage project settings and members",
  },
  {
    value: "project_member",
    label: "Project Member",
    description: "Can access and work on the project",
  },
];

export function ManageRoleDialog({
  open,
  onOpenChange,
  member,
  projects,
  isLoading = false,
  isSaving = false,
  showOrgRole = true,
  onSave,
}: ManageRoleDialogProps) {
  // Normalize org role - member.role can be "project_admin" which is a display role
  // The actual org role should be "org_admin" or "org_user"
  const getOrgRole = (role: string | undefined): string => {
    if (!role) return "org_user";
    // Only "org_admin" is a valid org role, everything else defaults to "org_user"
    return role === "org_admin" ? "org_admin" : "org_user";
  };

  const [orgRole, setOrgRole] = useState(getOrgRole(member?.role));
  const [projectRoles, setProjectRoles] = useState<
    Record<string, ProjectRole>
  >({});

  // Initialize project roles from member's projects
  useEffect(() => {
    if (member?.projects) {
      const roles: Record<string, ProjectRole> = {};
      member.projects.forEach((p) => {
        // Normalize project role - map "member" to "project_member" for frontend
        const normalizedRole = p.role === "member" ? "project_member" : p.role;
        roles[p.id] = normalizedRole as ProjectRole;
      });
      setProjectRoles(roles);
    }
    // Update org role when member changes, normalizing it
    if (member?.role) {
      setOrgRole(getOrgRole(member.role));
    }
  }, [member]);

  const handleSave = () => {
    if (!member) return;

    // Filter out archived projects from role updates
    const activeProjectRoles = Object.entries(projectRoles)
      .filter(([projectId]) => {
        const project = projects.find((p) => p.id === projectId);
        return project && project.status !== "archived";
      })
      .map(([projectId, role]) => ({
        projectId,
        role,
      }));

    onSave({
      memberId: member.id,
      orgRole,
      projectRoles: activeProjectRoles,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleProjectRoleChange = (projectId: string, role: ProjectRole) => {
    setProjectRoles((prev) => ({
      ...prev,
      [projectId]: role,
    }));
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent
  className="max-w-lg p-0 bg-surface-1 border-subtle overflow-hidden max-h-[85vh]"
  onInteractOutside={(e) => {
    const target = e.target as HTMLElement;
    // Allow interaction with any Radix portaled content
    if (
      target?.hasAttribute('data-radix-popper-content-wrapper') ||
      target?.closest('[data-radix-popper-content-wrapper]')
    ) {
      e.preventDefault();
    }
  }}
  onPointerDownOutside={(e) => {
    const target = e.target as HTMLElement;
    if (
      target?.hasAttribute('data-radix-popper-content-wrapper') ||
      target?.closest('[data-radix-popper-content-wrapper]')
    ) {
      e.preventDefault();
    }
  }}
>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-subtle">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7b4cff]/20 to-[#a855f7]/20 border border-[#7b4cff]/30 flex items-center justify-center">
                <UserGear size={20} color="#a78bfa" />
              </div>
              <div>
                <DialogTitle className="text-[18px] font-semibold text-primary tracking-[-0.36px]">
                  Manage Role
                </DialogTitle>
                <p className="text-[13px] text-secondary tracking-[-0.26px]">
                  Update roles for this team member
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* User Info Card */}
          <div className="mt-4 p-3 bg-surface-2 rounded-lg border border-subtle">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-subtle">
                <AvatarImage src={member.image} alt={member.name} />
                <AvatarFallback className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white text-[12px] font-medium">
                  {getUserInitials(member.name, member.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-primary tracking-[-0.28px] truncate">
                  {member.name || "No name"}
                </p>
                <p className="text-[12px] text-tertiary tracking-[-0.24px] truncate">
                  {member.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto max-h-[400px]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full bg-surface-2" />
              <Skeleton className="h-24 w-full bg-surface-2" />
              <Skeleton className="h-24 w-full bg-surface-2" />
            </div>
          ) : (
            <>
              {/* Project Roles */}
              {projects.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                    Project Roles
                  </Label>
                  <div className="space-y-3">
                    {projects.map((project) => {
                      const normalizedRole = project.role === "member" ? "project_member" : project.role;
                      const currentRole =
                        projectRoles[project.id] || normalizedRole;
                      const isArchived = project.status === "archived";
                      return (
                        <div
                          key={project.id}
                          className={cn(
                            "p-4 rounded-lg border",
                            isArchived
                              ? "bg-surface-3 border-subtle opacity-60"
                              : "bg-surface-2 border-subtle"
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center flex-shrink-0">
                                <FolderOpen
                                  size={16}
                                  color="#727279"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-medium text-primary tracking-[-0.26px] truncate">
                                    {project.name}
                                  </p>
                                  {isArchived && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    >
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                                {isArchived && (
                                  <p className="text-[11px] text-tertiary mt-0.5">
                                    Role changes disabled for archived projects
                                  </p>
                                )}
                              </div>
                            </div>
                            <select
                              value={currentRole}
                              onChange={(e) =>
                                handleProjectRoleChange(
                                  project.id,
                                  e.target.value as ProjectRole
                                )
                              }
                              disabled={isArchived}
                              className={cn(
                                "h-9 w-[160px] bg-surface-1 border border-subtle text-primary rounded-lg text-[13px] px-3 focus:border-[#7b4cff] focus:ring-1 focus:ring-[#7b4cff]/20 focus:outline-none appearance-none cursor-pointer",
                                isArchived && "opacity-50 cursor-not-allowed"
                              )}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23727279' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "right 10px center",
                              }}
                            >
                              {projectRoleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current Roles Summary */}
              {member.projects && member.projects.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                    Current Assignments
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {member.projects.map((project) => (
                      <Badge
                        key={project.id}
                        className={cn(
                          "text-[11px] font-medium px-2.5 py-1 rounded-md border",
                          project.role === "project_admin"
                            ? "bg-[#ec4899]/20 text-[#f472b6] border-[#ec4899]/30"
                            : "bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/30"
                        )}
                      >
                        {project.role === "project_admin"
                          ? "Project Admin"
                          : "Project Member"}{" "}
                        → {project.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-subtle bg-surface-2">
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSaving}
              className="h-10 px-5 text-secondary hover:text-primary hover:bg-surface-2 font-medium rounded-lg transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-6 bg-gradient-to-r from-[#7b4cff] to-[#a855f7] hover:from-[#8c63f2] hover:to-[#b566f8] text-white font-medium rounded-lg shadow-lg shadow-[#7b4cff]/25 transition-all duration-200 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

