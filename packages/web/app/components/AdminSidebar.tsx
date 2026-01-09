import {
  ArrowLeft,
  BarChart3,
  Building2,
  Database,
  DollarSign,
  GitBranch,
  Key,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { useState } from "react";
import logo from "~/assets/logo.png";
import { Button } from "./ui/button";
import { Icon } from "./Icon";
import { useOrganization } from "~/hooks/useDashboard";
import { useProjectAdminUsers } from "~/components/admin/users/hooks";
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
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";
import { Avatar, AvatarFallback } from "./ui/avatar";

// Role types
enum UserRole {
  USER = "user",
  ADMIN = "admin",
  ORG_ADMIN = "org_admin",
  TECH_SUPPORT = "tech_support",
  PROJECT_ADMIN = "project_admin",
  ORG_USER = "org_user",
}

function hasAdminAccess(role?: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.TECH_SUPPORT;
}

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
  // Default to showing org admin items if userRole is undefined but hasOrgAdminAccess is true
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  // Check both userRole (backward compatibility) and hasProjectAdminAccess flag
  // Default to showing project admin items if userRole is undefined but hasProjectAdminAccess is true
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;

  return [
    {
      label: "Organization",
      items: [
        {
          title: "General",
          url: "/admin",
          icon: "GearSix",
          iconType: "phosphor" as const,
        },
        {
          title: "Users",
          url: "/admin/users",
          icon: "UsersThree",
          iconType: "phosphor" as const,
        },
        // Show organizations link only for full admins (org_admins see org info on dashboard)
        ...(isFullAdmin
          ? [
              {
                title: "Organizations",
                url: "/admin/organizations",
                icon: Building2,
                iconType: "lucide" as const,
              },
            ]
          : []),
        // Show projects for org admins and project admins
        ...(isOrgAdmin || isProjectAdmin
          ? [
              {
                title: isProjectAdmin ? "My Project" : "Projects",
                url: "/admin/projects",
                icon: "Cardholder",
                iconType: "phosphor" as const,
              },
            ]
          : []),
        // Credits & Billing - hide for project_admin
        ...(!isProjectAdmin || isOrgAdmin || isFullAdmin
          ? [
              {
                title: "Credits & Billing",
                url: "/admin/wallet",
                icon: "PokerChip",
                iconType: "phosphor" as const,
              },
            ]
          : []),
        // Fund Requests - for org admins and project admins
        ...(isOrgAdmin || isProjectAdmin
          ? [
              {
                title: "Fund Requests",
                url: "/admin/fund-requests",
                icon: DollarSign,
                iconType: "lucide" as const,
              },
            ]
          : []),
        // Wallet Transactions - available for full admins, org admins, and project admins
        ...(isFullAdmin
          ? [
              {
                title: "Wallet Transactions",
                url: "/admin/ledger",
                icon: "Wallet",
                iconType: "phosphor" as const,
              },
            ]
          : isOrgAdmin
          ? [
              {
                title: "Wallet Transactions",
                url: "/admin/organizations/ledger",
                icon: "Wallet",
                iconType: "phosphor" as const,
              },
            ]
          : isProjectAdmin
          ? [
              {
                title: "Wallet Transactions",
                url: "/admin/projects/ledger",
                icon: "Wallet",
                iconType: "phosphor" as const,
              },
            ]
          : []),
        // Analytics - for org admins and project admins
        ...(isOrgAdmin || isProjectAdmin
          ? [
              {
                title: "Analytics",
                url: "/admin/analytics",
                icon: BarChart3,
                iconType: "lucide" as const,
              },
            ]
          : []),
        // Token Management is admin-only
        ...(isFullAdmin
          ? [
              {
                title: "Token Management",
                url: "/admin/tokens",
                icon: Zap,
                iconType: "lucide" as const,
              },
            ]
          : []),
      ],
    },
    // Integrations section
    ...(isFullAdmin
      ? [
          {
            label: "Integrations",
            items: [
              {
                title: "API Keys",
                url: "/admin/api-keys",
                icon: Key,
                iconType: "lucide" as const,
              },
              {
                title: "Github",
                url: "/admin/microservices/git",
                icon: GitBranch,
                iconType: "lucide" as const,
              },
              {
                title: "Vercel",
                url: "/admin/microservices/vercel",
                icon: ({ className }: { className?: string }) => (
                  <svg
                    className={className}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 1L24 22H0L12 1Z" />
                  </svg>
                ),
                iconType: "custom" as const,
              },
              {
                title: "Supabase",
                url: "/admin/microservices/supabase",
                icon: Database,
                iconType: "lucide" as const,
              },
              {
                title: "Netlify",
                url: "/admin/microservices/netlify",
                icon: ({ className }: { className?: string }) => (
                  <svg
                    className={className}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23l2.349-1.045-2.192-2.171-.491 2.954zM12.06 6.546a1.305 1.305 0 0 1 .209.574l3.497 1.482a1.044 1.044 0 0 1 .355-.177l.574-3.55-2.13-2.234-2.505 3.905zm-1.037 6.62l-3.614.67a1.077 1.077 0 0 1-.035.252l2.46 1.946 1.189-2.868zm-.086-1.229l.315-.145a1.044 1.044 0 0 1-.083-.408l-3.746-1.491-.971 3.025 4.485-.981zm-.805-5.786l1.91 2.984 2.37-3.699-1.335-1.398-2.945 2.113zm-3.07 1.344l-.14-.39-1.01 3.063 3.083-.678-.232-.625-1.7-1.37zm12.473 2.997L17.12 12.62l-.005.02 2.332 2.165.079-3.32zm-.64-5.005l1.803 1.788.243-1.238-1.873-.663-.173.113zm-6.104-4.08l3.131 3.28L17.71 4.86l-3.073-1.063-3.193 1.36zm9.913 3.835l-.749.279 2.093 2.082.01-.418-1.354-1.943zM7.522 8.087l-.252-.704-2.945 2.11 1.689.672 1.508-2.078zm6.731 9.21l-3.258-2.608-.06.174 1.282 3.095 2.036-.661zm-6.07-3.665l-1.86 1.482 3.296.852-.283-.698-1.152-1.636zm3.805-1.836a1.044 1.044 0 0 1-.121-.542l-.537-.228-1.293 3.118 2.209-2.09-.258-.258zm2.344-2.058l4.062-1.88-.016-.063-3.534-1.498a1.044 1.044 0 0 1-.248.369l-.264 3.072zm-9.94 4.665l2.312 3.282 1.319-1.05-1.79-4.244-1.841 2.012zm-1.2-3.49l.92-.657-.503-1.386L3 11.16l.19-.25zM14.658 19.77l-3.8-1.292 2.196 3.305 1.604-2.013zm-5.154-1.09l-3.194-.855.238.548 6.138 2.132-3.182-1.825zm12.037-2.163l-4.038-3.755-.002.023-.134 3.19 4.174.542zm-.756-3.993l-3.096-2.88-.131 3.054a1.047 1.047 0 0 1 .378.286l2.849-.46zm-1.636 5.329l-3.986-.513-.143 3.368 4.129-2.855zm-5.065-1.32l-3.21 1.044 2.98 1.732.23-2.776zm2.09 2.15l-.025.002.062 1.464 1.91-1.322-1.947-.143zm-7.424-.65l-.248-.348-1.802 1.442 1.348-.007 2.324-.803-1.622-.284zm-2.08-3.285l.46-1.432-.946 3.003.486-1.571z" />
                  </svg>
                ),
                iconType: "custom" as const,
              },
            ],
          },
        ]
      : []),
  ];
};

