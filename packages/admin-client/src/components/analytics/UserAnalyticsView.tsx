import { useUserAnalytics } from "./hooks";
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
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserAnalyticsViewProps {
  userId: string;
}

export function UserAnalyticsView({ userId }: UserAnalyticsViewProps) {
  const { data, isLoading, error } = useUserAnalytics(userId, true);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {data.dailyUsage.length > 0 && (
        <DailyUsageChart
          data={data.dailyUsage}
          title="Daily Usage (Last 30 Days)"
        />
      )}

      {data.modelUsage.length > 0 && (
        <>
          <ModelUsageChart data={data.modelUsage} title="Model Usage" />
          <Card>
            <CardHeader>
              <CardTitle>Model Usage Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.modelUsage.map((model) => (
                    <TableRow key={model.model}>
                      <TableCell className="font-medium">
                        {model.model}
                      </TableCell>
                      <TableCell className="text-right">
                        {model.tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${model.cost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {model.count}
                      </TableCell>
                      <TableCell className="text-right">
                        {model.percentage}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
