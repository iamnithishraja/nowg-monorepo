import type { ComponentType } from "react";
import { Card, CardContent } from "../../ui/card";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  bgColor?: string;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function AnalyticsCard({
  title,
  value,
  icon: Icon,
  description,
  bgColor = "bg-violet-500/10",
  iconColor = "text-violet-400",
  trend,
}: AnalyticsCardProps) {
  return (
    <Card className="bg-surface-1 border border-subtle rounded-xl hover:border-subtle/80 hover:bg-surface-1/80 transition-all duration-200 group overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium text-tertiary tracking-wide uppercase">
              {title}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary tracking-tight">
                {value}
              </span>
              {trend && (
                <span
                  className={`text-xs font-semibold ${
                    trend.isPositive ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <span className="text-[11px] text-tertiary mt-0.5">{description}</span>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgColor} group-hover:scale-105 transition-transform duration-200`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
