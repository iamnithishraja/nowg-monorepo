import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Button } from "../../ui/button";

interface TokenCategory {
  name: string;
  percentage: number;
  amount: number;
  color: string;
}

interface ProjectCreditsSectionProps {
  creditsAvailable: number;
  creditsUsed: number;
  tokenCategories: TokenCategory[];
  onManageCredits?: () => void;
  onViewTransactions?: () => void;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f97316"];

export function ProjectCreditsSection({
  creditsAvailable,
  creditsUsed,
  tokenCategories,
  onManageCredits,
  onViewTransactions,
}: ProjectCreditsSectionProps) {
  // Prepare data for the chart
  const chartData = tokenCategories.map((category, index) => ({
    ...category,
    color: category.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Show empty state if no data
  if (!chartData || chartData.length === 0 || chartData.every((c) => c.amount === 0)) {
    return (
      <div className="flex items-center gap-6 w-full">
        {/* Credits Available Card */}
        <div className="flex flex-col gap-4 p-5 border-r border-subtle w-64 shrink-0">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Project Credits Available</span>
            <span className="text-3xl font-semibold text-primary">
              ${creditsAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full border-subtle text-primary hover:bg-surface-2"
            onClick={onManageCredits}
          >
            Manage Project Credits
          </Button>
          <Button
            variant="outline"
            className="w-full border-subtle text-primary hover:bg-surface-2"
            onClick={onViewTransactions}
          >
            Transaction History
          </Button>
        </div>

        {/* Empty State */}
        <div className="flex-1 text-center py-8">
          <p className="text-tertiary">No token usage data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 w-full">
      {/* Credits Available Card */}
      <div className="flex flex-col gap-4 p-5 border-r border-subtle w-64 shrink-0">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-secondary">Project Credits Available</span>
          <span className="text-3xl font-semibold text-primary">
            ${creditsAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <Button
          variant="outline"
          className="w-full border-subtle text-primary hover:bg-surface-2"
          onClick={onManageCredits}
        >
          Manage Project Credits
        </Button>
        <Button
          variant="outline"
          className="w-full border-subtle text-primary hover:bg-surface-2"
          onClick={onViewTransactions}
        >
          Transaction History
        </Button>
      </div>

      {/* Donut Chart and Legend */}
      <div className="flex gap-8 items-center flex-1">
        <div className="relative size-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="amount"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-medium text-primary">
              ${creditsUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-secondary">Credits Used</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 flex-1">
          {chartData.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-secondary">
                  {category.name} ({category.percentage}%)
                </span>
              </div>
              <span className="text-sm font-medium text-primary">
                ${category.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact version for the redesigned analytics page
interface ProjectCreditsCompactProps {
  creditsAvailable: number;
  creditsUsed: number;
  tokenCategories: TokenCategory[];
}

export function ProjectCreditsCompact({
  creditsAvailable,
  creditsUsed,
  tokenCategories,
}: ProjectCreditsCompactProps) {
  const chartData = tokenCategories.map((category, index) => ({
    ...category,
    color: category.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const usagePercentage = creditsAvailable > 0 ? Math.min((creditsUsed / creditsAvailable) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Stats */}
      <div className="flex items-center gap-4">
        {/* Mini Donut Chart */}
        <div className="relative size-[80px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { value: creditsUsed, color: "#7b4cff" },
                  { value: Math.max(0, creditsAvailable - creditsUsed), color: "#1e1e21" },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={38}
                paddingAngle={0}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="#7b4cff" />
                <Cell fill="#27272a" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {usagePercentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Credits Info */}
        <div className="flex-1">
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-xs text-tertiary">Available Balance</span>
            <span className="text-2xl font-bold text-primary tracking-tight">
              ${creditsAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-accent-primary" />
              <span className="text-secondary">Used: </span>
              <span className="text-primary font-medium">
                ${creditsUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Token Categories - Compact */}
      <div className="flex flex-col gap-2 pt-3 border-t border-subtle/50">
        {chartData.map((category, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className="size-2 rounded-sm"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-secondary">{category.name}</span>
            </div>
            <span className="text-primary font-medium">
              ${category.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
