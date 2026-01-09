import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import { requireAdmin } from "~/lib/adminMiddleware";
import { UserRole } from "~/lib/types/roles";
import { AdminLayout } from "../components/AdminLayout";
import { ProjectAnalyticsView } from "../components/admin/analytics";
import { auth } from "../lib/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  // Verify admin access
  await requireAdmin(request);

  const projectId = params.projectId;
  if (!projectId) {
    throw redirect("/admin/analytics");
  }

  return { projectId };
}

export function meta() {
  return [
    { title: "Project Analytics - Admin - Nowgai" },
    { name: "description", content: "Project analytics dashboard" },
  ];
}

export default function ProjectAnalyticsPage() {
  const loaderData = useLoaderData<{ projectId: string }>();
  const { user } = useAuth();
  const hasOrgAdminAccess = user?.hasOrgAdminAccess;

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="space-y-6">
          <ProjectAnalyticsView projectId={loaderData.projectId} isOrgAdmin={hasOrgAdminAccess} />
        </div>
      </div>
    </AdminLayout>
  );
}
