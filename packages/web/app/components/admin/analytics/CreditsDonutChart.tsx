import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface ProjectCredit {
  name: string;
  percentage: number;
  amount: number;
  color: string;
}

interface CreditsDonutChartProps {
  totalCredits: number;
  projects: ProjectCredit[];
  compact?: boolean;
}

const CHART_COLORS = ["#4409fe", "#8c16f8", "#f155ce", "#727279"];

export function CreditsDonutChart({
  totalCredits,
  projects,
  compact = false,
}: CreditsDonutChartProps) {
  // Prepare data for the chart
  const chartData = projects.map((project, index) => ({
    ...project,
    color: project.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Chart dimensions based on compact mode
  const chartSize = compact ? 120 : 167;
  const innerRadius = compact ? 38 : 55;
  const outerRadius = compact ? 55 : 80;

  // Show empty state if no data
  if (!chartData || chartData.length === 0 || chartData.every((p) => p.amount === 0)) {
    return (
      <div className={`flex ${compact ? "flex-col gap-3" : "gap-4"} items-center w-full`}>
        {/* Empty Donut Chart */}
        <div className={`relative shrink-0`} style={{ width: chartSize, height: chartSize }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ name: "Empty", value: 100, color: "rgba(255,255,255,0.1)" }]}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="rgba(255,255,255,0.1)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`${compact ? "text-sm" : "text-base"} font-medium text-primary`}>$0.00</span>
            <span className={`${compact ? "text-[10px]" : "text-[13px]"} text-secondary`}>Credits Used</span>
          </div>
        </div>

        {/* Empty Message */}
        <div className="flex-1">
          <p className="text-sm text-tertiary">No project data available</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* Compact Donut Chart */}
          <div className="relative shrink-0" style={{ width: chartSize, height: chartSize }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
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
              <span className="text-sm font-semibold text-primary">
                ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-secondary">Credits Used</span>
            </div>
          </div>

          {/* Compact Legend */}
          <div className="flex flex-col gap-1.5 flex-1">
            {chartData.slice(0, 4).map((project, index) => (
              <div key={index} className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-xs text-primary truncate max-w-[80px]">
                    {project.name}
                  </span>
                </div>
                <span className="text-xs font-medium text-secondary">
                  ${project.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-center">
      {/* Donut Chart */}
      <div className="relative shrink-0" style={{ width: chartSize, height: chartSize }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
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
            ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[13px] text-secondary">Credits Used</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-[258px]">
        {chartData.map((project, index) => (
          <div key={index} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: project.color }}
              />
              <span className={`text-sm ${index === 0 ? 'text-primary' : 'text-primary'}`}>
                {project.name} ({project.percentage}%)
              </span>
            </div>
            <span className={`text-sm text-right ${index === 0 ? 'font-bold text-primary' : 'text-secondary'}`}>
              ${project.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
