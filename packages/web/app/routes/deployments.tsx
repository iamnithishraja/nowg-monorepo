import { useEffect, useState } from "react";
import {
  Rocket,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Loader2,
  Package,
  Calendar,
  Globe,
  Activity,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Archive,
  Menu,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { ProjectSidebar } from "../components/ProjectSidebar";
import GradientGlow from "../components/GradientGlow";
import { DeleteDeploymentDialog } from "../components/DeleteDeploymentDialog";
import { DeleteAllDeploymentsDialog } from "../components/DeleteAllDeploymentsDialog";
import { DeploymentsSkeleton } from "../components/DeploymentsSkeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export default function Deployments() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [archivedDeployments, setArchivedDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deploymentToDelete, setDeploymentToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch active deployments
      const res = await fetch("/api/deployments", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch deployments");
      }
      const activeDeployments = data.deployments || [];
      setDeployments(activeDeployments);
      
      // Extract conversationId from first deployment if available (for restore functionality)
      if (activeDeployments.length > 0 && activeDeployments[0].conversationId) {
        setConversationId(activeDeployments[0].conversationId);
      }

      // Fetch all archived deployments for the user
      const archivedRes = await fetch("/api/deployments?archived=true", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (archivedRes.ok) {
        const archivedData = await archivedRes.json();
        if (archivedData.success) {
          setArchivedDeployments(archivedData.deployments || []);
        }
      }
    } catch (err: any) {
      console.error("Error fetching deployments:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-error-500" />;
      default:
        return <Loader className="w-5 h-5 text-warning-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      success:
        "bg-[var(--success-500)]/10 text-success-500 border-[var(--success-500)]/20",
      failed:
        "bg-[var(--error-500)]/10 text-error-500 border-[var(--error-500)]/20",
      pending:
        "bg-[var(--warning-500)]/10 text-warning-500 border-[var(--warning-500)]/20",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      vercel: "bg-surface-2 text-primary border-subtle",
      netlify:
        "bg-[var(--info-500)]/10 text-info-500 border-[var(--info-500)]/20",
      github: "bg-surface-2 text-secondary border-subtle",
      default:
        "bg-[var(--accent-primary)]/10 text-accent-primary border-[var(--accent-primary)]/20",
    };
    return (
      colors[platform?.toLowerCase() as keyof typeof colors] || colors.default
    );
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deploymentId }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete deployment");
      }

      // Remove deployment from state
      setDeployments((prev) => prev.filter((d) => d.id !== deploymentId));
      setDeleteDialogOpen(false);
      setDeploymentToDelete(null);
    } catch (err: any) {
      console.error("Error deleting deployment:", err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllDeployments = async () => {
    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteAll: true }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete all deployments");
      }

      // Clear all deployments from state
      setDeployments([]);
      setDeleteAllDialogOpen(false);
    } catch (err: any) {
      console.error("Error deleting all deployments:", err);
      setError(err.message);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const openDeleteDialog = (deployment: any) => {
    setDeploymentToDelete({
      id: deployment.id,
      title: deployment.conversationTitle || "Untitled Project",
    });
    setDeleteDialogOpen(true);
  };

  const handleRestoreDeployment = async (deployment: any) => {
    if (!deployment.conversationId) {
      setError("Conversation ID not found for this deployment");
      return;
    }

    setIsRestoring(deployment.id);
    try {
      // Step 1: Get snapshot data from archived deployment
      const restoreRes = await fetch("/api/deployments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restore: true,
          deploymentId: deployment.id,
          conversationId: deployment.conversationId,
        }),
      });

      if (!restoreRes.ok) {
        throw new Error(`HTTP ${restoreRes.status}: ${restoreRes.statusText}`);
      }

      const restoreData = await restoreRes.json();
      if (!restoreData.success) {
        throw new Error(restoreData.error || "Failed to prepare restore");
      }

      // Step 2: Redeploy using snapshot data
      const platform = restoreData.platform || deployment.platform;
      const endpoint = platform === "vercel" ? "/api/deploy/vercel" : "/api/deploy/netlify";
      
      const deployRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: restoreData.snapshotData.files || [],
          projectName: restoreData.projectName || restoreData.snapshotData.projectName,
          siteName: restoreData.projectName || restoreData.snapshotData.projectName,
          conversationId: deployment.conversationId,
          framework: restoreData.framework || restoreData.snapshotData.framework || "vite",
        }),
      });

      if (!deployRes.ok) {
        throw new Error(`Deployment failed: HTTP ${deployRes.status}`);
      }

      // Step 3: Monitor deployment progress via SSE stream
      const reader = deployRes.body?.getReader();
      if (!reader) {
        throw new Error("No response stream from deployment server");
      }

      const decoder = new TextDecoder();
      let deploymentComplete = false;
      let deploymentUrl: string | null = null;
      let errorMessage: string | null = null;

      while (!deploymentComplete) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "error") {
                errorMessage = data.message || "Deployment failed";
                deploymentComplete = true;
                break;
              }
              
              if (data.type === "success") {
                deploymentUrl = data.url || data.deploymentUrl;
                deploymentComplete = true;
                break;
              }
              
              if (data.type === "progress" && data.state === "ready") {
                deploymentUrl = data.url || deploymentUrl;
                deploymentComplete = true;
                break;
              }
            } catch (e) {
              // Ignore JSON parse errors for non-JSON lines
            }
          }
        }
      }

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      // Step 4: Refresh deployments to show the new live deployment
      await fetchDeployments(true);
      
      // Show success message
      setError(null);
      
      // Optionally show success notification
      if (deploymentUrl) {
        console.log(`Deployment restored successfully: ${deploymentUrl}`);
      }
    } catch (err: any) {
      console.error("Error restoring deployment:", err);
      setError(err.message || "Failed to restore deployment");
    } finally {
      setIsRestoring(null);
    }
  };

  // Promote an archived deployment to live (instant, no redeploy - uses Vercel/Netlify alias API)
  const handlePromoteDeployment = async (deployment: any) => {
    if (!deployment.conversationId) {
      setError("Conversation ID not found for this deployment");
      return;
    }

    setIsPromoting(deployment.id);
    setError(null);
    
    try {
      const res = await fetch("/api/deployments/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deploymentId: deployment.id,
          conversationId: deployment.conversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to promote deployment");
      }

      // Refresh deployments to show the updated state
      await fetchDeployments(true);
      
      console.log(`Deployment promoted successfully: ${data.deploymentUrl}`);
    } catch (err: any) {
      console.error("Error promoting deployment:", err);
      setError(err.message || "Failed to promote deployment");
    } finally {
      setIsPromoting(null);
    }
  };

  const filteredDeployments =
    filter === "all"
      ? deployments
      : deployments.filter((d) => d.status === filter);

  const stats = {
    total: deployments.length,
    success: deployments.filter((d) => d.status === "success").length,
    failed: deployments.filter((d) => d.status === "failed").length,
    pending: deployments.filter((d) => d.status === "pending").length,
  };

  const statsCards = [
    {
      title: "Total Deployments",
      value: stats.total,
      icon: Package,
      color: "text-info-500",
    },
    {
      title: "Successful",
      value: stats.success,
      icon: CheckCircle,
      color: "text-success-500",
    },
    {
      title: "Failed",
      value: stats.failed,
      icon: XCircle,
      color: "text-error-500",
    },
    {
      title: "In Progress",
      value: stats.pending,
      icon: Loader,
      color: "text-warning-500",
    },
  ];

  if (loading || isRefreshing) {
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
              <DeploymentsSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
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
              <Card className="bg-surface-1 border border-subtle rounded-[12px]">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <XCircle className="w-8 h-8 text-error-500" />
                    <CardTitle className="text-2xl font-bold text-primary">
                      Error Loading Deployments
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-error-500 bg-[var(--error-500)]/10 p-4 rounded-lg border border-[var(--error-500)]/20">
                    {error}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition"
                  >
                    Try Again
                  </button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden safe-area-padding">
      {/* Sidebar */}
      <ProjectSidebar user={null} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Gradient Background */}
        <GradientGlow />

        <main className="relative z-20 flex flex-col h-full overflow-hidden">
          {/* Mobile: top bar with menu and back */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("openProjectSidebar"))}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 text-tertiary hover:text-primary transition-colors touch-manipulation"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors py-2 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="truncate">Back to Home</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Back Button - desktop only */}
            <Link
              to="/home"
              className="hidden md:inline-flex items-center justify-center sm:justify-start gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-4 sm:mb-6 min-h-[44px] min-w-[44px] -ml-2 sm:min-w-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>

            {/* Page Header - responsive stack on mobile */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 transition-colors duration-300 shrink-0">
                    <Rocket className="w-7 h-7 sm:w-8 sm:h-8 text-accent-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary truncate">
                      Deployments
                    </h1>
                    <p className="text-tertiary text-sm sm:text-base mt-0.5 sm:hidden">
                      {stats.total} active · {archivedDeployments.length} archived
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchDeployments(true)}
                    disabled={isRefreshing || loading}
                    className="min-h-[44px] sm:min-h-9 bg-surface-2/50 backdrop-blur-sm border-subtle hover:bg-surface-3/50 hover:border-[var(--accent-primary)]/30 transition-all duration-300 group px-3 sm:px-4"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 sm:mr-2 group-hover:rotate-180 transition-transform duration-500" />
                    )}
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                  {deployments.length > 0 && (
                    <button
                      onClick={() => setDeleteAllDialogOpen(true)}
                      className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 px-3 sm:px-4 py-2 bg-[var(--error-500)] hover:bg-[var(--error-400)] text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isDeletingAll || loading || isRefreshing}
                      title="Delete all deployments"
                    >
                      {isDeletingAll ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {isDeletingAll ? "Deleting..." : "Delete All"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-tertiary text-sm sm:text-base hidden sm:block mt-1">
                Manage and monitor all your project deployments
              </p>
            </div>

            {/* Summary Stats Grid - 2x2 on mobile, 4 on large */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
              {statsCards.map((stat, index) => (
                <Card
                  key={index}
                  className="bg-surface-1 border border-subtle rounded-xl hover:border-[var(--accent-primary)]/30 transition-all duration-300 h-full"
                >
                  <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 sm:pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium text-tertiary truncate pr-2">
                      {stat.title}
                    </CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-surface-2 shrink-0">
                      <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-primary">
                      {stat.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter Tabs - scrollable on mobile */}
            <Tabs
              value={showArchived ? "archived" : filter}
              onValueChange={(v) => {
                if (v === "archived") {
                  setShowArchived(true);
                } else {
                  setShowArchived(false);
                  setFilter(v);
                }
              }}
              className="mb-4 sm:mb-6"
            >
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-3 touch-pan-x">
                <TabsList className="bg-surface-2/50 border border-subtle inline-flex w-max h-auto flex-nowrap gap-1 p-1.5 sm:p-[3px]">
                  <TabsTrigger value="all" className="shrink-0 text-xs sm:text-sm px-3 sm:px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="success" className="shrink-0 text-xs sm:text-sm px-3 sm:px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0">
                    Success
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="shrink-0 text-xs sm:text-sm px-3 sm:px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0">
                    Failed
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="shrink-0 text-xs sm:text-sm px-3 sm:px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0">
                    Pending
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="shrink-0 text-xs sm:text-sm px-3 sm:px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    Archived ({archivedDeployments.length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>

            {/* Deployments Grid */}
            {showArchived ? (
              archivedDeployments.length === 0 ? (
                <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px]">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="bg-surface-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Archive className="w-8 h-8 sm:w-10 sm:h-10 text-tertiary" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">
                      No Archived Deployments
                    </h3>
                    <p className="text-tertiary text-sm sm:text-base">
                      Archived deployments will appear here when you create new
                      deployments
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {archivedDeployments.map((d) => (
                    <Card
                      key={d.id}
                      className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] hover:border-[var(--accent-primary)]/30 transition-all duration-300 h-full opacity-75"
                    >
                      <CardHeader className="p-4 sm:pb-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg sm:text-xl font-bold text-primary mb-2 sm:mb-3 line-clamp-2">
                              {d.conversationTitle || "Untitled Project"}
                            </CardTitle>
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPlatformColor(
                                  d.platform
                                )}`}
                              >
                                <Globe className="w-3 h-3" />
                                {d.platform}
                              </span>
                              {d.versionNumber && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-[var(--info-500)]/10 text-info-500 border-[var(--info-500)]/20">
                                  v{d.versionNumber}
                                  {d.totalVersions && ` of ${d.totalVersions}`}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-surface-2 text-tertiary border-subtle">
                                <Archive className="w-3 h-3" />
                                Archived
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            {getStatusIcon(d.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-2.5 sm:p-1.5 rounded-lg hover:bg-surface-3/50 transition-colors duration-200 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                  title="More options"
                                >
                                  <MoreHorizontal className="w-4 h-4 text-tertiary" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handlePromoteDeployment(d)}
                                  disabled={isPromoting === d.id || isRestoring === d.id}
                                >
                                  {isPromoting === d.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Promoting...
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-4 h-4 mr-2" />
                                      Promote to Live (Instant)
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRestoreDeployment(d)}
                                  disabled={isRestoring === d.id || isPromoting === d.id}
                                >
                                  {isRestoring === d.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Redeploying...
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="w-4 h-4 mr-2" />
                                      Restore & Redeploy
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(d)}
                                  variant="destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Deployment
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border ${getStatusBadge(
                            d.status
                          )}`}
                        >
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        {/* Details */}
                        <div className="space-y-2 sm:space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="font-medium shrink-0">Archived:</span>
                            <span className="text-secondary truncate">
                              {d.archivedAt
                                ? new Date(d.archivedAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )
                                : "N/A"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="font-medium shrink-0">Deployed:</span>
                            <span className="text-secondary truncate">
                              {d.deployedAt
                                ? new Date(d.deployedAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )
                                : "N/A"}
                            </span>
                          </div>

                          {d.deploymentId && (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                              <span className="font-medium shrink-0">ID:</span>
                              <code className="bg-surface-2 px-2 py-0.5 rounded text-xs text-secondary border border-subtle truncate max-w-[120px] sm:max-w-[200px]">
                                {d.deploymentId.substring(0, 12)}...
                              </code>
                            </div>
                          )}

                          {(d.uniqueDeploymentUrl || d.deploymentUrl) && (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                              <span className="font-medium shrink-0">
                                {d.uniqueDeploymentUrl ? "URL:" : "URL:"}
                              </span>
                              <code className="bg-surface-2 px-2 py-0.5 rounded text-xs text-secondary border border-subtle truncate min-w-0 max-w-[140px] sm:max-w-[200px]" title={(d.uniqueDeploymentUrl || d.deploymentUrl).replace(/^https?:\/\//, '')}>
                                {(d.uniqueDeploymentUrl || d.deploymentUrl).replace(/^https?:\/\//, '')}
                              </code>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons - touch-friendly min height */}
                        {(d.uniqueDeploymentUrl || d.deploymentUrl) && d.status === "success" && (
                          <div className="space-y-2 sm:space-y-2">
                            {d.uniqueDeploymentUrl ? (
                              <div className="text-xs text-success-500 text-center mb-2">
                                This URL shows the exact archived version
                              </div>
                            ) : (
                              <div className="text-xs text-tertiary text-center mb-2">
                                Note: This URL may show the latest version
                              </div>
                            )}
                            <a
                              href={d.uniqueDeploymentUrl || d.deploymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full bg-surface-2 hover:bg-surface-3 text-secondary px-4 py-3.5 sm:py-3 min-h-[48px] rounded-xl font-semibold transition-all border border-subtle"
                            >
                              View Archived Version
                              <ExternalLink className="w-4 h-4 shrink-0" />
                            </a>
                            <button
                              onClick={() => handlePromoteDeployment(d)}
                              disabled={isPromoting === d.id || isRestoring === d.id}
                              className="flex items-center justify-center gap-2 w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-3.5 sm:py-3 min-h-[48px] rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPromoting === d.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                  Promoting...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4 shrink-0" />
                                  Promote to Live
                                </>
                              )}
                            </button>
                            <div className="text-xs text-tertiary text-center">
                              Instant switch - no rebuild required
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : filteredDeployments.length === 0 ? (
              <Card className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px]">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="bg-surface-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-8 h-8 sm:w-10 sm:h-10 text-tertiary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">
                    No Deployments Found
                  </h3>
                  <p className="text-tertiary text-sm sm:text-base">
                    {filter === "all"
                      ? "Start deploying your projects to see them here 🚀"
                      : `No ${filter} deployments at the moment`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredDeployments.map((d) => (
                  <Card
                    key={d.id}
                    className="bg-surface-1 border border-subtle rounded-xl sm:rounded-[12px] hover:border-[var(--accent-primary)]/30 transition-all duration-300 h-full"
                  >
                    <CardHeader className="p-4 sm:pb-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg sm:text-xl font-bold text-primary mb-2 sm:mb-3 line-clamp-2">
                            {d.conversationTitle || "Untitled Project"}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold border ${getPlatformColor(
                                d.platform
                              )}`}
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              {d.platform}
                            </span>
                            {d.versionNumber && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold border bg-[var(--info-500)]/10 text-info-500 border-[var(--info-500)]/20">
                                v{d.versionNumber}
                                {d.totalVersions && d.totalVersions > 1 && ` of ${d.totalVersions}`}
                              </span>
                            )}
                            {d.isLive && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold border bg-[var(--success-500)]/10 text-success-500 border-[var(--success-500)]/20">
                                <Zap className="w-3 h-3 shrink-0" />
                                Live
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                          {getStatusIcon(d.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-2.5 sm:p-1.5 rounded-lg hover:bg-surface-3/50 transition-colors duration-200 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                title="More options"
                              >
                                <MoreHorizontal className="w-4 h-4 text-tertiary" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(d)}
                                variant="destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Deployment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border ${getStatusBadge(
                          d.status
                        )}`}
                      >
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      {/* Details */}
                      <div className="space-y-2 sm:space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="font-medium shrink-0">Deployed:</span>
                          <span className="text-secondary truncate">
                            {d.deployedAt
                              ? new Date(d.deployedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "N/A"}
                          </span>
                        </div>

                        {d.deploymentId && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-tertiary min-h-[20px]">
                            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="font-medium shrink-0">ID:</span>
                            <code className="bg-surface-2 px-2 py-0.5 rounded text-xs text-secondary border border-subtle truncate max-w-[120px] sm:max-w-none">
                              {d.deploymentId.substring(0, 12)}...
                            </code>
                          </div>
                        )}
                      </div>

                      {/* Action Button - touch-friendly */}
                      {d.deploymentUrl && d.status === "success" && (
                        <a
                          href={d.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-3.5 sm:py-3 min-h-[48px] rounded-xl font-semibold transition-all"
                        >
                          View Live Deployment
                          <ExternalLink className="w-4 h-4 shrink-0" />
                        </a>
                      )}

                      {d.status === "pending" && (
                        <div className="flex items-center justify-center gap-2 w-full bg-surface-2 text-tertiary px-4 py-3.5 sm:py-3 min-h-[48px] rounded-xl font-semibold border border-subtle">
                          <Loader className="w-4 h-4 animate-spin shrink-0" />
                          <span className="truncate">Deployment in progress...</span>
                        </div>
                      )}

                      {d.status === "failed" && (
                        <div className="flex items-center justify-center gap-2 w-full bg-[var(--error-500)]/10 text-error-500 px-4 py-3.5 sm:py-3 min-h-[48px] rounded-xl font-semibold border border-[var(--error-500)]/20">
                          <XCircle className="w-4 h-4 shrink-0" />
                          Deployment failed
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      {deploymentToDelete && (
        <DeleteDeploymentDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          deploymentTitle={deploymentToDelete.title}
          deploymentId={deploymentToDelete.id}
          onDelete={handleDeleteDeployment}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete All Confirmation Dialog */}
      <DeleteAllDeploymentsDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        deploymentCount={filteredDeployments.length}
        onDelete={handleDeleteAllDeployments}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}
