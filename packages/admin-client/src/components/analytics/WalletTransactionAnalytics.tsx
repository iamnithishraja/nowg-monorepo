import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WalletDailyUsage,
  OrganizationWalletAnalytics,
  ProjectWalletAnalytics,
} from "./hooks";
import { AnalyticsCard } from "./AnalyticsCard";

interface WalletTransactionAnalyticsProps {
  data: OrganizationWalletAnalytics | ProjectWalletAnalytics | undefined;
  isLoading: boolean;
  error: Error | null;
  isProject?: boolean;
}

export function WalletTransactionAnalytics({
  data,
  isLoading,
  error,
  isProject = false,
}: WalletTransactionAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Failed to load wallet analytics. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    credits: {
      label: "Credits",
      color: "hsl(142, 76%, 36%)", // green
    },
    debits: {
      label: "Debits",
      color: "hsl(0, 84%, 60%)", // red
    },
    creditBacks: {
      label: "Credit Backs",
      color: "hsl(221, 83%, 53%)", // blue
    },
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-3xl font-bold mb-2">
          {isProject ? "Project" : "Organization"} Wallet Analytics
        </h2>
        <p className="text-muted-foreground">
          Track wallet transactions, credits, debits, and credit backs
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <AnalyticsCard
          title="Current Balance"
          value={`$${(data.currentBalance ?? 0).toFixed(2)}`}
          icon={Wallet}
          description="Available balance"
          bgColor="bg-blue-100 dark:bg-blue-900/20"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <AnalyticsCard
          title="Total Credits"
          value={`$${data.totalCredits || "0.00"}`}
          icon={ArrowUpCircle}
          description="Total credits added"
          bgColor="bg-green-100 dark:bg-green-900/20"
          iconColor="text-green-600 dark:text-green-400"
        />
        <AnalyticsCard
          title="Total Debits"
          value={`$${data.totalDebits || "0.00"}`}
          icon={ArrowDownCircle}
          description="Total debits"
          bgColor="bg-red-100 dark:bg-red-900/20"
          iconColor="text-red-600 dark:text-red-400"
        />
        <AnalyticsCard
          title="Credit Backs"
          value={`$${data.totalCreditBacks || "0.00"}`}
          icon={RotateCcw}
          description="Total credit backs"
          bgColor="bg-purple-100 dark:bg-purple-900/20"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <AnalyticsCard
          title="Net Amount"
          value={`$${data.netAmount || "0.00"}`}
          icon={TrendingUp}
          description="Net transaction amount"
          bgColor="bg-orange-100 dark:bg-orange-900/20"
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Daily Usage Chart */}
      {data.dailyUsage && data.dailyUsage.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Daily Transaction Activity (Last 30 Days)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track daily credits, debits, and credit backs
            </p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart data={data.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar
                  dataKey="credits"
                  fill={chartConfig.credits.color}
                  name="Credits"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="debits"
                  fill={chartConfig.debits.color}
                  name="Debits"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="creditBacks"
                  fill={chartConfig.creditBacks.color}
                  name="Credit Backs"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Daily Transaction Activity (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium mb-2">
                No transaction activity yet
              </p>
              <p className="text-sm text-muted-foreground">
                Transaction activity will appear here once wallet transactions
                are made
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Transaction Summary
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of all wallet transactions
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Credit Transactions
              </p>
              <p className="text-2xl font-bold text-green-600">
                {data.transactionBreakdown?.credits?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: ${data.totalCredits || "0.00"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Debit Transactions
              </p>
              <p className="text-2xl font-bold text-red-600">
                {data.transactionBreakdown?.debits?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: ${data.totalDebits || "0.00"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Credit Back Transactions
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {data.transactionBreakdown?.creditBacks?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: ${data.totalCreditBacks || "0.00"}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total Transactions:{" "}
              <span className="font-semibold text-foreground">
                {data.transactionCount || 0}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