interface AdminSidebarProps {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    hasOrgAdminAccess?: boolean;
    hasProjectAdminAccess?: boolean;
    image?: string | null;
    picture?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    photoURL?: string | null;
  };
  isLoading?: boolean;
}

// Get user initials for avatar
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

// User initials helper
const userInitials = (nameOrEmail?: string): string => {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 1) {
    const handle = nameOrEmail.includes("@")
      ? nameOrEmail.split("@")[0]
      : nameOrEmail;
    return handle.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// User Account Item Component with Image Support
function UserAccountItem({ user }: { user?: AdminSidebarProps["user"] }) {
  const [broken, setBroken] = useState(false);
  const displayName = user?.name || user?.email;
  const imageUrl =
    (user &&
      (user.image ||
        user.picture ||
        user.avatar ||
        user.avatarUrl ||
        user.photoURL)) ||
    undefined;

  const AvatarComponent = () => {
    if (imageUrl && !broken) {
      return (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setBroken(true)}
          className="h-8 w-8 rounded-full object-cover border border-[#1a1a1a]"
        />
      );
    }
    const initials = displayName ? userInitials(displayName) : "";
    return (
      <div className="h-8 w-8 rounded-full bg-[#7b4cff]/20 text-[#a78bfa] flex items-center justify-center text-[12px] font-semibold border border-[#1a1a1a]">
        {initials ? initials : <UserIcon className="w-4 h-4 text-[#a78bfa]" />}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#0a0a0a] transition-colors cursor-pointer">
      <AvatarComponent />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-white tracking-[-0.2px] truncate">
          {user?.name || user?.email?.split("@")[0] || "User"}
        </div>
        {user?.email && (
          <div className="text-[11px] text-[#525252] tracking-[-0.2px] truncate mt-0.5">
            {user.email}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminSidebar({ user, isLoading }: AdminSidebarProps) {
  const location = useLocation();

  // Type assertion for role - BetterAuth user type doesn't include role but it's available
  const userRole = user?.role;
  // Check for hasProjectAdminAccess flag (set by backend middleware)
  const hasProjectAdminAccess = user?.hasProjectAdminAccess;
  // Check for hasOrgAdminAccess flag (set by backend middleware)
  const hasOrgAdminAccess = user?.hasOrgAdminAccess;

  // Fetch organization data for org admins
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const { data: orgsData } = useOrganization(isOrgAdmin);
  const organization = orgsData?.organizations?.[0];
  
  // Fetch organization data for project admins
  const { data: projectAdminData } = useProjectAdminUsers(isProjectAdmin && !isOrgAdmin);
  const projectAdminOrganization = projectAdminData?.organization;
  
  // Use project admin organization if available, otherwise use org admin organization
  const displayOrganization = projectAdminOrganization || organization;
  const shouldShowOrgLogo = (isOrgAdmin || isProjectAdmin) && displayOrganization;

  const menuGroups = getMenuGroups(
    userRole,
    hasProjectAdminAccess,
    hasOrgAdminAccess
  );

  if (isLoading) {
    return (
      <Sidebar
        collapsible="offcanvas"
        variant="sidebar"
        className="z-40 border-r border-[#1a1a1a] bg-black"
      >
        <SidebarHeader className="bg-black border-b border-[#1a1a1a] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center">
              <Skeleton className="h-5 w-5 rounded-md bg-[#1a1a1a]" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1 bg-[#1a1a1a]" />
              <Skeleton className="h-3 w-32 bg-[#1a1a1a]" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden bg-black">
          {[...Array(3)].map((_, groupIndex) => (
            <SidebarGroup key={groupIndex} className="mb-6">
              <SidebarGroupLabel className="px-2 py-1 mb-2">
                <Skeleton className="h-3 w-20 bg-[#1a1a1a]" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {[...Array(4)].map((_, itemIndex) => (
                    <SidebarMenuItem key={itemIndex}>
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-md">
                        <Skeleton className="h-4 w-4 rounded bg-[#1a1a1a]" />
                        <Skeleton className="h-4 w-28 bg-[#1a1a1a]" />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-[#1a1a1a] p-4 bg-black">
          <Skeleton className="h-10 w-full rounded-md bg-[#1a1a1a]" />
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      className="z-40 border-r border-[#1a1a1a] bg-black"
    >
      <SidebarHeader className="bg-black border-b border-[#1a1a1a] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8b5cf6]/20 to-[#6366f1]/20 flex items-center justify-center border border-[#8b5cf6]/30 overflow-hidden">
            {shouldShowOrgLogo && displayOrganization?.logoUrl ? (
              <img
                src={displayOrganization.logoUrl}
                alt={displayOrganization.name || "Organization"}
                className="h-full w-full object-cover"
              />
            ) : shouldShowOrgLogo && displayOrganization ? (
              <Building2 className="h-5 w-5 text-[#a78bfa]" />
            ) : (
              <img
                src={logo}
                alt="Nowgai admin"
                className="h-5 w-5 object-contain"
              />
            )}
          </div>
          <div>
            <h2
              className="text-sm font-semibold leading-none text-white tracking-[-0.2px]"
              data-testid="text-app-title"
            >
              {shouldShowOrgLogo && displayOrganization?.name
                ? displayOrganization.name
                : "Nowgai Admin"}
            </h2>
            <p className="text-[11px] text-[#525252] mt-1 tracking-[-0.2px]">
              {userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess
                ? "Organization Admin"
                : userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess
                ? "Project Admin"
                : "Admin Panel"}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden bg-black">
        {(() => {
          // Collect all menu items from all groups to determine active state
          const allMenuItems = menuGroups.flatMap((group) => group.items);
          
          // Find the most specific matching menu item
          // Sort by URL length (descending) to prioritize more specific routes
          const sortedItems = [...allMenuItems].sort(
            (a, b) => b.url.length - a.url.length
          );
          
          // Find the most specific matching item
          const activeItem = sortedItems.find((item) => {
            // Exact match
            if (location.pathname === item.url) {
              return true;
            }
            // Prefix match (but not for /admin to prevent matching /admin/analytics)
            if (
              item.url !== "/admin" &&
              location.pathname.startsWith(item.url + "/")
            ) {
              return true;
            }
            return false;
          });

          return menuGroups.map((group) => (
            <SidebarGroup key={group.label} className="mb-6">
              <SidebarGroupLabel className="px-2 py-1 text-[11px] font-medium tracking-[0.5px] text-[#525252] uppercase mb-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {group.items.map((item) => {
                    // Only mark as active if this is the most specific matching item
                    const isActive = activeItem?.url === item.url;

                  // Render icon based on type
                  const renderIcon = () => {
                    if (item.iconType === "phosphor") {
                      return (
                        <Icon
                          name={item.icon as string}
                          size="sm"
                          color={isActive ? "#8C63F2" : "white"}
                          weight={isActive ? "duotone" : "regular"}
                        />
                      );
                    } else if (item.iconType === "custom") {
                      const IconComponent = item.icon as React.ComponentType<{
                        className?: string;
                      }>;
                      return (
                        <IconComponent
                          className={isActive ? "text-[#8C63F2]" : "text-white"}
                        />
                      );
                    } else {
                      // Lucide icon
                      const IconComponent = item.icon as React.ComponentType<{
                        className?: string;
                      }>;
                      return (
                        <IconComponent
                          className={`h-4 w-4 ${
                            isActive ? "text-[#8C63F2]" : "text-white"
                          }`}
                        />
                      );
                    }
                  };

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`group relative gap-3 rounded-md h-9 px-3 py-2 transition-all duration-150 ease-out border-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                          isActive
                            ? "bg-[#6366F11A] text-[#8C63F2] hover:bg-[#6366F11A] hover:text-[#8C63F2] data-[active=true]:bg-[#6366F11A] data-[active=true]:text-[#8C63F2]"
                            : "text-white hover:bg-[#0a0a0a] hover:text-white"
                        }`}
                      >
                        <Link
                          to={item.url}
                          data-testid={`link-${item.title
                            .toLowerCase()
                            .replace(/ /g, "-")}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              {renderIcon()}
                            </div>
                            <span
                              className={`text-[13px] tracking-[-0.2px] truncate ${
                                isActive
                                  ? "font-medium text-[#8C63F2]"
                                  : "font-normal text-white"
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          ));
        })()}

        {/* Account Section */}
        <SidebarGroup className="mt-auto pt-4 border-t border-[#1a1a1a]">
          <SidebarGroupLabel className="px-2 py-1 text-[11px] font-medium tracking-[0.5px] text-[#525252] uppercase mb-2">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <UserAccountItem user={user} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-[#1a1a1a] p-3 bg-black">
        <Link to="/home">
          <Button
            variant="ghost"
            className="w-full gap-2 h-9 bg-transparent hover:bg-[#0a0a0a] border-0 text-[#525252] hover:text-white text-[13px] font-normal justify-center"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}