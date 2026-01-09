import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { AdminLayout } from "~/components/AdminLayout";
import { useState, useEffect } from "react";
import {
  FullAdminDashboard,
  OrgAdminDashboard,
  ProjectAdminDashboard,
  ProjectAdminGeneralSettings,
} from "~/components/admin/dashboard";
import { UserRole } from "~/lib/types/roles";
import {
  useDashboardStats,
  useOrganization,
  useOrgWallet,
  useProject,
  useProjectWallet,
  useProjectMembers,
  useStripeCheckout,
  useStripeVerify,
} from "~/hooks/useDashboard";
import { useAuth } from "~/hooks/useAuth";

export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure database connection
  await connectToDatabase();
  
  // Use requireAdmin to enforce access control
  // This will throw a 403 if user is only org_user without project_admin
  const user = await requireAdmin(request);

  return { user };
}

export function meta() {
  return [
    { title: "Admin Dashboard - Nowgai" },
    { name: "description", content: "Admin dashboard" },
  ];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess || false;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
  const isOrgAdmin = userRole === UserRole.ORG_ADMIN;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // Dialog states for org_admin
  const [addCreditsDialogOpen, setAddCreditsDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");

  // Full admin queries
  const { data: stats, isLoading: statsLoading } =
    useDashboardStats(isFullAdmin);

  // Org admin queries
  const { data: orgsData, isLoading: orgLoading } = useOrganization(isOrgAdmin);
  const organization = orgsData?.organizations?.[0];
  const { data: walletData } = useOrgWallet(
    organization?.id,
    !!organization?.id && isOrgAdmin
  );

  // Project admin queries
  const { data: projectsData, isLoading: projectsLoading } = useProject(
    isProjectAdmin && !isOrgAdmin && !isFullAdmin
  );
  const projects = projectsData?.projects || [];
  
  // State for selected project
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Set default selected project when projects load
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);
  
  // Get the selected project
  const project = projects.find((p) => p.id === selectedProjectId) || projects[0];
  
  const { data: projectWalletData } = useProjectWallet(
    project?.id,
    !!project?.id && isProjectAdmin && !isOrgAdmin && !isFullAdmin
  );
  const { data: projectMembersData } = useProjectMembers(
    project?.id,
    !!project?.id && isProjectAdmin && !isOrgAdmin && !isFullAdmin
  );

  // Mutations
  const stripeCheckoutMutation = useStripeCheckout(organization?.id);
  const stripeVerifyMutation = useStripeVerify(organization?.id, () => {
    setAddCreditsDialogOpen(false);
    setCreditAmount("");
  });

  // Check for payment success in URL and verify payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId && organization?.id) {
      stripeVerifyMutation.mutate({ sessionId });
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [organization?.id, stripeVerifyMutation]);

  const handleStripeCheckout = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    if (!organization) return;

    stripeCheckoutMutation.mutate({ amount });
  };

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Show general settings for project_admin */}
          {isProjectAdmin && !isOrgAdmin && !isFullAdmin && (
            <ProjectAdminGeneralSettings
              projects={projects}
              isLoading={projectsLoading}
            />
          )}

          {/* Show organization view for org_admin */}
          {isOrgAdmin && (
            <OrgAdminDashboard
              organization={organization}
              walletData={walletData?.wallet}
              isLoading={orgLoading}
              addCreditsDialogOpen={addCreditsDialogOpen}
              creditAmount={creditAmount}
              onAddCreditsDialogChange={setAddCreditsDialogOpen}
              onCreditAmountChange={setCreditAmount}
              onAddCredits={handleStripeCheckout}
              isAddingCredits={stripeCheckoutMutation.isPending}
            />
          )}

          {/* Full admin dashboard */}
          {isFullAdmin && (
            <FullAdminDashboard stats={stats} isLoading={statsLoading} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
