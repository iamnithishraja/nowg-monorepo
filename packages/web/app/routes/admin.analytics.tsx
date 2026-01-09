import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import {
  OrganizationAnalyticsView,
  ProjectAnalyticsView,
} from "../components/admin/analytics";
import { AdminLayout } from "../components/AdminLayout";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { adminClient } from "../lib/adminClient";
import { auth } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Analytics - Admin - Nowgai" },
    { name: "description", content: "Analytics dashboard" },
  ];
}

interface OrganizationsResponse {
  organizations: Array<{ id: string; name: string }>;
}

interface ProjectsResponse {
  projects: Array<{ id: string; name: string; organizationId: string }>;
}

export default function AdminAnalytics() {
  const loaderData = useLoaderData<{ user: any }>();
  const { user: authUser, isLoading: authLoading } = useAuth();

  // Use auth hook user (has org admin flags) or fallback to loader data
  const user = authUser || loaderData?.user || null;

  const [orgsData, setOrgsData] = useState<OrganizationsResponse | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsResponse | null>(
    null
  );
  const isLoading = authLoading;

  const userRole = user?.role;
  const hasOrgAdminAccess = user?.hasOrgAdminAccess || false;
  const hasProjectAdminAccess = user?.hasProjectAdminAccess || false;
  const isProjectAdmin = userRole === "project_admin" || hasProjectAdminAccess;
  const isOrgAdmin = userRole === "org_admin" || hasOrgAdminAccess;
  const isFullAdmin = userRole === "admin" || userRole === "tech_support";

  // Fetch organization for org admin
  useEffect(() => {
    if (isOrgAdmin && !isProjectAdmin) {
      const fetchOrg = async () => {
        try {
          const data = await adminClient.get<OrganizationsResponse>(
            "/api/admin/organizations",
            {
              params: { page: 1, limit: 1 },
            }
          );
          setOrgsData(data);
        } catch (error) {
          console.error("Failed to fetch organization:", error);
        }
      };

      fetchOrg();
    }
  }, [isOrgAdmin, isProjectAdmin]);

  // Fetch projects for project admin (fetch all projects they have access to)
  useEffect(() => {
    if (isProjectAdmin && !isOrgAdmin) {
      const fetchProjects = async () => {
        try {
          const data = await adminClient.get<ProjectsResponse>(
            "/api/admin/projects",
            {
              params: { page: 1, limit: 100 }, // Fetch all projects for dropdown
            }
          );
          setProjectsData(data);
        } catch (error) {
          console.error("Failed to fetch projects:", error);
        }
      };

      fetchProjects();
    }
  }, [isProjectAdmin, isOrgAdmin]);

  // Redirect full admin - wait for auth to load first
  useEffect(() => {
    if (!authLoading && isFullAdmin) {
      window.location.href = "/admin";
    }
  }, [authLoading, isFullAdmin]);

  // If user is neither org admin nor project admin, redirect - wait for auth to load first
  useEffect(() => {
    if (!authLoading && !isOrgAdmin && !isProjectAdmin && !isFullAdmin && user) {
      window.location.href = "/admin";
    }
  }, [authLoading, isOrgAdmin, isProjectAdmin, isFullAdmin, user]);

  // Show loading while fetching
  if (
    isLoading ||
    (isOrgAdmin && !orgsData) ||
    (isProjectAdmin && !projectsData)
  ) {
    return (
      <AdminLayout>
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-[12px] bg-surface-1 border border-subtle">
                  <Card className="bg-transparent border-0 shadow-none">
                    <CardContent className="py-8">
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show organization analytics for org admin
  if (isOrgAdmin && !isProjectAdmin) {
    const organizationId =
      user?.organizationId || orgsData?.organizations?.[0]?.id;
    if (organizationId) {
      return (
        <AdminLayout>
          <div className="flex-1 p-6">
            <div className="space-y-6">
              <OrganizationAnalyticsView organizationId={organizationId} />
            </div>
          </div>
        </AdminLayout>
      );
    }
    return (
      <AdminLayout>
        <div className="flex-1 p-6 bg-canvas">
          <div>
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="py-8">
                  <p className="text-center text-tertiary">
                    No organization found. Please contact support.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show project analytics for project admin
  if (isProjectAdmin && !isOrgAdmin) {
    return (
      <AdminLayout>
        <div className="flex-1 p-6 bg-canvas">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-primary">Project Analytics</h1>
              <p className="text-secondary mt-2">
                View usage analytics and insights for your projects
              </p>
            </div>
            {projectsData && projectsData.projects && projectsData.projects.length > 0 ? (
              <ProjectAnalyticsView
                projects={projectsData.projects}
                defaultProjectId={user?.projectId || projectsData.projects[0]?.id}
                isOrgAdmin={isOrgAdmin}
              />
            ) : (
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardContent className="py-8">
                    <p className="text-center text-tertiary">
                      No projects found. Please contact support.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 p-6 bg-canvas">
        <div>
          <div className="rounded-[12px] bg-surface-1 border border-subtle">
            <Card className="bg-transparent border-0 shadow-none">
              <CardContent className="py-8">
                <p className="text-center text-tertiary">
                  Loading analytics...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
