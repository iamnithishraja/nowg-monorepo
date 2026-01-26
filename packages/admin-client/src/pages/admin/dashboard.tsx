import {
    FullAdminDashboard,
    OrgAdminDashboard,
    ProjectAdminDashboard,
} from "@/components/dashboard";
import {
    useDashboardStats,
    useOrganization,
    useOrgWallet,
    useProject,
    useProjectMembers,
    useProjectWallet,
    useStripeCheckout,
    useStripeVerify,
} from "@/components/dashboard/hooks";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@nowgai/shared/types";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const { toast } = useToast();
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
  const project = projectsData?.projects?.[0];
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
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (!organization) return;

    stripeCheckoutMutation.mutate({ amount });
  };

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Show project view for project_admin */}
        {isProjectAdmin && !isOrgAdmin && !isFullAdmin && (
          <ProjectAdminDashboard
            project={project}
            walletData={projectWalletData?.wallet}
            membersData={projectMembersData?.members}
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
  );
}
