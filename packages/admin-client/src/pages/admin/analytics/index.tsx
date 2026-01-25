import { OrganizationAnalyticsView } from "@/components/analytics/OrganizationAnalyticsView";
import { ProjectAnalyticsView } from "@/components/analytics/ProjectAnalyticsView";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface OrganizationsResponse {
  organizations: Array<{ id: string; name: string }>;
}

interface ProjectsResponse {
  projects: Array<{ id: string; name: string; organizationId: string }>;
}

export default function AnalyticsIndexPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isFullAdmin = hasAdminAccess(userRole);
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const userOrganizationId = (user as any)?.organizationId;
  const userProjectId = (user as any)?.projectId;

  // If full admin, redirect to dashboard (they shouldn't access this route)
  useEffect(() => {
    if (isFullAdmin) {
      setLocation("/admin");
    }
  }, [isFullAdmin, setLocation]);

  // Fetch organization for org admin
  const { data: orgsData, isLoading: orgsLoading } =
    useQuery<OrganizationsResponse>({
      queryKey: ["/api/admin/organizations", "org-admin"],
      queryFn: () =>
        client.get<OrganizationsResponse>("/api/admin/organizations", {
          params: { page: 1, limit: 1 },
        }),
      enabled: isOrgAdmin && !isProjectAdmin,
      retry: 1,
    });

  // Fetch projects for project admin (fetch all projects they have access to)
  const { data: projectsData, isLoading: projectsLoading } =
    useQuery<ProjectsResponse>({
      queryKey: ["/api/admin/projects"],
      queryFn: () =>
        client.get<ProjectsResponse>("/api/admin/projects", {
          params: { page: 1, limit: 100 }, // Fetch all projects for dropdown
        }),
      enabled: isProjectAdmin && !isOrgAdmin,
      retry: 1,
    });

  // Show loading while fetching
  if (isOrgAdmin && orgsLoading) {
    return (
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="py-8">
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isProjectAdmin && projectsLoading) {
    return (
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="py-8">
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show organization analytics for org admin
  if (isOrgAdmin && !isProjectAdmin) {
    const organizationId =
      userOrganizationId || orgsData?.organizations?.[0]?.id;
    if (organizationId) {
      return (
        <div className="flex-1 p-8 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            <OrganizationAnalyticsView organizationId={organizationId} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No organization found. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show project analytics for project admin
  if (isProjectAdmin && !isOrgAdmin) {
    return (
      <div className="flex-1 p-8 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Project Analytics</h1>
            <p className="text-muted-foreground mt-2">
              View usage analytics and insights for your projects
            </p>
          </div>
          {projectsData && projectsData.projects && projectsData.projects.length > 0 ? (
            <ProjectAnalyticsView
              projects={projectsData.projects}
              defaultProjectId={userProjectId || projectsData.projects[0]?.id}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No projects found. Please contact support.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // If user is neither org admin nor project admin, redirect
  useEffect(() => {
    if (!isOrgAdmin && !isProjectAdmin && !isFullAdmin) {
      setLocation("/admin");
    }
  }, [isOrgAdmin, isProjectAdmin, isFullAdmin, setLocation]);

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Loading analytics...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
