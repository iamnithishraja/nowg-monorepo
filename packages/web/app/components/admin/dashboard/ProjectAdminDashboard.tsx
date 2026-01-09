import {
    Buildings,
    FolderSimple,
    UserPlus,
    Users,
    Wallet,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { DashboardHeader } from "./DashboardHeader";
import { QuickActionsCard } from "./QuickActionsCard";
import type { ProjectMember, ProjectType, WalletData } from "./types";

interface ProjectAdminDashboardProps {
  project: ProjectType | undefined;
  projects: ProjectType[];
  walletData: WalletData | undefined;
  membersData: ProjectMember[] | undefined;
  isLoading: boolean;
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

export function ProjectAdminDashboard({
  project,
  projects,
  walletData,
  membersData,
  isLoading,
  selectedProjectId,
  onProjectChange,
}: ProjectAdminDashboardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <>
        <DashboardHeader />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader className="border-b px-5 py-2.5">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardContent className="py-8">
          <div className="text-center text-tertiary">
            <p>No project found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasMultipleProjects = projects.length > 1;

  const membersCount = membersData?.length || 0;

  const quickActions = [
    {
      title: "Manage Members",
      description: "Add or remove team members",
      icon: UserPlus,
      href: `/admin/projects/${project.id}/members`,
    },
    {
      title: "View Project",
      description: "View project details and settings",
      icon: FolderSimple,
      href: "/admin/projects",
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <DashboardHeader subtitle={project.name} />
        {hasMultipleProjects && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-secondary tracking-[-0.26px]">Project:</span>
            <Select
              value={selectedProjectId || project.id}
              onValueChange={onProjectChange}
            >
              <SelectTrigger className="w-64 bg-surface-2 border-subtle text-primary">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-subtle">
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Project Wallet Balance */}
        <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
          <CardHeader className="border-b border-subtle px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Project Wallet</CardTitle>
                <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">
                  Current credits available for your project
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/admin/projects/${project.id}/wallet`)
                }
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
              >
                <Wallet className="h-4 w-4 mr-2" weight="fill" />
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[28px] font-bold text-[#7b4cff] tracking-[-0.56px]">
                  ${walletData?.balance?.toFixed(2) || "0.00"}
                </div>
                <p className="text-[13px] text-secondary mt-1 tracking-[-0.26px]">
                  {walletData?.balance || 0} credits available
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Members */}
        <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
          <CardHeader className="border-b border-subtle px-5 py-3">
            <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Team Members</CardTitle>
            <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">Active members in your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[28px] font-bold text-[#7b4cff] tracking-[-0.56px]">
                  {membersCount}
                </div>
                <p className="text-[13px] text-secondary mt-1 tracking-[-0.26px]">
                  {membersCount === 1 ? "member" : "members"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/admin/projects/${project.id}/members`)
                }
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
              >
                <Users className="h-4 w-4 mr-2" weight="fill" />
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Organization */}
        <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
          <CardHeader className="border-b border-subtle px-5 py-3">
            <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Organization</CardTitle>
            <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">Your project's organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-primary">
                  {project.organization?.name || "N/A"}
                </div>
                <p className="text-[13px] text-secondary mt-1 tracking-[-0.26px]">
                  Organization
                </p>
              </div>
              <Buildings className="h-8 w-8 text-tertiary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details and Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Project Details */}
        <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
          <CardHeader className="border-b border-subtle px-5 py-3">
            <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Project Details</CardTitle>
            <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">
              Basic information about your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                Name
              </label>
              <p className="text-[14px] font-medium mt-1 text-primary">{project.name}</p>
            </div>
            <div>
              <label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                Description
              </label>
              <p className="text-[14px] mt-1 text-primary">
                {project.description || "No description provided"}
              </p>
            </div>
            <div>
              <label className="text-[13px] font-medium text-secondary tracking-[-0.26px]">
                Status
              </label>
              <div className="mt-1">
                <Badge
                  variant={
                    project.status === "active" ? "default" : "secondary"
                  }
                  className={project.status === "active" ? "bg-success-500/20 text-[#22c55e] border-[#22c55e]/30" : "bg-surface-2 text-secondary border-subtle"}
                >
                  {project.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <QuickActionsCard actions={quickActions} />
      </div>
    </>
  );
}

