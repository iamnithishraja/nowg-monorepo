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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deploymentToDelete, setDeploymentToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      setDeployments(data.deployments || []);
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
      <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden">
        {/* Sidebar */}
        <ProjectSidebar user={null} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Gradient Background */}
          <GradientGlow />

          <main className="relative z-20 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
              <DeploymentsSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden">
        {/* Sidebar */}
        <ProjectSidebar user={null} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Gradient Background */}
          <GradientGlow />

          <main className="relative z-20 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
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
    <div className="h-screen w-screen bg-canvas text-white flex overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar user={null} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Gradient Background */}
        <GradientGlow />

        <main className="relative z-20 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
            {/* Back Button */}
            <Link
              to="/home"
              className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 transition-colors duration-300">
                    <Rocket className="w-8 h-8 text-accent-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                      Deployments
                    </h1>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchDeployments(true)}
                    disabled={isRefreshing || loading}
                    className="bg-surface-2/50 backdrop-blur-sm border-subtle hover:bg-surface-3/50 hover:border-[var(--accent-primary)]/30 transition-all duration-300 group"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                    )}
                    Refresh
                  </Button>
                  {deployments.length > 0 && (
                    <button
                      onClick={() => setDeleteAllDialogOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--error-500)] hover:bg-[var(--error-400)] text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isDeletingAll || loading || isRefreshing}
                    >
                      {isDeletingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete All
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-tertiary">
                Manage and monitor all your project deployments
              </p>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {statsCards.map((stat, index) => (
                <Card
                  key={index}
                  className="bg-surface-1 border border-subtle rounded-[12px] hover:border-[var(--accent-primary)]/30 transition-all duration-300 h-full"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-tertiary">
                      {stat.title}
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-surface-2">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">
                      {stat.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter Tabs */}
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v)}
              className="mb-6"
            >
              <TabsList className="bg-surface-2/50 border border-subtle">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="success">Successful</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Deployments Grid */}
            {filteredDeployments.length === 0 ? (
              <Card className="bg-surface-1 border border-subtle rounded-[12px]">
                <CardContent className="p-12 text-center">
                  <div className="bg-surface-2 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-10 h-10 text-tertiary" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-2">
                    No Deployments Found
                  </h3>
                  <p className="text-tertiary">
                    {filter === "all"
                      ? "Start deploying your projects to see them here 🚀"
                      : `No ${filter} deployments at the moment`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredDeployments.map((d) => (
                  <Card
                    key={d.id}
                    className="bg-surface-1 border border-subtle rounded-[12px] hover:border-[var(--accent-primary)]/30 transition-all duration-300 h-full"
                  >
                    <CardHeader className="pb-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <CardTitle className="text-xl font-bold text-primary mb-3 line-clamp-2">
                            {d.conversationTitle || "Untitled Project"}
                          </CardTitle>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPlatformColor(
                              d.platform
                            )}`}
                          >
                            <Globe className="w-3 h-3" />
                            {d.platform}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(d.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1.5 rounded-lg hover:bg-surface-3/50 transition-colors duration-200"
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
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${getStatusBadge(
                          d.status
                        )}`}
                      >
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-tertiary">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Deployed:</span>
                          <span className="text-secondary">
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
                          <div className="flex items-center gap-2 text-sm text-tertiary">
                            <Package className="w-4 h-4" />
                            <span className="font-medium">ID:</span>
                            <code className="bg-surface-2 px-2 py-0.5 rounded text-xs text-secondary border border-subtle">
                              {d.deploymentId.substring(0, 12)}...
                            </code>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {d.deploymentUrl && d.status === "success" && (
                        <a
                          href={d.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-3 rounded-xl font-semibold transition-all"
                        >
                          View Live Deployment
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      {d.status === "pending" && (
                        <div className="flex items-center justify-center gap-2 w-full bg-surface-2 text-tertiary px-4 py-3 rounded-xl font-semibold border border-subtle">
                          <Loader className="w-4 h-4 animate-spin" />
                          Deployment in progress...
                        </div>
                      )}

                      {d.status === "failed" && (
                        <div className="flex items-center justify-center gap-2 w-full bg-[var(--error-500)]/10 text-error-500 px-4 py-3 rounded-xl font-semibold border border-[var(--error-500)]/20">
                          <XCircle className="w-4 h-4" />
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
