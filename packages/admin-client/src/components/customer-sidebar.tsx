import { Home, Code, Wallet, Settings, LogOut, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { hasAdminAccess } from "@/types/roles";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5173";

const menuItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Code,
  },
  {
    title: "Wallet",
    url: "/wallet",
    icon: Wallet,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function CustomerSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = hasAdminAccess(user?.role);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code className="h-5 w-5" />
          </div>
          <div>
            <h2
              className="text-base font-semibold leading-none"
              data-testid="text-app-title"
            >
              AI Code Platform
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
                      <span className="text-sm font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        {isAdmin && (
          <Link href="/admin">
            <Button
              variant="outline"
              className="w-full gap-2"
              data-testid="button-admin-panel"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          data-testid="button-logout"
          onClick={() => {
            localStorage.removeItem("authToken");
            fetch(`${API_URL}/api/auth/logout`, {
              method: "GET",
              credentials: "include",
            }).then(() => {
              window.location.href = "/login";
            });
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
