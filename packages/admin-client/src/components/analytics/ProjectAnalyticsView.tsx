import { useState, useEffect } from "react";
import { useProjectAnalytics } from "./hooks";
import { AnalyticsCard } from "./AnalyticsCard";
import { DailyUsageChart, ModelUsageChart } from "./AnalyticsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  MessageSquare,
  Hash,
  FileText,
  Users,
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  FolderKanban,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
  organizationId?: string;
}

interface ProjectAnalyticsViewProps {
  projects?: Project[];
  defaultProjectId?: string;
  projectId?: string; // For backward compatibility
}

export function ProjectAnalyticsView({
  projects,
  defaultProjectId,
  projectId: propProjectId,
}: ProjectAnalyticsViewProps) {
  // Support both new (projects array) and old (single projectId) API
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    propProjectId || defaultProjectId || projects?.[0]?.id || ""
  );

  useEffect(() => {
    if (defaultProjectId && !selectedProjectId) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const { data, isLoading, error } = useProjectAnalytics(selectedProjectId, true);

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  // Always show header and dropdown, even while loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                {selectedProject?.name || "Project Analytics"}
              </h2>
              <p className="text-muted-foreground">
                Track team activity, usage patterns, and deployment metrics
              </p>
            </div>
            {projects && projects.length > 0 && (
              <div className="flex items-center gap-3">
                <Label htmlFor="project-select" className="text-sm font-medium whitespace-nowrap">
                  {projects.length > 1 ? "Select Project:" : "Project:"}
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger
                    id="project-select"
                    className="w-[250px]"
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Analytics error:", error);
    return (
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                {selectedProject?.name || "Project Analytics"}
              </h2>
              <p className="text-muted-foreground">
                Track team activity, usage patterns, and deployment metrics
              </p>
            </div>
            {projects && projects.length > 0 && (
              <div className="flex items-center gap-3">
                <Label htmlFor="project-select" className="text-sm font-medium whitespace-nowrap">
                  {projects.length > 1 ? "Select Project:" : "Project:"}
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger
                    id="project-select"
                    className="w-[250px]"
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Failed to load analytics. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                {selectedProject?.name || "Project Analytics"}
              </h2>
              <p className="text-muted-foreground">
                Track team activity, usage patterns, and deployment metrics
              </p>
            </div>
            {projects && projects.length > 0 && (
              <div className="flex items-center gap-3">
                <Label htmlFor="project-select" className="text-sm font-medium whitespace-nowrap">
                  {projects.length > 1 ? "Select Project:" : "Project:"}
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger
                    id="project-select"
                    className="w-[250px]"
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No analytics data available. Please try selecting a different project.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2">
              {data?.projectName || selectedProject?.name || "Project Analytics"}
            </h2>
            <p className="text-muted-foreground">
              Track team activity, usage patterns, and deployment metrics
            </p>
          </div>
          {projects && projects.length > 0 && (
            <div className="flex items-center gap-3">
              <Label htmlFor="project-select" className="text-sm font-medium whitespace-nowrap">
                {projects.length > 1 ? "Select Project:" : "Project:"}
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger
                  id="project-select"
                  className="w-[250px]"
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <AnalyticsCard
          title="Total Cost"
          value={`$${data.totalCost}`}
          icon={DollarSign}
          description="Total spending"
          bgColor="bg-red-100 dark:bg-red-900/20"
          iconColor="text-red-600 dark:text-red-400"
        />
        <AnalyticsCard
          title="Total Tokens"
          value={data.totalTokens.toLocaleString()}
          icon={Hash}
          description="Tokens consumed"
          bgColor="bg-blue-100 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <AnalyticsCard
          title="Total Messages"
          value={data.totalMessages.toLocaleString()}
          icon={MessageSquare}
          description="Messages sent"
          bgColor="bg-green-100 dark:bg-green-900/20"
          iconColor="text-green-600 dark:text-green-400"
        />
        <AnalyticsCard
          title="Conversations"
          value={data.totalConversations.toLocaleString()}
          icon={FileText}
          description="Total conversations"
          bgColor="bg-purple-100 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <AnalyticsCard
          title="Team Members"
          value={data.totalUsers.toLocaleString()}
          icon={Users}
          description="Active users"
          bgColor="bg-orange-100 dark:bg-orange-900/20"
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* User Activity - Most Important for Project Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Member Activity
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            See which team members are most active in this project
          </p>
        </CardHeader>
        <CardContent>
          {data.userBreakdown.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="text-right">Tokens Used</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.userBreakdown.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-sm">
                          {user.name || user.email || user.userId?.substring(0, 12) || "Unknown User"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {user.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${user.cost}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.messages || user.count}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.conversations || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium mb-2">
                No team activity yet
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Team member activity will appear here once members start using
                the project. Make sure team members are added to the project and
                they begin creating conversations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {data.dailyUsage.length > 0 ? (
          <DailyUsageChart
            data={data.dailyUsage}
            title="Daily Activity (Last 30 Days)"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">
                  No activity yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Start using the project to see daily usage analytics
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.modelUsage.length > 0 ? (
          <ModelUsageChart
            data={data.modelUsage}
            title="AI Model Usage Distribution"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>AI Model Usage Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Hash className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">
                  No model usage yet
                </p>
                <p className="text-sm text-muted-foreground">
                  AI model usage will appear here once team members start using
                  the project
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Model Usage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Model Usage Details</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Breakdown of AI models used by your team
          </p>
        </CardHeader>
        <CardContent>
          {data.modelUsage.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Usage %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modelUsage.map((model) => (
                  <TableRow key={model.model}>
                    <TableCell className="font-medium">{model.model}</TableCell>
                    <TableCell className="text-right">
                      {model.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${model.cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{model.count}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">{model.percentage}%</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Hash className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">
                No model usage data available yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deployment Analytics
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Track deployment activity and success rates
          </p>
        </CardHeader>
        <CardContent>
          {data.deployments && data.deployments.total > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <AnalyticsCard
                  title="Total Deployments"
                  value={data.deployments.total.toLocaleString()}
                  icon={Rocket}
                  description="All deployments"
                  bgColor="bg-blue-100 dark:bg-blue-900/20"
                  iconColor="text-blue-600 dark:text-blue-400"
                />
                <AnalyticsCard
                  title="Successful"
                  value={data.deployments.successful.toLocaleString()}
                  icon={CheckCircle2}
                  description="Successful deployments"
                  bgColor="bg-green-100 dark:bg-green-900/20"
                  iconColor="text-green-600 dark:text-green-400"
                />
                <AnalyticsCard
                  title="Failed"
                  value={data.deployments.failed.toLocaleString()}
                  icon={XCircle}
                  description="Failed deployments"
                  bgColor="bg-red-100 dark:bg-red-900/20"
                  iconColor="text-red-600 dark:text-red-400"
                />
                <AnalyticsCard
                  title="Pending"
                  value={data.deployments.pending.toLocaleString()}
                  icon={Clock}
                  description="Pending deployments"
                  bgColor="bg-yellow-100 dark:bg-yellow-900/20"
                  iconColor="text-yellow-600 dark:text-yellow-400"
                />
              </div>

              {data.deployments.byPlatform &&
                data.deployments.byPlatform.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3">
                      Deployments by Platform
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">
                            Successful
                          </TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                          <TableHead className="text-right">Pending</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.deployments.byPlatform.map((platform) => (
                          <TableRow key={platform.platform}>
                            <TableCell className="font-medium capitalize">
                              {platform.platform}
                            </TableCell>
                            <TableCell className="text-right">
                              {platform.total}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {platform.successful}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {platform.failed}
                            </TableCell>
                            <TableCell className="text-right text-yellow-600">
                              {platform.pending}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

              {data.deployments.byUser &&
                data.deployments.byUser.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">
                      Deployments by User
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">
                            Successful
                          </TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.deployments.byUser.map((user) => (
                          <TableRow key={user.userId}>
                            <TableCell className="font-medium text-sm">
                              {user.name || user.email || user.userId?.substring(0, 12) || "Unknown User"}
                            </TableCell>
                            <TableCell className="text-right">
                              {user.total}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {user.successful}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {user.failed}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Rocket className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium mb-2">
                No deployments yet
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Deployment analytics will appear here once team members start
                deploying projects to Vercel, Netlify, or other platforms.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
