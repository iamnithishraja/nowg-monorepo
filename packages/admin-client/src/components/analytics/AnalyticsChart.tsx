import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { DailyUsage, ModelUsage } from "./hooks";

interface DailyUsageChartProps {
  data: DailyUsage[];
  title: string;
}

export function DailyUsageChart({ data, title }: DailyUsageChartProps) {
  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "hsl(var(--chart-1))",
    },
    cost: {
      label: "Cost ($)",
      color: "hsl(var(--chart-2))",
    },
    count: {
      label: "Messages",
      color: "hsl(var(--chart-3))",
    },
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No usage data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
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

interface ModelUsageChartProps {
  data: ModelUsage[];
  title: string;
}

export function ModelUsageChart({ data, title }: ModelUsageChartProps) {
  const chartConfig = {
    tokens: {
      label: "Tokens",
      color: "hsl(var(--chart-1))",
    },
    cost: {
      label: "Cost ($)",
      color: "hsl(var(--chart-2))",
    },
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No model usage data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="model"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              yAxisId="left"
              dataKey="tokens"
              fill={chartConfig.tokens.color}
              name="Tokens"
            />
            <Bar
              yAxisId="right"
              dataKey="cost"
              fill={chartConfig.cost.color}
              name="Cost ($)"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
