import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { CaretRight } from "@phosphor-icons/react";

interface OverviewStatCardProps {
  title: string;
  icon?: PhosphorIcon;
  children: React.ReactNode;
  variant?: "default" | "highlight" | "action";
  onAction?: () => void;
  className?: string;
}

export function OverviewStatCard({
  title,
  icon: Icon,
  children,
  variant = "default",
  onAction,
  className = "",
}: OverviewStatCardProps) {
  const baseClasses = "flex flex-col gap-2 p-4 rounded-xl border transition-all";
  const variantClasses = {
    default: "bg-surface-2/50 border-subtle",
    highlight: "bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20",
    action: "bg-surface-2/50 border-subtle hover:border-purple-500/30 cursor-pointer group",
  };

  const Wrapper = onAction ? "button" : "div";
  const wrapperProps = onAction ? { onClick: onAction, type: "button" as const } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="flex items-center justify-center size-5 rounded bg-white/5">
              <Icon className="size-3.5 text-secondary" />
            </div>
          )}
          <span className="text-xs font-medium text-secondary">{title}</span>
        </div>
        {onAction && (
          <CaretRight className="size-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" weight="bold" />
        )}
      </div>
      {children}
    </Wrapper>
  );
}

interface ProjectStatsCardProps {
  active: number;
  completed: number;
  archived: number;
}

export function ProjectStatsCard({ active, completed, archived }: ProjectStatsCardProps) {
  return (
    <OverviewStatCard title="My Project Stats" icon={undefined}>
      <div className="flex items-end gap-6">
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-primary">{active}</span>
          <span className="text-xs font-medium text-green-400">Active</span>
        </div>
        <div className="h-8 w-px bg-subtle" />
        <div className="flex flex-col">
          <span className="text-xl font-semibold text-secondary">{completed}</span>
          <span className="text-xs text-tertiary">Completed</span>
        </div>
        <div className="h-8 w-px bg-subtle" />
        <div className="flex flex-col">
          <span className="text-xl font-semibold text-secondary">{archived}</span>
          <span className="text-xs text-tertiary">Archived</span>
        </div>
      </div>
    </OverviewStatCard>
  );
}

interface TotalCreditsCardProps {
  amount: number;
  label?: string;
  activeProjectsCount?: number;
}

export function TotalCreditsCard({ amount, label = "Total Unused Credits", activeProjectsCount = 0 }: TotalCreditsCardProps) {
  return (
    <OverviewStatCard title={label} icon={undefined} variant="highlight">
      <div className="flex flex-col gap-1">
        <span className="text-3xl font-bold text-primary">
          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {activeProjectsCount > 0 && (
          <span className="text-xs text-tertiary">
            available in {activeProjectsCount} Active Projects
          </span>
        )}
      </div>
    </OverviewStatCard>
  );
}

interface CreditUsageCardProps {
  amount: number;
  label?: string;
}

export function CreditUsageCard({ amount, label = "credits used on average per day" }: CreditUsageCardProps) {
  return (
    <OverviewStatCard title="Credit Usage" icon={undefined}>
      <div className="flex flex-col gap-1">
        <span className="text-3xl font-bold text-primary">
          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-tertiary">{label}</span>
      </div>
    </OverviewStatCard>
  );
}

interface LastTransactionCardProps {
  amount: number;
  type: "credit" | "debit";
  description: string;
  timeAgo: string;
}

export function LastTransactionCard({ amount, type, description, timeAgo }: LastTransactionCardProps) {
  const isDebit = type === "debit";
  return (
    <OverviewStatCard title="Last Transaction" icon={undefined}>
      <div className="flex flex-col gap-1">
        <span className={`text-2xl font-bold ${isDebit ? "text-red-400" : "text-green-400"}`}>
          {isDebit ? "-" : "+"}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-tertiary">
          {timeAgo} • {description}
        </span>
      </div>
    </OverviewStatCard>
  );
}

interface CreditRefillRequestsCardProps {
  pending: number;
  total: number;
  period?: string;
  onViewAll?: () => void;
}

export function CreditRefillRequestsCard({ pending, total, period = "this week", onViewAll }: CreditRefillRequestsCardProps) {
  return (
    <OverviewStatCard 
      title="Active Credit Refill Requests" 
      icon={undefined} 
      variant="action"
      onAction={onViewAll}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold text-primary">{pending}</span>
        <span className="text-lg text-tertiary">/{total}</span>
      </div>
      <span className="text-xs text-tertiary">{period}</span>
    </OverviewStatCard>
  );
}

