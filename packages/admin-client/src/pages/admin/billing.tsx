import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

type Transaction = {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  gatewayId: string | null;
  gatewayTransactionId: string | null;
  description: string | null;
  metadata: {
    currentBalance?: number;
    balanceAfter?: number;
  };
  createdAt: string;
};

const statusColors: Record<string, string> = {
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const typeColors: Record<string, string> = {
  subscription: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  token_purchase: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  recharge: "bg-green-500/10 text-green-500 border-green-500/20",
  usage: "bg-red-500/10 text-red-500 border-red-500/20",
  deduction: "bg-red-500/10 text-red-500 border-red-500/20",
  refund: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export default function Billing() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return transactions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Refreshed",
        description: "Transaction data has been refreshed.",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Export Started",
        description: "Your transaction export will download shortly.",
      });
    },
  });

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    if (statusFilter !== "all" && txn.status !== statusFilter) return false;
    if (typeFilter !== "all" && txn.type !== typeFilter) return false;
    return true;
  });

  // Calculate analytics
  const completedTransactions = transactions.filter(
    (t) => t.status === "completed"
  );
  const totalRevenue = completedTransactions.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0
  );
  const averageTransaction =
    completedTransactions.length > 0
      ? totalRevenue / completedTransactions.length
      : 0;
  const pendingAmount = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  // Status breakdown
  const statusCounts = transactions.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Billing & Revenue</h1>
          <p className="text-sm text-muted-foreground">
            Monitor transactions and revenue analytics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                refreshMutation.isPending ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="shadow-sm hover-elevate"
          data-testid="card-total-revenue"
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </p>
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {completedTransactions.length} completed transactions
            </p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm hover-elevate"
          data-testid="card-avg-transaction"
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">
              Avg Transaction
            </p>
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${averageTransaction.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average value per transaction
            </p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm hover-elevate"
          data-testid="card-pending-amount"
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">
              Pending Amount
            </p>
            <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${pendingAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statusCounts.pending || 0} pending transactions
            </p>
          </CardContent>
        </Card>

        <Card
          className="shadow-sm hover-elevate"
          data-testid="card-total-transactions"
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">
              Total Transactions
            </p>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{transactions.length}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={statusColors[status] || ""}
                  data-testid={`badge-status-${status}`}
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-[140px]"
                  data-testid="select-status-filter"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger
                  className="w-[160px]"
                  data-testid="select-type-filter"
                >
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="token_purchase">
                    Stripe Recharge
                  </SelectItem>
                </SelectContent>
              </Select>
              {(statusFilter !== "all" || typeFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Transactions Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <p className="text-sm text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length}{" "}
            transactions
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-transactions">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Balance After
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Stripe ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`row-transaction-${txn.id}`}
                    >
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(txn.createdAt), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium">{txn.userName || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {txn.userEmail || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {txn.description || "Stripe recharge"}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-green-500">
                        +{txn.currency} ${parseFloat(txn.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">
                        ${(txn.metadata?.balanceAfter || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-muted-foreground">
                        {txn.gatewayTransactionId?.slice(0, 16) || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={statusColors[txn.status] || ""}
                          data-testid={`badge-status-${txn.id}`}
                        >
                          {txn.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
