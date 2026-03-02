import {
  Activity,
  Loader2,
  Menu,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { redirect } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "../components";
import { AnalyticsSkeleton } from "../components/AnalyticsSkeleton";
import { ProjectSidebar } from "../components/ProjectSidebar";
import Background from "../components/Background";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../components/ui/chart";
import {
  Tabs,
  TabsList,
  TabsTrigger
} from "../components/ui/tabs";
import { auth } from "../lib/auth";
import type { Route } from "./+types/analytics";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  // Return empty data - we'll fetch on client side to show skeleton immediately
  return { analyticsData: null, user: session.user };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Analytics - Nowgai" },
    { name: "description", content: "View your usage analytics and metrics" },
  ];
}

function AnalyticsContent({ loaderData }: { loaderData?: { user?: any } }) {
  const user = loaderData?.user;
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setIsNarrow(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const [data, setData] = useState({
    conversationsOverTime: [],
    tokensUsed: [],
    costOverTime: [],
    modelUsage: [],
    deploymentStats: [
      { status: "Successful", count: 0, color: "#22c55e" },
      { status: "Failed", count: 0, color: "#ef4444" },
      { status: "In Progress", count: 0, color: "#f59e0b" },
    ],
    summary: {
      totalConversations: 0,
      totalMessages: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    },
    managedDb: {
      costOverTime: [],
      totalCost: 0,
      totalComputeCost: 0,
      totalStorageCost: 0,
      totalUsageRecords: 0,
      hasData: false,
    },
  });

  // Data fetching function
  const fetchData = async () => {
    try {
      const response = await fetch(`/api/analytics?range=${timeRange}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        }
      } else {
        const errorText = await response.text();
        console.error("Analytics API failed:", response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to fetch analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Summary stats - use current data (which updates with time range)
  const currentStats = data?.summary;

  // Helper function to convert model identifiers to friendly names
  const getFriendlyModelName = (modelId: string): string => {
    if (!modelId) return "Unknown Model";

    // Handle different model identifier formats
    if (modelId.includes("claude-3.5-sonnet")) return "Claude 3.5 Sonnet";
    if (modelId.includes("claude-4.5-sonnet")) return "Claude 4.5 Sonnet";
    if (modelId.includes("claude-3-opus")) return "Claude 3 Opus";
    if (modelId.includes("gpt-4")) return "GPT-4";
    if (modelId.includes("gpt-3.5")) return "GPT-3.5";
    if (modelId.includes("gemini-2.5")) return "Gemini 2.5";
    if (modelId.includes("gemini")) return "Gemini";

    // Fallback for unknown models - extract the base name
    const parts = modelId.split("/");
    const baseName = parts[parts.length - 1];
    return baseName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const stats = [
    {
      title: "Total Conversations",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        currentStats?.totalConversations?.toString() || "0"
      ),
      icon: MessageSquare,
    },
    {
      title: "Messages Sent",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        currentStats?.totalMessages?.toString() || "0"
      ),
      icon: Sparkles,
    },
    {
      title: "Total Cost",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentStats?.totalCost &&
        typeof currentStats.totalCost === "number" ? (
        `$${currentStats.totalCost.toFixed(2)}`
      ) : (
        currentStats?.totalCost || "$0.00"
      ),
      icon: TrendingUp,
    },
    {
      title: "Input Tokens",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentStats?.totalInputTokens &&
        typeof currentStats.totalInputTokens === "number" ? (
        currentStats.totalInputTokens.toLocaleString()
      ) : (
        currentStats?.totalInputTokens?.toString() || "0"
      ),
      icon: Zap,
    },
    {
      title: "Output Tokens",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentStats?.totalOutputTokens &&
        typeof currentStats.totalOutputTokens === "number" ? (
        currentStats.totalOutputTokens.toLocaleString()
      ) : (
        currentStats?.totalOutputTokens?.toString() || "0"
      ),
      icon: Zap,
    },
    {
      title: "Total Tokens",
      value: isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentStats?.totalTokens &&
        typeof currentStats.totalTokens === "number" ? (
        currentStats.totalTokens.toLocaleString()
      ) : (
        currentStats?.totalTokens?.toString() || "0"
      ),
      icon: Zap,
    },
  ];

  const chartConfig = {
    conversations: {
      label: "Conversations",
      color: "#22c55e",
    },
    messages: {
      label: "Messages",
      color: "#3b82f6",
    },
    inputTokens: {
      label: "Input Tokens",
      color: "#3b82f6",
    },
    outputTokens: {
      label: "Output Tokens",
      color: "#f59e0b",
    },
    tokens: {
      label: "Total Tokens",
      color: "#a855f7",
    },
    projects: {
      label: "Projects",
      color: "#f59e0b",
    },
    responseTime: {
      label: "Response Time (s)",
      color: "#ec4899",
    },
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Background />
      </div>

      {/* Left Sidebar - ProjectSidebar */}
      <ProjectSidebar user={user} className="flex-shrink-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile: menu button to open sidebar */}
        <div className="md:hidden flex items-center px-3 py-2 border-b border-border/30 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("openProjectSidebar"))}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 text-tertiary hover:text-primary transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <Header showAuthButtons={false} showSidebarToggle={false} />

          <main className="relative z-20 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {isLoading ? (
                <AnalyticsSkeleton />
              ) : (
                <>
                  {/* Page Header - stacked on mobile for better touch targets */}
                  <div className="mb-4 sm:mb-6 lg:mb-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors duration-300 flex-shrink-0">
                          <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent truncate">
                            Analytics
                          </h1>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsLoading(true);
                          fetchData();
                        }}
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/70 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 sm:mr-2 group-hover:rotate-180 transition-transform duration-500" />
                        )}
                        <span className="hidden sm:inline">Refresh</span>
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-sm sm:text-base mt-1">
                      Track your usage, performance, and insights
                    </p>
                  </div>

                  {/* Time Range Selector - full width on mobile, touch-friendly */}
                  <Tabs
                    value={timeRange}
                    onValueChange={(v) => setTimeRange(v as any)}
                    className="mb-4 sm:mb-6"
                  >
                    <TabsList className="w-full sm:w-auto grid grid-cols-3 h-11 sm:h-9 bg-muted/30 border border-border/60 p-1">
                      <TabsTrigger value="7d" className="text-xs sm:text-sm">7 days</TabsTrigger>
                      <TabsTrigger value="30d" className="text-xs sm:text-sm">30 days</TabsTrigger>
                      <TabsTrigger value="90d" className="text-xs sm:text-sm">90 days</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Summary Stats Grid - 2 cols mobile, 3 cols desktop */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
                    {stats.map((stat, index) => (
                      <div
                        key={index}
                        className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent"
                      >
                        <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 sm:pb-3 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground/90 truncate pr-1">
                              {stat.title}
                            </CardTitle>
                            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                              <stat.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                            <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent truncate">
                              {stat.value}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>

                  {/* Charts Grid - single column on mobile for better readability */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                    {/* Conversations & Messages Over Time */}
                    <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                      <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                        <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                            Activity Over Time
                          </CardTitle>
                          <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                            Conversations and messages per day
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-[220px] sm:h-[280px] lg:h-[300px]">
                              <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                          ) : (
                            <ChartContainer
                              config={chartConfig}
                              className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.conversationsOverTime}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#333"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <ChartTooltip
                                    content={<ChartTooltipContent />}
                                  />
                                  <Legend />
                                  <Line
                                    type="monotone"
                                    dataKey="conversations"
                                    stroke={chartConfig.conversations.color}
                                    strokeWidth={2}
                                    dot={{
                                      fill: chartConfig.conversations.color,
                                    }}
                                    name="Conversations"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="messages"
                                    stroke={chartConfig.messages.color}
                                    strokeWidth={2}
                                    dot={{ fill: chartConfig.messages.color }}
                                    name="Messages"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Token Usage */}
                    <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                      <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                        <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                            Token Usage
                          </CardTitle>
                          <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                            Daily token consumption (Input vs Output)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-[220px] sm:h-[280px] lg:h-[300px]">
                              <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                          ) : (
                            <ChartContainer
                              config={chartConfig}
                              className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.tokensUsed}>
                                  <defs>
                                    <linearGradient
                                      id="colorInputTokens"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="5%"
                                        stopColor={
                                          chartConfig.inputTokens.color
                                        }
                                        stopOpacity={0.4}
                                      />
                                      <stop
                                        offset="95%"
                                        stopColor={
                                          chartConfig.inputTokens.color
                                        }
                                        stopOpacity={0.1}
                                      />
                                    </linearGradient>
                                    <linearGradient
                                      id="colorOutputTokens"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="5%"
                                        stopColor={
                                          chartConfig.outputTokens.color
                                        }
                                        stopOpacity={0.4}
                                      />
                                      <stop
                                        offset="95%"
                                        stopColor={
                                          chartConfig.outputTokens.color
                                        }
                                        stopOpacity={0.1}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#333"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <ChartTooltip
                                    content={<ChartTooltipContent />}
                                  />
                                  <Legend />
                                  <Area
                                    type="monotone"
                                    dataKey="inputTokens"
                                    stackId="1"
                                    stroke={chartConfig.inputTokens.color}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorInputTokens)"
                                    name="Input Tokens"
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="outputTokens"
                                    stackId="1"
                                    stroke={chartConfig.outputTokens.color}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorOutputTokens)"
                                    name="Output Tokens"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Model Usage Distribution */}
                    <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                      <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                        <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                            Model Usage
                          </CardTitle>
                          <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                            Distribution by AI model
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-[220px] sm:h-[280px] lg:h-[300px]">
                              <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                          ) : (
                            <ChartContainer
                              config={chartConfig}
                              className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={data.modelUsage}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => {
                                      const friendlyName =
                                        getFriendlyModelName(name);
                                      return `${friendlyName}: ${(
                                        percent * 100
                                      ).toFixed(0)}%`;
                                    }}
                                    outerRadius={isNarrow ? 75 : 120}
                                    fill="#8884d8"
                                    dataKey="value"
                                  >
                                    {data.modelUsage.map(
                                      (entry: any, index: number) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={entry.color}
                                        />
                                      )
                                    )}
                                  </Pie>
                                  <ChartTooltip
                                    content={<ChartTooltipContent />}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Conversations Over Time */}
                    <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                      <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                        <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                            Conversations Over Time
                          </CardTitle>
                          <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                            Daily conversations created
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-[220px] sm:h-[280px] lg:h-[300px]">
                              <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                          ) : (
                            <ChartContainer
                              config={chartConfig}
                              className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.conversationsOverTime}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#333"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    stroke="#888"
                                    fontSize={12}
                                    tickLine={false}
                                  />
                                  <ChartTooltip
                                    content={<ChartTooltipContent />}
                                  />
                                  <Bar
                                    dataKey="conversations"
                                    fill="#eab308"
                                    radius={[8, 8, 0, 0]}
                                    name="Conversations"
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cost Over Time - Full Width */}
                    <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent lg:col-span-2">
                      <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                        <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                          <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                            Cost Over Time
                          </CardTitle>
                          <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                            Daily cost breakdown
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                          <ChartContainer
                            config={chartConfig}
                            className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={data.costOverTime || data.tokensUsed}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#333"
                                />
                                <XAxis
                                  dataKey="date"
                                  stroke="#888"
                                  fontSize={12}
                                  tickLine={false}
                                />
                                <YAxis
                                  stroke="#888"
                                  fontSize={12}
                                  tickLine={false}
                                />
                                <ChartTooltip
                                  content={<ChartTooltipContent />}
                                />
                                <Line
                                  type="monotone"
                                  dataKey={
                                    data.costOverTime ? "cost" : "tokens"
                                  }
                                  stroke={chartConfig.tokens.color}
                                  strokeWidth={2}
                                  dot={{ fill: chartConfig.tokens.color }}
                                  name={
                                    data.costOverTime ? "Cost ($)" : "Tokens"
                                  }
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Managed Database Analytics Section */}
                  <div className="mt-6 sm:mt-8">
                    <div className="mb-4 sm:mb-6">
                      <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Managed Database
                      </h2>
                      <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                        Usage and billing for managed Neon databases
                      </p>
                    </div>

                    {data.managedDb?.hasData ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Managed DB Cost Over Time */}
                        <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent lg:col-span-2">
                          <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
                              <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                                Managed Database Cost Over Time
                              </CardTitle>
                              <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                                Daily cost breakdown for managed databases
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-6 pt-0">
                              <ChartContainer
                                config={chartConfig}
                                className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-h-0"
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart
                                    data={data.managedDb?.costOverTime || []}
                                  >
                                    <defs>
                                      <linearGradient
                                        id="colorManagedDbCost"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                      >
                                        <stop
                                          offset="5%"
                                          stopColor="#10b981"
                                          stopOpacity={0.4}
                                        />
                                        <stop
                                          offset="95%"
                                          stopColor="#10b981"
                                          stopOpacity={0.1}
                                        />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                      strokeDasharray="3 3"
                                      stroke="#333"
                                    />
                                    <XAxis
                                      dataKey="date"
                                      stroke="#888"
                                      fontSize={12}
                                      tickLine={false}
                                    />
                                    <YAxis
                                      stroke="#888"
                                      fontSize={12}
                                      tickLine={false}
                                    />
                                    <ChartTooltip
                                      content={<ChartTooltipContent />}
                                    />
                                    <Area
                                      type="monotone"
                                      dataKey="cost"
                                      stroke="#10b981"
                                      strokeWidth={2}
                                      fillOpacity={1}
                                      fill="url(#colorManagedDbCost)"
                                      name="Cost ($)"
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </ChartContainer>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Managed DB Summary Stats - 2 cols on mobile */}
                        <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                          <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-4 sm:pb-3">
                              <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                                Total Cost
                              </CardTitle>
                              <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                                Lifetime managed database costs
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-4">
                              <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                ${(data.managedDb?.totalCost || 0).toFixed(4)}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                          <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-4 sm:pb-3">
                              <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                                Usage Records
                              </CardTitle>
                              <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                                Total hourly usage records
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-4">
                              <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                {(
                                  data.managedDb?.totalUsageRecords || 0
                                ).toLocaleString()}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                          <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-4 sm:pb-3">
                              <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                                Compute Cost
                              </CardTitle>
                              <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                                Total compute costs
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-4">
                              <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                $
                                {(
                                  data.managedDb?.totalComputeCost || 0
                                ).toFixed(4)}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                          <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full">
                            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-4 sm:pb-3">
                              <CardTitle className="text-base sm:text-xl font-semibold text-foreground">
                                Storage Cost
                              </CardTitle>
                              <CardDescription className="text-muted-foreground/80 text-xs sm:text-sm">
                                Total storage costs
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-4">
                              <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                $
                                {(
                                  data.managedDb?.totalStorageCost || 0
                                ).toFixed(4)}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    ) : (
                      <div className="p-[1px] rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                        <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl shadow-xl shadow-black/30 h-full">
                          <CardContent className="p-6 sm:p-12 flex flex-col items-center justify-center">
                            <div className="text-muted-foreground text-center px-2">
                              <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                              <p className="text-base sm:text-lg font-medium mb-2">
                                No Data Available
                              </p>
                              <p className="text-xs sm:text-sm max-w-sm mx-auto">
                                No managed database usage data for the selected time range.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
  );
}

export default function Analytics({ loaderData }: Route.ComponentProps) {
  return <AnalyticsContent loaderData={loaderData} />;
}
