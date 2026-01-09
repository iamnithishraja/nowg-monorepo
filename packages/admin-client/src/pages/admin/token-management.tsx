import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Activity, Users, DollarSign, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TokenUsage, User } from "@shared/schema";
import { format } from "date-fns";

interface CustomerUsageStats {
  userId: string;
  userEmail: string;
  userName: string;
  totalTokens: number;
  totalCost: number;
  callCount: number;
  breakdown: Array<{
    provider: string;
    model: string;
    tokens: number;
    cost: number;
  }>;
}

export default function TokenManagementPage() {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const { data: usageRecords = [], isLoading: usageLoading } = useQuery<TokenUsage[]>({
    queryKey: ["/api/token-usage"]
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  const isLoading = usageLoading || usersLoading;

  // Calculate customer usage stats
  const customerUsage: CustomerUsageStats[] = usageRecords.reduce((acc, record) => {
    const user = users.find(u => u.id === record.userId);
    if (!user) return acc;

    let customerStats = acc.find(c => c.userId === record.userId);
    if (!customerStats) {
      customerStats = {
        userId: record.userId,
        userEmail: user.email || "No email",
        userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
        totalTokens: 0,
        totalCost: 0,
        callCount: 0,
        breakdown: []
      };
      acc.push(customerStats);
    }

    customerStats.totalTokens += record.tokensUsed;
    customerStats.totalCost += parseFloat(record.cost || "0");
    customerStats.callCount += 1;

    // Add to breakdown
    let breakdownEntry = customerStats.breakdown.find(
      b => b.provider === record.provider && b.model === record.model
    );
    if (!breakdownEntry) {
      breakdownEntry = {
        provider: record.provider,
        model: record.model,
        tokens: 0,
        cost: 0
      };
      customerStats.breakdown.push(breakdownEntry);
    }
    breakdownEntry.tokens += record.tokensUsed;
    breakdownEntry.cost += parseFloat(record.cost || "0");

    return acc;
  }, [] as CustomerUsageStats[]);

  // Sort by total cost descending
  customerUsage.sort((a, b) => b.totalCost - a.totalCost);

  // Calculate totals for billing overview
  const totalTokens = usageRecords.reduce((sum, r) => sum + r.tokensUsed, 0);
  const totalCost = usageRecords.reduce((sum, r) => sum + parseFloat(r.cost || "0"), 0);
  const totalCalls = usageRecords.length;
  const uniqueCustomers = new Set(usageRecords.map(r => r.userId)).size;

  const toggleCustomer = (userId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedCustomers(newExpanded);
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "openai":
        return "text-green-500";
      case "anthropic":
        return "text-orange-500";
      case "openrouter":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading token management...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2" data-testid="text-page-title">
            Token Management
          </h1>
          <p className="text-muted-foreground">
            Monitor customer LLM usage and platform billing
          </p>
        </div>

        {/* Billing Overview Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Billing Overview
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cost (USD)</p>
                    <p className="text-2xl font-bold" data-testid="text-total-cost">
                      ${totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-green-500/10">
                    <DollarSign className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Tokens Burned</p>
                    <p className="text-2xl font-bold" data-testid="text-total-tokens">
                      {totalTokens.toLocaleString()}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">API Calls</p>
                    <p className="text-2xl font-bold" data-testid="text-total-calls">
                      {totalCalls.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-blue-500/10">
                    <Cpu className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Customers</p>
                    <p className="text-2xl font-bold" data-testid="text-unique-customers">
                      {uniqueCustomers}
                    </p>
                  </div>
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-purple-500/10">
                    <Users className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Customer Usage Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Customer Usage
          </h2>

          {customerUsage.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No usage data</h3>
                  <p className="text-muted-foreground">
                    No customer token usage recorded yet
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
                  <div className="col-span-4">Customer</div>
                  <div className="col-span-2 text-right">Tokens Burned</div>
                  <div className="col-span-2 text-right">Cost (USD)</div>
                  <div className="col-span-2 text-right">API Calls</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {customerUsage.map((customer) => (
                  <div key={customer.userId} className="border-b last:border-0" data-testid={`customer-usage-${customer.userId}`}>
                    <div className="grid grid-cols-12 gap-4 items-center p-4 hover-elevate">
                      <div className="col-span-4">
                        <div className="font-medium" data-testid={`customer-name-${customer.userId}`}>
                          {customer.userName || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`customer-email-${customer.userId}`}>
                          {customer.userEmail}
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-medium" data-testid={`customer-tokens-${customer.userId}`}>
                        {customer.totalTokens.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right font-medium text-green-600 dark:text-green-400" data-testid={`customer-cost-${customer.userId}`}>
                        ${customer.totalCost.toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right" data-testid={`customer-calls-${customer.userId}`}>
                        {customer.callCount}
                      </div>
                      <div className="col-span-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCustomer(customer.userId)}
                          data-testid={`button-toggle-${customer.userId}`}
                        >
                          {expandedCustomers.has(customer.userId) ? (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4 mr-1" />
                              View Details
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {expandedCustomers.has(customer.userId) && (
                      <div className="bg-muted/30 p-4 border-t">
                        <h4 className="font-medium mb-3 text-sm">Usage Breakdown</h4>
                        <div className="space-y-2">
                          {customer.breakdown.map((item, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-12 gap-4 text-sm p-2 rounded hover-elevate"
                              data-testid={`breakdown-item-${customer.userId}-${idx}`}
                            >
                              <div className="col-span-4 flex items-center gap-2">
                                <span className={`font-medium ${getProviderColor(item.provider)}`}>
                                  {item.provider}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="font-mono text-xs">{item.model}</span>
                              </div>
                              <div className="col-span-2 text-right text-muted-foreground">
                                {item.tokens.toLocaleString()} tokens
                              </div>
                              <div className="col-span-2 text-right font-medium">
                                ${item.cost.toFixed(4)}
                              </div>
                              <div className="col-span-4"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Activity */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </h2>
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {usageRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No activity</h3>
                  <p className="text-muted-foreground">No token usage recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Provider</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Model</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Tokens</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageRecords.slice(0, 20).map((record) => {
                        const user = users.find(u => u.id === record.userId);
                        return (
                          <tr key={record.id} className="border-b last:border-0 hover-elevate" data-testid={`row-usage-${record.id}`}>
                            <td className="py-3 px-4 text-sm">{format(new Date(record.createdAt), "MMM d, h:mm a")}</td>
                            <td className="py-3 px-4 text-sm">
                              {user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary" className={getProviderColor(record.provider)}>
                                {record.provider}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm font-mono">{record.model}</td>
                            <td className="py-3 px-4 text-sm text-right font-medium">{record.tokensUsed.toLocaleString()}</td>
                            <td className="py-3 px-4 text-sm text-right font-medium text-green-600 dark:text-green-400">
                              ${parseFloat(record.cost || "0").toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
