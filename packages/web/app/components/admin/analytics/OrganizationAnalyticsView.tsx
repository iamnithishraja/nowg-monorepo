import {
  CurrencyDollar,
  FolderSimple,
  Hash,
  ChatCircle,
  Users,
  X,
  TrendUp,
  ChartLine,
  Lightning,
} from "@phosphor-icons/react";
import {
  Activity,
  FolderKanban,
  MessageSquare,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Separator } from "../../ui/separator";
import { Skeleton } from "../../ui/skeleton";
import { AnalyticsCard } from "./AnalyticsCard";
import { ModelUsageChart, ModelUsageChartCompact } from "./AnalyticsChart";
import { CreditsDonutChart } from "./CreditsDonutChart";
import { DeploymentsByDayChart } from "./DeploymentsByDayChart";
import { type OrganizationAnalytics, useOrganizationAnalytics } from "./hooks";
import {
  CreditRefillRequestsCard,
  CreditUsageCard,
  LastTransactionCard,
  ProjectStatsCard,
  TotalCreditsCard,
} from "./OverviewStatCard";
import { DateSelector, ProjectsFilters, ProjectsHeader, type StatusFilter, type TimeFilter } from "./ProjectsFilters";
import { ProjectsTable, type ProjectTableRow } from "./ProjectsTable";

interface OrganizationAnalyticsViewProps {
  organizationId: string;
}

// Chart colors for projects
const PROJECT_COLORS = ["#4409fe", "#8c16f8", "#f155ce", "#727279"];

