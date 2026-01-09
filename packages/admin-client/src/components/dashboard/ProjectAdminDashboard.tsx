import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Users,
  Building2,
  UserPlus,
  FolderKanban,
  Activity,
} from "lucide-react";
import { DashboardHeader } from "./DashboardHeader";
import { QuickActionsCard } from "./QuickActionsCard";
import { ProjectType, WalletData, ProjectMember } from "./types";

interface ProjectAdminDashboardProps {
  project: ProjectType | undefined;
  walletData: WalletData | undefined;
  membersData: ProjectMember[] | undefined;
  isLoading: boolean;
}

export function ProjectAdminDashboard({
  project,
  walletData,
  membersData,
  isLoading,
}: ProjectAdminDashboardProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div className="text-center py-8">Loading project...</div>;
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>No project found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
      icon: FolderKanban,
      href: "/admin/projects",
    },
  ];

  return (
    <>
      <DashboardHeader subtitle={project.name} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Project Wallet Balance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Project Wallet</CardTitle>
                <CardDescription>
                  Current credits available for your project
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(`/admin/projects/${project.id}/wallet`)
                }
              >
                <Wallet className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold text-primary">
                  ${walletData?.balance?.toFixed(2) || "0.00"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {walletData?.balance || 0} credits available
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Active members in your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold text-primary">
                  {membersCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {membersCount === 1 ? "member" : "members"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(`/admin/projects/${project.id}/members`)
                }
              >
                <Users className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your project's organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-lg font-semibold">
                  {project.organization?.name || "N/A"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Organization
                </p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details and Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Basic information about your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-base font-medium mt-1">{project.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p className="text-base mt-1">
                {project.description || "No description provided"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <div className="mt-1">
                <Badge
                  variant={
                    project.status === "active" ? "default" : "secondary"
                  }
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
