import { Card } from "@/components/ui/card";
import { DashboardHeader } from "./DashboardHeader";
import { MetricCard } from "./MetricCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { SystemStatusCard } from "./SystemStatusCard";
import { DashboardStats } from "./types";
import {
  Users,
  CreditCard,
  DollarSign,
  Zap,
  Activity,
  Settings,
} from "lucide-react";

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
      icon: DollarSign,
      testId: "metric-total-revenue",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500",
      description: "All time earnings",
      href: "/admin/billing",
    },
    {
      title: "Tokens Today",
      value: (stats?.tokenUsageToday || 0).toLocaleString(),
      icon: Zap,
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
      icon: Activity,
      href: "/admin/tokens",
    },
    {
      title: "LLM Settings",
      description: "Configure AI models",
      icon: Settings,
      href: "/admin/llm-configs",
    },
  ];

  if (isLoading) {
    return (
      <>
        <DashboardHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border shadow-sm">
              <div className="p-6">
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-4" />
                <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader subtitle="Welcome to your AI Code Platform admin panel" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QuickActionsCard actions={quickActions} />
        <SystemStatusCard />
      </div>
    </>
  );
}
