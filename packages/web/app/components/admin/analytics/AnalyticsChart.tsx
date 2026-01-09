import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../ui/chart";
import type { DailyUsage, ModelUsage } from "./hooks";

interface DailyUsageChartProps {
  data: DailyUsage[];
  title: string;
}

export function DailyUsageChart({ data, title }: DailyUsageChartProps) {
  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "#7b4cff",
    },
    cost: {
      label: "Cost ($)",
      color: "#22c55e",
    },
    count: {
      label: "Messages",
      color: "#3b82f6",
    },
  };

  if (!data || data.length === 0) {
    return (
      <Card className="bg-surface-1 border-subtle">
        <CardHeader>
          <CardTitle className="text-primary">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-tertiary py-8">
            No usage data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-1 border-subtle h-full">
      <CardHeader>
        <CardTitle className="text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="tokens"
              stroke={chartConfig.tokens.color}
              strokeWidth={2}
              name="Tokens"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cost"
              stroke={chartConfig.cost.color}
              strokeWidth={2}
              name="Cost ($)"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="count"
              stroke={chartConfig.count.color}
              strokeWidth={2}
              name="Messages"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Compact Daily Usage Chart for analytics page
interface DailyUsageChartCompactProps {
  data: DailyUsage[];
}

export function DailyUsageChartCompact({ data }: DailyUsageChartCompactProps) {
  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "#38bdf8",
    },
    cost: {
      label: "Cost ($)",
      color: "#22c55e",
    },
  };

  // Take last 14 days for compact view
  const recentData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(-14).map(d => ({
      ...d,
      shortLabel: d.label.split(' ')[0], // Just the day name
    }));
  }, [data]);

  if (recentData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-center">
        <p className="text-sm text-tertiary">No usage data available</p>
      </div>
    );
  }

  // Calculate totals for summary
  const totalTokens = recentData.reduce((sum, d) => sum + d.tokens, 0);
  const totalCost = recentData.reduce((sum, d) => sum + d.cost, 0);

  return (
    <div className="flex flex-col h-[200px]">
      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
        <AreaChart
          data={recentData}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 9, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 9, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 9, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="tokens"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#tokenGradient)"
            name="Tokens"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="cost"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#costGradient)"
            name="Cost ($)"
          />
        </AreaChart>
      </ChartContainer>

      {/* Summary Stats */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-subtle text-xs">
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-sky-400" />
          <span className="text-tertiary">Tokens:</span>
          <span className="text-primary font-medium">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-emerald-400" />
          <span className="text-tertiary">Cost:</span>
          <span className="text-primary font-medium">${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// Helper to format model names nicely
function formatModelName(modelId: string): string {
  const parts = modelId.split("/");
  const name = parts[parts.length - 1];
  
  return name
    .replace(/^claude-/, "Claude ")
    .replace(/^gpt-/, "GPT-")
    .replace(/^gemini-/, "Gemini ")
    .replace(/-pro$/i, " Pro")
    .replace(/-sonnet$/i, " Sonnet")
    .replace(/-opus$/i, " Opus")
    .replace(/-nano$/i, " Nano")
    .replace(/-turbo$/i, " Turbo")
    .replace(/-preview$/i, " Preview")
    .replace(/-(\d+)\.(\d+)/, " $1.$2")
    .replace(/(\d+)\.(\d+)-/, "$1.$2 ")
    .replace(/-/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .replace(/Gpt/g, "GPT")
    .replace(/Ai/g, "AI");
}

interface ModelUsageChartProps {
  data: ModelUsage[];
  title: string;
}

export function ModelUsageChart({ data, title }: ModelUsageChartProps) {
  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "#7b4cff",
    },
    cost: {
      label: "Cost ($)",
      color: "#22c55e",
    },
  };

  const commonModels = [
    "anthropic/claude-4.5-sonnet",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-5-nano",
  ];

  const enrichedData = useMemo(() => {
    const dataMap = new Map((data || []).map((item) => [item.model, item]));
    return commonModels.map((model) => {
      const existing = dataMap.get(model);
      return {
        ...(existing || {
          model,
          tokens: 0,
          cost: 0,
          count: 0,
          percentage: "0",
        }),
        displayName: formatModelName(model),
      };
    });
  }, [data]);

  return (
    <Card className="bg-surface-1 border-subtle h-full border-0 shadow-none">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-primary text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="h-[350px] px-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={enrichedData}
            barCategoryGap="20%"
            margin={{ top: 10, right: 10, bottom: 80, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="displayName"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              angle={-30}
              textAnchor="end"
              height={80}
              interval={0}
              tickMargin={10}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              domain={[0, "auto"]}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              domain={[0, "auto"]}
              allowDecimals={true}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              yAxisId="left"
              dataKey="tokens"
              fill={chartConfig.tokens.color}
              name="Tokens"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
              minPointSize={2}
            />
            <Bar
              yAxisId="right"
              dataKey="cost"
              fill={chartConfig.cost.color}
              name="Cost ($)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
              minPointSize={2}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Compact Model Usage Chart for analytics page
const MODEL_COLORS = ["#a78bfa", "#34d399", "#fbbf24"];

interface ModelUsageChartCompactProps {
  data: (ModelUsage & { displayName?: string })[];
}

export function ModelUsageChartCompact({ data }: ModelUsageChartCompactProps) {
  const commonModels = [
    "anthropic/claude-4.5-sonnet",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-5-nano",
  ];

  const processedData = useMemo(() => {
    const dataMap = new Map((data || []).map((item) => [item.model, item]));
    const models = commonModels.map((model) => {
      const existing = dataMap.get(model);
      return {
        model,
        displayName: formatModelName(model),
        tokens: existing?.tokens || 0,
        cost: existing?.cost || 0,
        count: existing?.count || 0,
      };
    });

    const totalTokens = models.reduce((sum, m) => sum + m.tokens, 0);
    
    return models.map((m, i) => ({
      ...m,
      percentage: totalTokens > 0 ? Math.round((m.tokens / totalTokens) * 100) : 0,
      color: MODEL_COLORS[i % MODEL_COLORS.length],
    }));
  }, [data]);

  const totalTokens = processedData.reduce((sum, m) => sum + m.tokens, 0);
  const totalCost = processedData.reduce((sum, m) => sum + m.cost, 0);

  if (totalTokens === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-center">
        <p className="text-sm text-tertiary">No model usage data yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[200px]">
      {/* Model bars */}
      <div className="flex flex-col gap-4 flex-1">
        {processedData.map((model, index) => (
          <div key={model.model} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="size-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: model.color }}
                />
                <span className="text-sm font-medium text-primary">
                  {model.displayName}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-secondary tabular-nums">
                  {model.tokens.toLocaleString()}
                </span>
                <span className="text-emerald-400 font-semibold tabular-nums min-w-[60px] text-right">
                  ${model.cost.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="h-3 w-full bg-[#1a1a1f] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(model.percentage, model.tokens > 0 ? 3 : 0)}%`,
                  backgroundColor: model.color,
                  boxShadow: model.percentage > 0 ? `0 0 8px ${model.color}40` : 'none',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/10 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-tertiary">Total:</span>
          <span className="text-primary font-semibold">{totalTokens.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-tertiary">Cost:</span>
          <span className="text-emerald-400 font-semibold">${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
