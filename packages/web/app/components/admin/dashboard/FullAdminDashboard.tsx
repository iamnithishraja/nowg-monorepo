import {
    ChartLine,
    CreditCard,
    CurrencyDollar,
    GearSix,
    Users,
    Lightning
} from "@phosphor-icons/react";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { DashboardHeader } from "./DashboardHeader";
import { MetricCard } from "./MetricCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { SystemStatusCard } from "./SystemStatusCard";
import type { DashboardStats } from "./types";

interface FullAdminDashboardProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

export function FullAdminDashboard({
  stats,
  isLoading,
}: FullAdminDashboardProps) {
  const metrics = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      testId: "metric-total-users",
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
      description: "Registered accounts",
      href: "/admin/users",
    },
    {
      title: "Active Subscriptions",
      value: stats?.activeSubscriptions || 0,
      icon: CreditCard,
      testId: "metric-active-subscriptions",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500",
      description: "Paying customers",
      href: "/admin/billing",
    },
    {
      title: "Total Revenue",
      value: `$${parseFloat(stats?.totalRevenue || "0").toLocaleString()}`,
      icon: CurrencyDollar,
      testId: "metric-total-revenue",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500",
      description: "All time earnings",
      href: "/admin/billing",
    },
    {
      title: "Tokens Today",
      value: (stats?.tokenUsageToday || 0).toLocaleString(),
      icon: Lightning,
      testId: "metric-tokens-today",
      bgColor: "bg-cyan-500/10",
      iconColor: "text-cyan-500",
      description: "API usage today",
      href: "/admin/tokens",
    },
  ];

  const quickActions = [
    {
      title: "Manage Users",
      description: "View and manage user accounts",
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Token Management",
      description: "Monitor usage and costs",
      icon: ChartLine,
      href: "/admin/tokens",
    },
    {
      title: "LLM Settings",
      description: "Configure AI models",
      icon: GearSix,
      href: "/admin/llm-configs",
    },
  ];

  if (isLoading) {
    return (
      <>
        <DashboardHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-surface-1 border border-subtle rounded-[12px]">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-3 w-24 bg-surface-2" />
                  <Skeleton className="h-9 w-9 rounded-[6px] bg-surface-2" />
                </div>
                <Skeleton className="h-8 w-20 mb-2 bg-surface-2" />
                <Skeleton className="h-3 w-28 bg-surface-2" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-surface-1 border border-subtle rounded-[12px] h-full">
            <div className="p-4">
              <Skeleton className="h-5 w-32 mb-4 bg-surface-2" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 bg-surface-2" />
                ))}
              </div>
            </div>
          </Card>
          <Card className="bg-surface-1 border border-subtle rounded-[12px] h-full">
            <div className="p-4">
              <Skeleton className="h-5 w-32 mb-4 bg-surface-2" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full bg-surface-2" />
                ))}
                <Skeleton className="h-9 w-full mt-4 bg-surface-2" />
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader subtitle="Welcome to your AI Code Platform admin panel" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QuickActionsCard actions={quickActions} />
        <SystemStatusCard />
      </div>
    </>
  );
}
