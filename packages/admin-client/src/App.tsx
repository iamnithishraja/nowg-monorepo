import { AdminSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
// import { CustomerSidebar } from "@/components/customer-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth-client";
import { client } from "@/lib/client";
import { ThemeProvider } from "@/lib/theme-provider";
import AdminDashboard from "@/pages/admin/dashboard";
import DocumentRequirementsPage from "@/pages/admin/document-requirements";
import FundRequests from "@/pages/admin/fund-requests";
import OrgWallet from "@/pages/admin/org-wallet";
import Organizations from "@/pages/admin/organizations";
import ProjectFundRequests from "@/pages/admin/project-fund-requests";
import ProjectMembers from "@/pages/admin/project-members";
import ProjectWallet from "@/pages/admin/project-wallet";
import Projects from "@/pages/admin/projects";
import UserProjectWallet from "@/pages/admin/user-project-wallet";
import Users from "@/pages/admin/users";
import AdminWallet from "@/pages/admin/wallet";
import Forbidden from "@/pages/forbidden";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import AcceptInvitation from "@/pages/organizations/accept";
import RejectInvitation from "@/pages/organizations/reject";
import AcceptOrgUserInvitation from "@/pages/organizations/user-accept";
import RejectOrgUserInvitation from "@/pages/organizations/user-reject";
import { USER_ROLE_DISPLAY_NAMES, getRoleBadgeVariant } from "@nowgai/shared/types";
import { useEffect, useState } from "react";
// import KYCManager from "@/pages/admin/kyc";
// import Plans from "@/pages/admin/plans";
import ApiKeys from "@/pages/admin/api-keys";
import TokenManagement from "@/pages/admin/tokens";
// import LLMConfigs from "@/pages/admin/llm-configs";
// import Billing from "@/pages/admin/billing";
// import CMSSettings from "@/pages/admin/cms";
import MarkupSettings from "@/pages/admin/markup";
import PaymentSettings from "@/pages/admin/payment-settings";
// import Affiliates from "@/pages/admin/affiliates";
// import WhiteLabel from "@/pages/admin/white-label";
// import AIAgents from "@/pages/admin/ai-agents";
import AnalyticsIndexPage from "@/pages/admin/analytics/index";
import OrganizationAnalyticsPage from "@/pages/admin/analytics/organization";
import ProjectAnalyticsPage from "@/pages/admin/analytics/project";
import UserAnalyticsPage from "@/pages/admin/analytics/user";
import GitPage from "@/pages/admin/microservices/git";
import NetlifyPage from "@/pages/admin/microservices/netlify";
import SupabasePage from "@/pages/admin/microservices/supabase";
import VercelPage from "@/pages/admin/microservices/vercel";
import OrganizationUsers from "@/pages/admin/organization-users";
import OrganizationsLedger from "@/pages/admin/organizations-ledger";
import ProjectsLedger from "@/pages/admin/projects-ledger";
import TransactionLedger from "@/pages/admin/transaction-ledger";
import SupportTickets from "@/pages/admin/support-tickets";
import Faqs from "@/pages/admin/faqs";
// import CustomerHome from "@/pages/customer/home";
// import Projects from "@/pages/customer/projects";
// import ProjectWorkspace from "@/pages/customer/project-workspace";
// import Wallet from "@/pages/customer/wallet";
// import Settings from "@/pages/customer/settings";

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen w-full">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-16 px-6 border-b gap-4">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">
                    {user.name || user.email}
                  </span>
                  <Badge
                    variant={getRoleBadgeVariant(user.role)}
                    className="text-xs"
                  >
                    {USER_ROLE_DISPLAY_NAMES[
                      user.role as keyof typeof USER_ROLE_DISPLAY_NAMES
                    ] || user.role}
                  </Badge>
                </div>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// function CustomerLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <div className="flex h-screen w-full">
//       <CustomerSidebar />
//       <div className="flex flex-col flex-1 overflow-hidden">
//         <header className="flex items-center justify-between h-16 px-6 border-b gap-4 flex-wrap">
//           <SidebarTrigger data-testid="button-sidebar-toggle" />
//           <div className="flex items-center gap-4 flex-wrap">
//             <ThemeToggle />
//           </div>
//         </header>
//         <main className="flex-1 overflow-auto">{children}</main>
//       </div>
//     </div>
//   );
// }

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated) {
        setIsCheckingAccess(false);
        setHasAccess(false);
        return;
      }

      try {
        // Use the dedicated check-access endpoint that queries database models directly
        // This checks OrganizationMember and ProjectMember tables, not just user.role
        const accessCheck = await client.get<{
          hasAccess: boolean;
          reason?: string;
          message?: string;
        }>("/api/admin/me/check-access");

        if (!accessCheck.hasAccess) {
          // Mark as denied and sign out
          setAccessDenied(true);
          setHasAccess(false);
          await signOut();
          toast({
            title: "Access Denied",
            description:
              accessCheck.message ||
              "You must be an admin or a member of an organization to access this platform.",
            variant: "destructive",
          });
          // Redirect to forbidden page first
          window.location.href = "/forbidden";
          return;
        }

        setHasAccess(true);
        setAccessDenied(false);
      } catch (error: any) {
        // If error (like 403), assume no access
        setAccessDenied(true);
        setHasAccess(false);
        await signOut();
        const errorMessage =
          error.message ||
          "Access denied. You must be an admin or a member of an organization to access this platform.";
        toast({
          title: "Access Denied",
          description: errorMessage,
          variant: "destructive",
        });
        // Redirect to forbidden page first
        window.location.href = "/forbidden";
      } finally {
        setIsCheckingAccess(false);
      }
    };

    if (!isLoading && isAuthenticated) {
      checkAccess();
    } else if (!isLoading && !isAuthenticated) {
      setIsCheckingAccess(false);
      setHasAccess(false);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (accessDenied || !hasAccess) {
    return <Redirect to="/forbidden" />;
  }

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forbidden" component={Forbidden} />
      <Route path="/organizations/accept" component={AcceptInvitation} />
      <Route path="/organizations/reject" component={RejectInvitation} />
      <Route
        path="/organizations/user/accept"
        component={AcceptOrgUserInvitation}
      />
      <Route
        path="/organizations/user/reject"
        component={RejectOrgUserInvitation}
      />

      {/* Admin Routes - Must come before "/" */}
      <Route path="/admin">
        <ProtectedAdminRoute>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Users />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/document-requirements">
        <ProtectedAdminRoute>
          <AdminLayout>
            <DocumentRequirementsPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      {/* Redirect /admin/organization to /admin (dashboard) */}
      <Route path="/admin/organization">
        <Redirect to="/admin" />
      </Route>
      <Route path="/admin/organizations">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Organizations />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/organizations/:organizationId/wallet">
        <ProtectedAdminRoute>
          <AdminLayout>
            <OrgWallet />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/organizations/:organizationId/users">
        <ProtectedAdminRoute>
          <AdminLayout>
            <OrganizationUsers />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Projects />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects/:projectId/wallet">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ProjectWallet />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects/:projectId/user-wallet/:userId">
        <ProtectedAdminRoute>
          <AdminLayout>
            <UserProjectWallet />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects/:projectId/members">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ProjectMembers />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects/:projectId/fund-requests">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ProjectFundRequests />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/fund-requests">
        <ProtectedAdminRoute>
          <AdminLayout>
            <FundRequests />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedAdminRoute>
          <AdminLayout>
            <AnalyticsIndexPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/analytics/user/:userId">
        <ProtectedAdminRoute>
          <AdminLayout>
            <UserAnalyticsPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/analytics/project/:projectId">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ProjectAnalyticsPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/analytics/organization/:organizationId">
        <ProtectedAdminRoute>
          <AdminLayout>
            <OrganizationAnalyticsPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/wallet">
        <ProtectedAdminRoute>
          <AdminLayout>
            <AdminWallet />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/ledger">
        <ProtectedAdminRoute>
          <AdminLayout>
            <TransactionLedger />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/organizations/ledger">
        <ProtectedAdminRoute>
          <AdminLayout>
            <OrganizationsLedger />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/projects/ledger">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ProjectsLedger />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      {/* Disabled routes - backend not implemented */}
      {/* <Route path="/admin/kyc">
        <ProtectedAdminRoute>
          <AdminLayout>
            <KYCManager />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/plans">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Plans />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      <Route path="/admin/tokens">
        <ProtectedAdminRoute>
          <AdminLayout>
            <TokenManagement />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/api-keys">
        <ProtectedAdminRoute>
          <AdminLayout>
            <ApiKeys />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/payment-settings">
        <ProtectedAdminRoute>
          <AdminLayout>
            <PaymentSettings />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/markup">
        <ProtectedAdminRoute>
          <AdminLayout>
            <MarkupSettings />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      {/* <Route path="/admin/llm-configs">
        <ProtectedAdminRoute>
          <AdminLayout>
            <LLMConfigs />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/billing">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Billing />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/cms">
        <ProtectedAdminRoute>
          <AdminLayout>
            <CMSSettings />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/affiliates">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Affiliates />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/white-label">
        <ProtectedAdminRoute>
          <AdminLayout>
            <WhiteLabel />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      {/* <Route path="/admin/ai-agents">
        <ProtectedAdminRoute>
          <AdminLayout>
            <AIAgents />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route> */}
      <Route path="/admin/microservices/vercel">
        <ProtectedAdminRoute>
          <AdminLayout>
            <VercelPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/microservices/netlify">
        <ProtectedAdminRoute>
          <AdminLayout>
            <NetlifyPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/microservices/supabase">
        <ProtectedAdminRoute>
          <AdminLayout>
            <SupabasePage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/microservices/git">
        <ProtectedAdminRoute>
          <AdminLayout>
            <GitPage />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/support-tickets">
        <ProtectedAdminRoute>
          <AdminLayout>
            <SupportTickets />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/faqs">
        <ProtectedAdminRoute>
          <AdminLayout>
            <Faqs />
          </AdminLayout>
        </ProtectedAdminRoute>
      </Route>
      <Route path="/admin/microservices">
        <Redirect to="/admin/microservices/vercel" />
      </Route>

      {/* Customer Routes - COMMENTED OUT */}
      {/* <Route path="/projects">
        <CustomerLayout>
          <Projects />
        </CustomerLayout>
      </Route> */}
      {/* <Route path="/projects/:id">
        <ProjectWorkspace />
      </Route> */}
      {/* <Route path="/wallet">
        <CustomerLayout>
          <Wallet />
        </CustomerLayout>
      </Route> */}
      {/* <Route path="/settings">
        <CustomerLayout>
          <Settings />
        </CustomerLayout>
      </Route> */}

      {/* Home Route - Must come last */}
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <Route path="/">
          <Redirect to="/admin" />
        </Route>
      )}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <Toaster />
            <Router />
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
