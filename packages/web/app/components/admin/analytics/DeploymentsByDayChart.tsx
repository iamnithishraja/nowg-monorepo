import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface DeploymentData {
  name: string;
  value: number;
  fill: string;
}

interface DeploymentsByDayChartProps {
  data: DeploymentData[];
  totalDeployments: number;
  topProjectsLabel: string;
}

export function DeploymentsByDayChart({
  data,
  totalDeployments,
}: DeploymentsByDayChartProps) {
  const chartData = data.length > 0 ? data : [
    { name: "Successful", value: 0, fill: "#22c55e" },
    { name: "Failed", value: 0, fill: "#ef4444" },
  ];

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const successRate = total > 0 ? Math.round((chartData[0]?.value || 0) / total * 100) : 0;

  // Show "No data available" message if there's no data or total is 0
  if (!data || data.length === 0 || total === 0 || totalDeployments === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-center">
        <div className="size-16 rounded-full bg-surface-3/50 flex items-center justify-center mb-3">
          <svg className="size-8 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-sm text-secondary font-medium">No deployments yet</p>
        <p className="text-xs text-tertiary mt-1">Deploy your first project to see stats</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {/* Pie Chart */}
        <div className="relative h-[100px] w-[100px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={45}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-primary">{total}</span>
            <span className="text-[9px] text-tertiary">Total</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2 flex-1">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-xs text-secondary">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-primary">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Success Rate */}
      <div className="flex items-center justify-between pt-3 border-t border-subtle">
        <span className="text-xs text-tertiary">Success Rate</span>
        <span className={`text-sm font-semibold ${successRate >= 80 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {successRate}%
        </span>
      </div>
    </div>
  );
}
