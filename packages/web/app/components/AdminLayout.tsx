import { useAuth } from "../hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();

  // Don't block rendering - show layout even while loading
  // The children will handle their own loading states

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full bg-canvas">
        <AdminSidebar user={user} isLoading={isLoading} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto z-20 bg-canvas relative">
            {/* Mobile-only sidebar toggle (we intentionally removed the top header/user role bar) */}
            <div className="absolute left-3 top-3 z-30 md:hidden">
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="text-secondary hover:text-primary transition-colors"
              />
            </div>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
