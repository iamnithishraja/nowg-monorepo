import { useQuery } from "@tanstack/react-query";
import { DollarSign, Activity, TrendingUp, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TokenUsageData {
  totalCost: string;
  totalTokens: number;
  totalRecharges: string;
  profit: string;
  actualCreditsGiven: string;
  profitPercentage: number;
  modelUsage: Array<{
    model: string;
    tokens: number;
    cost: number;
    count: number;
    percentage: string;
  }>;
  dailyUsage: Array<{
    date: string;
    label: string;
    tokens: number;
    cost: number;
    count: number;
  }>;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

import { client } from "@/lib/client";

export default function TokenManagement() {
  const { data, isLoading } = useQuery<TokenUsageData>({
    queryKey: ["/api/admin/token-usage"],
    queryFn: () => client.get<TokenUsageData>("/api/admin/token-usage"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading token management...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Token Management
          </h1>
          <p className="text-muted-foreground">
            Monitor LLM usage, costs, and platform profitability
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Recharges
                  </p>
                  <p className="text-2xl font-bold">${data.totalRecharges}</p>
                </div>
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-green-500/10">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Platform Profit (20%)
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    ${data.profit}
                  </p>
                </div>
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-green-500/10">
                  <Percent className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Burned</p>
                  <p className="text-2xl font-bold">
                    {data.totalTokens.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">${data.totalCost}</p>
                </div>
                <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-orange-500/10">
                  <DollarSign className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit Explanation */}
        <Card className="mb-8 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Profit Model (20% Markup)
                </h3>
                <p className="text-muted-foreground mb-2">
                  When users recharge $10, they receive $8 in credits. The
                  platform keeps $2 as profit.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Recharges
                    </p>
                    <p className="text-xl font-bold">${data.totalRecharges}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Credits Given (80%)
                    </p>
                    <p className="text-xl font-bold text-blue-600">
                      ${data.actualCreditsGiven}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Platform Profit (20%)
                    </p>
                    <p className="text-xl font-bold text-green-600">
                      ${data.profit}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Model Usage Pie Chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Model Usage Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {data.modelUsage.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.modelUsage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="tokens"
                      >
                        {data.modelUsage.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => value.toLocaleString()}
                        labelFormatter={(label) => `Model: ${label}`}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-6 space-y-2">
                    {data.modelUsage.map((model, index) => (
                      <div
                        key={model.model}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="font-mono text-xs">
                            {model.model}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">
                            {model.percentage}%
                          </span>
                          <span className="text-muted-foreground ml-2">
                            ({model.tokens.toLocaleString()} tokens)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No model usage data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Usage Bar Chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Daily Token Usage (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => value.toLocaleString()}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="tokens" fill="#8884d8" name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No daily usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cost Breakdown by Model</CardTitle>
          </CardHeader>
          <CardContent>
            {data.modelUsage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Model
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Tokens
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        API Calls
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Cost
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelUsage.map((model) => (
                      <tr
                        key={model.model}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 px-4 text-sm font-mono">
                          {model.model}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {model.tokens.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {model.count}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-orange-600">
                          ${model.cost.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {model.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No cost data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