// Helper to format model names nicely
function formatModelName(modelId: string): string {
  // Remove provider prefix and format nicely
  const parts = modelId.split("/");
  const name = parts[parts.length - 1];
  
  // Common formatting rules
  const formatted = name
    .replace(/^claude-/, "Claude ")
    .replace(/^gpt-/, "GPT-")
    .replace(/^gemini-/, "Gemini ")
    .replace(/-pro$/, " Pro")
    .replace(/-sonnet$/, " Sonnet")
    .replace(/-opus$/, " Opus")
    .replace(/-nano$/, " Nano")
    .replace(/-turbo$/, " Turbo")
    .replace(/-preview$/, " Preview")
    .replace(/-(\d+)\.(\d+)/, " $1.$2")
    .replace(/-/g, " ");

  // Capitalize first letter of each word
  return formatted
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function OrganizationAnalyticsView({
  organizationId,
}: OrganizationAnalyticsViewProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<OrganizationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>("all");
  const [activeStatusFilters, setActiveStatusFilters] = useState<StatusFilter[]>([
    "active",
    "completed",
    "archived",
    "draft",
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await useOrganizationAnalytics(organizationId);
        setData(result);
      } catch (err) {
        setError(err as Error);
        console.error("Error fetching organization analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  // Transform project breakdown data to ProjectTableRow format
  const projectRows: ProjectTableRow[] = useMemo(() => {
    if (!data?.projectBreakdown) return [];

    return data.projectBreakdown.map((project) => ({
      id: project.projectId,
      name: project.projectName,
      status: project.status || "active",
      team: project.team || [
        { id: "1", name: "User" },
      ],
      createdAt: project.createdAt || new Date().toISOString(),
      creditsUsage: {
        current: parseFloat(project.cost) || 0,
        max: project.creditsUsage?.max || (parseFloat(project.cost) > 0 ? Math.max(parseFloat(project.cost) * 2, 1000) : 1000),
        cost: parseFloat(project.cost) || 0,
      },
      costToDate: parseFloat(project.cost) || 0,
      lastUpdated: project.lastUpdated || new Date().toISOString(),
      conversationId: project.conversationId,
    }));
  }, [data?.projectBreakdown]);

  // Filter projects based on search and filters
  const filteredProjects = useMemo(() => {
    let filtered = [...projectRows];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.createdAt.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (activeStatusFilters.length > 0) {
      filtered = filtered.filter((p) => activeStatusFilters.includes(p.status));
    }

    // Time filter
    if (activeTimeFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;
      switch (activeTimeFilter) {
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "6m":
          cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      filtered = filtered.filter((p) => new Date(p.createdAt) >= cutoffDate);
    }

    return filtered;
  }, [projectRows, searchQuery, activeStatusFilters, activeTimeFilter]);

  // Prepare credits donut chart data
  const creditsChartData = useMemo(() => {
    if (!data?.projectBreakdown) return { total: 0, projects: [] };

    const totalCost = data.projectBreakdown.reduce(
      (sum, p) => sum + (parseFloat(p.cost) || 0),
      0
    );

    const sortedProjects = [...data.projectBreakdown]
      .sort((a, b) => (parseFloat(b.cost) || 0) - (parseFloat(a.cost) || 0))
      .slice(0, 4);

    const topProjectsCost = sortedProjects.reduce(
      (sum, p) => sum + (parseFloat(p.cost) || 0),
      0
    );
    const othersCost = totalCost - topProjectsCost;

    const projects = sortedProjects.map((project, index) => {
      const amount = parseFloat(project.cost) || 0;
      const percentage = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;
      return {
        name: project.projectName,
        percentage,
        amount,
        color: PROJECT_COLORS[index % PROJECT_COLORS.length],
      };
    });

    if (othersCost > 0 && projects.length >= 3) {
      const percentage = totalCost > 0 ? Math.round((othersCost / totalCost) * 100) : 0;
      projects.push({
        name: "Others",
        percentage,
        amount: othersCost,
        color: PROJECT_COLORS[3],
      });
    }

    return { total: totalCost, projects };
  }, [data?.projectBreakdown]);

  // Prepare deployments chart data
  const deploymentsChartData = useMemo(() => {
    if (!data?.deployments) {
      return {
        data: [
          { name: "Successful", value: 0, fill: "#22c55e" },
          { name: "Failed", value: 0, fill: "#ef4444" },
        ],
        total: 0,
      };
    }
    return {
      data: [
        { name: "Successful", value: data.deployments.successful || 0, fill: "#22c55e" },
        { name: "Failed", value: data.deployments.failed || 0, fill: "#ef4444" },
      ],
      total: data.deployments.total || 0,
    };
  }, [data?.deployments]);

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    if (!data) {
      return {
        activeProjects: 0,
        completedProjects: 0,
        archivedProjects: 0,
        totalCredits: 0,
        creditsPerDay: 0,
        lastTransaction: null as { amount: number; type: "credit" | "debit"; description: string; timeAgo: string } | null,
        pendingRefills: 0,
        totalRefills: 0,
      };
    }

    const activeProjects = projectRows.filter(p => p.status === "active").length;
    const completedProjects = projectRows.filter(p => p.status === "completed").length;
    const archivedProjects = projectRows.filter(p => p.status === "archived").length;
    
    // Calculate average credits per day (total cost / 30 days as estimate)
    const totalCost = parseFloat(data.totalCost) || 0;
    const creditsPerDay = totalCost / 30;

    return {
      activeProjects,
      completedProjects,
      archivedProjects,
      totalCredits: totalCost * 2, // Example: available credits
      creditsPerDay,
      lastTransaction: totalCost > 0 ? {
        amount: totalCost * 0.1, // Last transaction as example
        type: "debit" as const,
        description: "Project usage",
        timeAgo: "3m ago",
      } : null,
      pendingRefills: 3, // Example data
      totalRefills: 8,
    };
  }, [data, projectRows]);

  // Format model usage data with nice names
  const formattedModelUsage = useMemo(() => {
    if (!data?.modelUsage) return [];
    return data.modelUsage.map(model => ({
      ...model,
      displayName: formatModelName(model.model),
    }));
  }, [data?.modelUsage]);

  const handleStatusFilterChange = (status: StatusFilter) => {
    setActiveStatusFilters((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const handleProjectClick = (project: ProjectTableRow) => {
    if (project.conversationId) {
      navigate(`/workspace?conversationId=${project.conversationId}`);
    }
  };

  const handleExport = () => {
    // Export filtered projects to CSV
    const headers = ["Project Name", "Status", "Team Size", "Credits Used", "Credits Max", "Cost to Date", "Created At", "Last Updated"];
    const rows = filteredProjects.map((p) => [
      p.name,
      p.status,
      p.team.length,
      p.creditsUsage.current.toFixed(2),
      p.creditsUsage.max.toFixed(2),
      p.costToDate.toFixed(2),
      new Date(p.createdAt).toLocaleDateString(),
      new Date(p.lastUpdated).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `organization-projects-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCurrentWeekLabel = () => {
    const now = new Date();
    const month = now.toLocaleDateString("en-US", { month: "short" });
    const year = now.getFullYear();
    const weekOfMonth = Math.ceil(now.getDate() / 7);
    return `W${weekOfMonth} ${month} ${year}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="border-b border-subtle pb-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Overview section skeleton */}
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>

        {/* Table skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[45px] w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <X className="size-12 text-[#ef4444]" />
            <p className="text-center text-secondary">
              Failed to load analytics. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-0 pb-4">
        <div className="flex items-start justify-between w-full pb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-primary">Projects</h1>
            <p className="text-sm text-tertiary">
              Manage all your projects and track credit usage.
            </p>
          </div>
          <Button
            onClick={() => setIsKPIModalOpen(true)}
            variant="outline"
            className="gap-2 bg-surface-2 border-subtle hover:bg-surface-3"
          >
            <ChartLine className="size-4" />
            Show KPI
          </Button>
        </div>
        <Separator className="h-px" />
      </div>

      {/* Charts Section - 3 in a row */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium text-secondary px-1">Analytics</span>

        <div className="grid grid-cols-3 gap-4">
          {/* Credits Donut Chart */}
          <div className="border border-subtle rounded-xl bg-surface-1/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-primary">Credits by Project</h3>
              <DateSelector value={getCurrentWeekLabel()} />
            </div>
            <CreditsDonutChart
              totalCredits={creditsChartData.total}
              projects={creditsChartData.projects}
              compact
            />
          </div>

          {/* Deployments Chart */}
          <div className="border border-subtle rounded-xl bg-surface-1/50 p-4">
            <h3 className="text-sm font-medium text-primary mb-4">Deployments</h3>
            <DeploymentsByDayChart
              data={deploymentsChartData.data}
              totalDeployments={deploymentsChartData.total}
              topProjectsLabel="Of Top 3 Projects"
            />
          </div>

          {/* AI Model Usage - Compact */}
          <div className="border border-subtle rounded-xl bg-surface-1/50 p-4">
            <h3 className="text-sm font-medium text-primary mb-4">Model Usage</h3>
            <ModelUsageChartCompact
              data={formattedModelUsage}
            />
          </div>
        </div>
      </div>

      {/* All Projects Section */}
      <div className="flex flex-col gap-3">
        <ProjectsHeader onExport={handleExport} />

        <ProjectsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTimeFilter={activeTimeFilter}
          onTimeFilterChange={setActiveTimeFilter}
          activeStatusFilters={activeStatusFilters}
          onStatusFilterChange={handleStatusFilterChange}
          onExport={handleExport}
        />

        <ProjectsTable
          projects={filteredProjects}
          onProjectClick={handleProjectClick}
        />
      </div>

      {/* KPI Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={setIsKPIModalOpen}>
        <DialogContent className="!w-[95vw] !max-w-[1400px] overflow-hidden p-0 bg-surface-1 border-subtle rounded-[20px] shadow-2xl">
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-10 pt-10 pb-6 border-b border-subtle">
              <DialogHeader className="p-0">
                <DialogTitle className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-3">
                  <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10">
                    <TrendUp className="size-5 text-purple-400" weight="fill" />
                  </div>
                  Key Performance Indicators
                </DialogTitle>
              </DialogHeader>
            </div>
            
            {/* Content */}
            <div className="px-10 py-8 max-h-[70vh] overflow-y-auto">
              {/* Overview KPI Cards */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-secondary mb-5 px-1">Overview</h3>
                <div className="border border-subtle rounded-xl bg-surface-1/50 p-5">
                  {/* Top Row - 3 Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <ProjectStatsCard
                      active={overviewStats.activeProjects}
                      completed={overviewStats.completedProjects}
                      archived={overviewStats.archivedProjects}
                    />
                    <TotalCreditsCard
                      amount={overviewStats.totalCredits}
                      activeProjectsCount={overviewStats.activeProjects}
                    />
                    <CreditUsageCard
                      amount={overviewStats.creditsPerDay}
                      label="credits used on average per day"
                    />
                  </div>

                  {/* Bottom Row - 2 Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {overviewStats.lastTransaction ? (
                      <LastTransactionCard
                        amount={overviewStats.lastTransaction.amount}
                        type={overviewStats.lastTransaction.type}
                        description={overviewStats.lastTransaction.description}
                        timeAgo={overviewStats.lastTransaction.timeAgo}
                      />
                    ) : (
                      <div className="flex flex-col gap-2 p-4 rounded-xl border bg-surface-2/50 border-subtle">
                        <span className="text-xs font-medium text-secondary">Last Transaction</span>
                        <span className="text-sm text-tertiary">No transactions yet</span>
                      </div>
                    )}
                    <CreditRefillRequestsCard
                      pending={overviewStats.pendingRefills}
                      total={overviewStats.totalRefills}
                      period="this week"
                      onViewAll={() => {
                        setIsKPIModalOpen(false);
                        navigate("/admin/fund-requests");
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Overview Metrics */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-secondary mb-5 px-1">Key Metrics</h3>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <AnalyticsCard
                    title="Total Cost"
                    value={`$${data.totalCost}`}
                    icon={CurrencyDollar}
                    description="Total spending"
                    bgColor="bg-red-500/10"
                    iconColor="text-red-400"
                  />
                  <AnalyticsCard
                    title="Total Tokens"
                    value={data.totalTokens.toLocaleString()}
                    icon={Hash}
                    description="Tokens consumed"
                    bgColor="bg-blue-500/10"
                    iconColor="text-blue-400"
                  />
                  <AnalyticsCard
                    title="Total Messages"
                    value={data.totalMessages.toLocaleString()}
                    icon={ChatCircle}
                    description="Messages sent"
                    bgColor="bg-green-500/10"
                    iconColor="text-green-400"
                  />
                  <AnalyticsCard
                    title="Projects"
                    value={data.totalProjects.toLocaleString()}
                    icon={FolderKanban}
                    description="Active projects"
                    bgColor="bg-purple-500/10"
                    iconColor="text-purple-400"
                  />
                  <AnalyticsCard
                    title="Team Members"
                    value={data.totalUsers.toLocaleString()}
                    icon={Users}
                    description="Active users"
                    bgColor="bg-orange-500/10"
                    iconColor="text-orange-400"
                  />
                </div>
              </div>

              {/* Usage Stats */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-secondary mb-5 px-1">Usage Statistics</h3>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-xl border border-subtle bg-surface-2/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="size-4 text-yellow-400" />
                      <span className="text-xs font-medium text-secondary">Avg. Response Time</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">1.2s</span>
                  </div>
                  <div className="p-4 rounded-xl border border-subtle bg-surface-2/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="size-4 text-green-400" />
                      <span className="text-xs font-medium text-secondary">Success Rate</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">98.5%</span>
                  </div>
                  <div className="p-4 rounded-xl border border-subtle bg-surface-2/50">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="size-4 text-purple-400" />
                      <span className="text-xs font-medium text-secondary">Daily Growth</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">+12%</span>
                  </div>
                  <div className="p-4 rounded-xl border border-subtle bg-surface-2/50">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="size-4 text-blue-400" />
                      <span className="text-xs font-medium text-secondary">Avg. Messages/Day</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">{Math.round(data.totalMessages / 30)}</span>
                  </div>
                </div>
              </div>

              {/* Model Usage Details */}
              <div>
                <h3 className="text-sm font-medium text-secondary mb-5 px-1">AI Model Usage</h3>
                <div className="border border-subtle rounded-xl p-5">
                  <ModelUsageChart
                    data={data.modelUsage || []}
                    title=""
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
