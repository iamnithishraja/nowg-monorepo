import type { Route } from "./+types/supabase-projects";
import { useEffect, useState } from "react";
import { redirect, Link } from "react-router";
import { auth } from "../lib/auth";
import GradientGlow from "../components/GradientGlow";
import { ProjectSidebar } from "../components/ProjectSidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Database,
  Trash2,
  Loader2,
  RefreshCw,
  Clock,
  Server,
  Calendar,
  MoreHorizontal,
  Settings,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { DeleteAllSupabaseProjectsDialog } from "../components/DeleteAllSupabaseProjectsDialog";
import { SupabaseProjectsSkeleton } from "../components/SupabaseProjectsSkeleton";
import SupabaseBrowserDialog from "../components/SupabaseBrowserDialog";
import { SupabaseConnectionDialog } from "../components/SupabaseConnectionDialog";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });
  if (!session) throw redirect("/");
  return {};
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Supabase Projects - Nowgai" },
    { name: "description", content: "Manage provisioned Supabase projects" },
  ];
}

export default function SupabaseProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserProject, setBrowserProject] = useState<any | null>(null);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);

  // Supabase OAuth hook
  const {
    hasSupabaseConnected,
    isCheckingToken: isCheckingSupabase,
    supabaseUser,
    handleConnectSupabase,
    handleDisconnectSupabase,
  } = useSupabaseAuth();

  // Handle OAuth callback redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("supabase_connected") === "true") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      fetchProjects();
    }
  }, []);

  const fetchProjects = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await fetch("/api/supabase/projects", {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const js = await res.json();
        setProjects(js.projects || []);
      }
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const deleteProject = async (conversationId: string) => {
    const confirmed = window.confirm(
      "Delete the Supabase project for this conversation? This cannot be undone."
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.filter((p) => p.conversationId !== conversationId)
        );
      }
    } catch {}
  };

  const deleteAllProjects = async () => {
    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/supabase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (res.ok) {
        setProjects([]);
      }
    } finally {
      setIsDeletingAll(false);
      setDeleteAllDialogOpen(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden safe-area-padding">
      {/* Sidebar */}
      <ProjectSidebar user={null} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Gradient Background */}
        <GradientGlow />

        <main className="relative z-20 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isLoading || isRefreshing ? (
              <SupabaseProjectsSkeleton />
            ) : (
              <>
                {/* Back Button - touch-friendly on mobile */}
                <Link
                  to="/home"
                  className="inline-flex gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-4 sm:mb-6 min-h-[44px] min-w-[44px] -ml-2 items-center justify-center sm:justify-start sm:min-w-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Back to Home</span>
                </Link>

                {/* Page Header - responsive stack on mobile */}
                <div className="mb-6 sm:mb-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative group shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--gradient-mid)]/10 rounded-xl sm:rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                        <div className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/10 to-[var(--gradient-mid)]/5 border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/30 transition-all duration-300 active:scale-105 sm:hover:scale-105">
                          <Database className="w-8 h-8 sm:w-9 sm:h-9 text-accent-primary" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary truncate">
                          Supabase Projects
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                          <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-xs text-accent-primary font-medium">
                            <Server className="w-3 h-3 shrink-0" />
                            {projects.length}{" "}
                            {projects.length === 1 ? "Project" : "Projects"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-surface-2 border border-subtle text-xs text-tertiary">
                            <Database className="w-3 h-3 shrink-0" />
                            Managed
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConnectionDialogOpen(true)}
                        className="min-h-[44px] sm:min-h-9 px-3 sm:px-4 bg-surface-2/50 backdrop-blur-sm border-subtle hover:bg-surface-3/50 hover:border-[var(--accent-primary)]/30 transition-all duration-300"
                      >
                        <Settings className="h-4 w-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">
                          {hasSupabaseConnected ? "Account" : "Connect"}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchProjects(true)}
                        disabled={isRefreshing}
                        className="min-h-[44px] sm:min-h-9 px-3 sm:px-4 bg-surface-2/50 backdrop-blur-sm border-subtle hover:bg-surface-3/50 hover:border-[var(--accent-primary)]/30 transition-all duration-300 group"
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-4 w-4 sm:mr-2 animate-spin shrink-0" />
                        ) : (
                          <RefreshCw className="h-4 w-4 sm:mr-2 group-hover:rotate-180 transition-transform duration-500 shrink-0" />
                        )}
                        <span className="hidden sm:inline">Refresh</span>
                      </Button>
                      {projects.length > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteAllDialogOpen(true)}
                          disabled={isDeletingAll || isRefreshing}
                          className="min-h-[44px] sm:min-h-9 px-3 sm:px-4 hover:bg-destructive/90 transition-all duration-300"
                        >
                          {isDeletingAll ? (
                            <Loader2 className="h-4 w-4 sm:mr-2 animate-spin shrink-0" />
                          ) : (
                            <Trash2 className="h-4 w-4 sm:mr-2 shrink-0" />
                          )}
                          <span className="hidden sm:inline">Delete All</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-tertiary text-sm sm:text-base max-w-2xl mt-1">
                    Manage Supabase projects provisioned per conversation. Each
                    project includes a dedicated PostgreSQL database with
                    authentication, storage, and real-time capabilities.
                  </p>
                </div>

                {/* Projects List - single column on mobile, grid on larger */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {projects.length === 0 ? (
                    <div className="col-span-full text-center py-12 sm:py-20">
                      <div className="flex flex-col items-center gap-4 sm:gap-6 max-w-md mx-auto px-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--gradient-mid)]/10 rounded-full blur-2xl" />
                          <div className="relative p-5 sm:p-6 rounded-full bg-gradient-to-br from-surface-2 to-surface-1 border border-subtle">
                            <Database className="w-10 h-10 sm:w-12 sm:h-12 text-tertiary" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">
                            No Supabase Projects Yet
                          </h3>
                          <p className="text-tertiary text-sm sm:text-base">
                            Start a new conversation and enable Supabase to
                            provision a database for your project.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => (window.location.href = "/home")}
                          className="min-h-[44px] px-6 bg-surface-2/50 border-subtle hover:bg-[var(--accent-primary)]/10 hover:border-[var(--accent-primary)]/30 hover:text-accent-primary transition-all duration-300"
                        >
                          Start New Conversation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    projects.map((p) => (
                      <div key={p.conversationId} className="group">
                        <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] hover:border-[var(--accent-primary)]/30 active:border-[var(--accent-primary)]/30 transition-all duration-300 h-full overflow-hidden">
                          <CardHeader
                            className="pb-3 relative cursor-pointer p-4 sm:p-6 sm:pb-3 active:bg-surface-2/30"
                            onClick={() => {
                              setBrowserProject({
                                conversationId: p.conversationId,
                                ref: p.ref,
                                title: p.conversationTitle,
                              });
                              setBrowserOpen(true);
                            }}
                            title="Tap to browse tables"
                          >
                            <div className="absolute top-3 right-3">
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--success-500)]/10 border border-[var(--success-500)]/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                                <span className="text-[10px] text-success-500 font-medium">
                                  Active
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pr-20">
                              <div className="flex-1 min-w-0">
                                <CardTitle
                                  className="text-base sm:text-lg font-semibold truncate mb-1 text-primary group-hover:text-accent-primary transition-colors"
                                  title={p.conversationTitle}
                                >
                                  {p.conversationTitle}
                                </CardTitle>
                                <CardDescription className="text-xs text-tertiary flex items-center gap-2">
                                  <span className="flex items-center gap-1 min-w-0">
                                    <Database className="w-3 h-3 shrink-0" />
                                    <span className="truncate">Ref: {p.ref}</span>
                                  </span>
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 p-4 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm gap-2">
                                <span className="text-tertiary flex items-center gap-1.5 shrink-0">
                                  <Server className="w-3.5 h-3.5" />
                                  Project
                                </span>
                                <span className="font-mono text-xs text-secondary bg-surface-2 px-2 py-1 rounded border border-subtle truncate max-w-[120px] sm:max-w-none">
                                  {p.projectId
                                    ? `${p.projectId.slice(0, 8)}...`
                                    : "—"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                {/* Database URL removed by request */}
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-tertiary flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                                  Created
                                </span>
                                <span className="text-xs text-secondary">
                                  {p.createdAt
                                    ? new Date(p.createdAt).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-tertiary flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  Updated
                                </span>
                                <span className="text-xs text-secondary">
                                  {p.updatedAt
                                    ? new Date(p.updatedAt).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-subtle">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full min-h-[44px] sm:min-h-9 bg-surface-2/50 border-subtle hover:bg-surface-3/50 hover:border-[var(--accent-primary)]/30 transition-all duration-300"
                                  >
                                    <MoreHorizontal className="w-4 h-4 mr-2 shrink-0" />
                                    Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[180px]">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setBrowserProject({
                                        conversationId: p.conversationId,
                                        ref: p.ref,
                                        title: p.conversationTitle,
                                      });
                                      setBrowserOpen(true);
                                    }}
                                    className="min-h-[44px] sm:min-h-9 cursor-pointer"
                                  >
                                    <Database className="w-4 h-4 mr-2 shrink-0" />
                                    Browse Tables
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      deleteProject(p.conversationId)
                                    }
                                    variant="destructive"
                                    className="min-h-[44px] sm:min-h-9 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2 shrink-0" />
                                    Delete Project
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      {/* Delete All Confirmation Dialog */}
      <DeleteAllSupabaseProjectsDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        projectCount={projects.length}
        onDelete={deleteAllProjects}
        isDeleting={isDeletingAll}
      />
      <SupabaseBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        project={browserProject}
      />
      <SupabaseConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
        hasSupabaseConnected={hasSupabaseConnected}
        isCheckingToken={isCheckingSupabase}
        supabaseEmail={supabaseUser?.email}
        onConnect={handleConnectSupabase}
        onDisconnect={handleDisconnectSupabase}
      />
    </div>
  );
}
