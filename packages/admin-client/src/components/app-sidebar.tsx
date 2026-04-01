import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth-client";
import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import {
    BarChart3,
    BookOpen,
    Building2,
    DollarSign,
    FolderKanban,
    Key,
    LayoutDashboard,
    LogOut,
    Settings,
    Users,
    // Home,
    Wallet,
    Zap,
    Headphones,
    HelpCircle,
} from "lucide-react";
import { SiGithub, SiNetlify, SiSupabase, SiVercel } from "react-icons/si";
import { Link, useLocation } from "wouter";

// Menu items configuration - some are admin-only
// Note: For project admin check, we check userRole for backward compatibility.
// The backend checks ProjectMember model for actual permissions.
// Eventually, the backend should send hasProjectAdminAccess flag in user object.
const getMenuGroups = (
  userRole?: string,
  hasProjectAdminAccess?: boolean,
  hasOrgAdminAccess?: boolean
) => {
  const isFullAdmin = hasAdminAccess(userRole);
  // Check both userRole and hasOrgAdminAccess flag (from middleware)
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  // Check both userRole (backward compatibility) and hasProjectAdminAccess flag
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;

  return [
    {
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/admin",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "User Management",
      items: [
        {
          title: "Users",
          url: "/admin/users",
          icon: Users,
        },
        ...(isFullAdmin
          ? [
              {
                title: "Organizations",
                url: "/admin/organizations",
                icon: Building2,
              },
              {
                title: "Org Doc Requirements",
                url: "/admin/document-requirements",
                icon: BookOpen,
              },
            ]
          : []),
        // Show projects for org admins and project admins
        ...(isOrgAdmin || isProjectAdmin
          ? [
              {
                title: isProjectAdmin ? "My Project" : "Projects",
                url: "/admin/projects",
                icon: FolderKanban,
              },
            ]
          : []),
        // {
        //   title: "KYC Manager",
        //   url: "/admin/kyc",
        //   icon: Shield,
        // },
        // Token Management is admin-only
        ...(isFullAdmin
          ? [
              {
                title: "Token Management",
                url: "/admin/tokens",
                icon: Zap,
              },
            ]
          : []),
      ],
    },
    // Analytics section - only for org admins and project admins (not full admins)
    ...(isOrgAdmin || isProjectAdmin
      ? [
          {
            label: "Analytics",
            items: [
              {
                title: "Analytics",
                url: "/admin/analytics",
                icon: BarChart3,
              },
            ],
          },
        ]
      : []),
    {
      label: "Payments & Billing",
      items: [
        {
          title: "Wallet",
          url: "/admin/wallet",
          icon: Wallet,
        },
        // Fund Requests - for org admins
        ...(isOrgAdmin
          ? [
              {
                title: "Fund Requests",
                url: "/admin/fund-requests",
                icon: DollarSign,
              },
            ]
          : []),
        ...(isFullAdmin
          ? [
              {
                title: "Payment Settings",
                url: "/admin/payment-settings",
                icon: Settings,
              },
            ]
          : []),
        // Transaction Ledger - available for full admins, org admins, and project admins
        ...(isFullAdmin
          ? [
              {
                title: "Transaction Ledger",
                url: "/admin/ledger",
                icon: BookOpen,
              },
            ]
          : isOrgAdmin
          ? [
              {
                title: "Transaction Ledger",
                url: "/admin/organizations/ledger",
                icon: BookOpen,
              },
            ]
          : isProjectAdmin
          ? [
              {
                title: "Transaction Ledger",
                url: "/admin/projects/ledger",
                icon: BookOpen,
              },
            ]
          : []),
        // Disabled - backend routes not implemented
        // {
        //   title: "Plans",
        //   url: "/admin/plans",
        //   icon: DollarSign,
        // },
        // {
        //   title: "Billing",
        //   url: "/admin/billing",
        //   icon: FileText,
        // },
      ],
    },
    // Only show API & Integrations section for full admins
    ...(isFullAdmin
      ? [
          {
            label: "API & Integrations",
            items: [
              {
                title: "API Keys",
                url: "/admin/api-keys",
                icon: Key,
              },
              {
                title: "Vercel",
                url: "/admin/microservices/vercel",
                icon: SiVercel,
              },
              {
                title: "Netlify",
                url: "/admin/microservices/netlify",
                icon: SiNetlify,
              },
              {
                title: "Supabase",
                url: "/admin/microservices/supabase",
                icon: SiSupabase,
              },
              {
                title: "Git",
                url: "/admin/microservices/git",
                icon: SiGithub,
              },
            ],
          },
          {
            label: "Support",
            items: [
              {
                title: "Support Tickets",
                url: "/admin/support-tickets",
                icon: Headphones,
              },
              {
                title: "FAQs",
                url: "/admin/faqs",
                icon: HelpCircle,
              },
            ],
          },
        ]
      : []),
    // Disabled - backend routes not implemented
    // {
    //   label: "Growth & Branding",
    //   items: [
    //     {
    //       title: "Affiliates",
    //       url: "/admin/affiliates",
    //       icon: Award,
    //     },
    //     {
    //       title: "White Label",
    //       url: "/admin/white-label",
    //       icon: Globe,
    //     },
    //     {
    //       title: "AI Agents",
    //       url: "/admin/ai-agents",
    //       icon: TrendingUp,
    //     },
    //   ],
    // },
    // {
    //   label: "Configuration",
    //   items: [
    //     {
    //       title: "CMS Settings",
    //       url: "/admin/cms",
    //       icon: Settings,
    //     },
    //   ],
    // },
  ];
};

export function AdminSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  // Type assertion for role - BetterAuth user type doesn't include role but it's available
  const userRole = (user as any)?.role;
  // Check for hasProjectAdminAccess flag (set by backend middleware)
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  // Check for hasOrgAdminAccess flag (set by backend middleware)
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const menuGroups = getMenuGroups(
    userRole,
    hasProjectAdminAccess,
    hasOrgAdminAccess
  );

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = "/login";
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "Could not logout",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-10 w-10 object-contain"
          />
          <div>
            <h2
              className="text-base font-semibold leading-none"
              data-testid="text-app-title"
            >
              Nowgai
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess
                ? "Organization Admin"
                : userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess
                ? "Project Admin"
                : "Admin Panel"}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="gap-3"
                    >
                      <Link
                        href={item.url}
                        data-testid={`link-${item.title
                          .toLowerCase()
                          .replace(/ /g, "-")}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        {/* <Link href="/">
          <Button
            variant="outline"
            className="w-full gap-2"
            data-testid="button-customer-view"
          >
            <Home className="h-4 w-4" />
            Customer View
          </Button>
        </Link> */}
        <Button
          variant="outline"
          className="w-full gap-2"
          data-testid="button-logout"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
