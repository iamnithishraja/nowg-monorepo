import { useOrganizationAnalytics } from "./hooks";
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
  DollarSign,
  MessageSquare,
  Hash,
  FileText,
  Users,
  FolderKanban,
  Rocket,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OrganizationAnalyticsViewProps {
  organizationId: string;
}

export function OrganizationAnalyticsView({
  organizationId,
}: OrganizationAnalyticsViewProps) {
  const { data, isLoading, error } = useOrganizationAnalytics(
    organizationId,
    true
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Failed to load analytics. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-3xl font-bold mb-2">Organization Analytics</h2>
        <p className="text-muted-foreground">
          Monitor project performance, team productivity, and resource usage
          across your organization
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <AnalyticsCard
          title="Total Cost"
          value={`$${data.totalCost}`}
          icon={DollarSign}
          description="Organization spending"
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
        <AnalyticsCard
          title="Active Projects"
          value={data.totalProjects.toLocaleString()}
          icon={FolderKanban}
          description="Total projects"
          bgColor="bg-indigo-100 dark:bg-indigo-900/20"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Project Activity - Most Important for Org Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Project Activity Overview
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all projects in your organization, sorted by activity
          </p>
        </CardHeader>
        <CardContent>
          {data.projectBreakdown.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Tokens Used</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                  <TableHead className="text-right">Team Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projectBreakdown.map((project, index) => (
                  <TableRow key={project.projectId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span>{project.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {project.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${project.cost}
                    </TableCell>
                    <TableCell className="text-right">
                      {project.messages || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {project.conversations || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {project.users || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium mb-2">
                No project activity yet
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Project activity will appear here once projects are created and
                team members start using them. Make sure projects are set up and
                team members are actively working.
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
            title="Organization Activity (Last 30 Days)"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Organization Activity (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">
                  No activity yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Start using projects to see organization-wide activity
                  analytics
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.modelUsage.length > 0 ? (
          <ModelUsageChart
            data={data.modelUsage}
            title="AI Model Usage Across Projects"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>AI Model Usage Across Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Hash className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">
                  No model usage yet
                </p>
                <p className="text-sm text-muted-foreground">
                  AI model usage will appear here once projects start using AI
                  features
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
            AI models used across all projects in your organization
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

      {/* Top Users - Less prominent for org admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Contributors
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Most active users across all projects
          </p>
        </CardHeader>
        <CardContent>
          {data.userBreakdown.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.userBreakdown.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-medium text-sm">
                      {user.name || user.email || user.userId?.substring(0, 12) || "Unknown User"}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">${user.cost}</TableCell>
                    <TableCell className="text-right">{user.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">
                No user activity data available yet
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
            Track deployment activity across all projects
          </p>
        </CardHeader>
        <CardContent>
          {data.deployments && data.deployments.total > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
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
              </div>

              {data.deployments.byProject &&
                data.deployments.byProject.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">
                      Deployments by Project
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">
                            Successful
                          </TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.deployments.byProject.map((project) => (
                          <TableRow key={project.projectId}>
                            <TableCell className="font-medium">
                              {project.projectName}
                            </TableCell>
                            <TableCell className="text-right">
                              {project.total}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {project.successful}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {project.failed}
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
                Deployment analytics will appear here once projects are deployed
                to Vercel, Netlify, or other platforms.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


