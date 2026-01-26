import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowDownCircle,
    ArrowLeft,
    ArrowUpCircle,
    Building2,
    Check,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Edit,
    FolderKanban,
    History,
    User,
    Wallet,
    X,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";

interface WalletData {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  balance: number; // Deprecated - always 0
  limit: number | null;
  currentSpending: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  source?: string;
  relatedProjectWalletTransactionId?: string | null;
  relatedOrgWalletTransactionId?: string | null;
  createdAt: string;
}

interface WalletResponse {
  wallet: WalletData & {
    user?: {
      id: string;
      email: string;
      name: string;
    } | null;
  };
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  wallet: {
    id: string;
    userId: string;
    projectId: string;
    projectName: string;
    balance: number;
    currentSpending: number;
    limit: number | null;
  };
}

export default function UserProjectWalletPage() {
  const params = useParams();
  const projectId = params.projectId;
  const userId = params.userId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitValue, setLimitValue] = useState("");

  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;

  // Fetch wallet data
  const {
    data: walletData,
    isLoading: walletLoading,
    error: walletError,
  } = useQuery<WalletResponse>({
    queryKey: ["/api/admin/user-project-wallets", projectId, userId],
    queryFn: () =>
      client.get<WalletResponse>(
        `/api/admin/user-project-wallets/${projectId}/${userId}`
      ),
    enabled: !!projectId && !!userId,
    retry: 1,
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } =
    useQuery<TransactionsResponse>({
      queryKey: [
        "/api/admin/user-project-wallets",
        projectId,
        userId,
        "transactions",
        currentPage,
      ],
      queryFn: () =>
        client.get<TransactionsResponse>(
          `/api/admin/user-project-wallets/${projectId}/${userId}/transactions`,
          {
            params: {
              page: currentPage,
              limit: 10,
            },
          }
        ),
      enabled: !!projectId && !!userId,
    });

  // Set wallet limit mutation
  const setLimitMutation = useMutation({
    mutationFn: async (limit: number | null) => {
      return client.put(
        `/api/admin/user-project-wallets/${projectId}/${userId}/set-limit`,
        { limit }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/user-project-wallets", projectId, userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/user-project-wallets/project", projectId],
      });
      toast({
        title: "Success",
        description: "Wallet limit updated successfully",
      });
      setEditingLimit(false);
      setLimitValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update limit",
        variant: "destructive",
      });
    },
  });

  const handleEditLimit = () => {
    const wallet = walletData?.wallet;
    if (wallet) {
      setEditingLimit(true);
      setLimitValue(wallet.limit?.toString() || "");
    }
  };

  const handleSaveLimit = () => {
    const limit = limitValue.trim() === "" ? null : parseFloat(limitValue);
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      toast({
        title: "Invalid Limit",
        description: "Limit must be a positive number or empty",
        variant: "destructive",
      });
      return;
    }

    setLimitMutation.mutate(limit);
  };

  const handleCancelEditLimit = () => {
    setEditingLimit(false);
    setLimitValue("");
  };

  const handleRemoveLimit = () => {
    setLimitMutation.mutate(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (!projectId || !userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Invalid project ID or user ID</p>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const transactions = transactionsData?.transactions || [];
  const pagination = transactionsData?.pagination;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/admin/projects/${projectId}/wallet`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            User Project Wallet
          </h1>
          {wallet && (
            <div className="flex items-center gap-4 mt-1">
              <p className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                {wallet.user?.name || wallet.userId}
                {wallet.user?.email && (
                  <span className="text-sm">({wallet.user.email})</span>
                )}
              </p>
              <p className="text-muted-foreground flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                {wallet.projectName}
              </p>
              <p className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {wallet.organizationName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Wallet Overview */}
      {walletLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-24 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ) : walletError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-16 w-16 text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading Wallet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {walletError instanceof Error
                ? walletError.message
                : "Failed to load wallet"}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: [
                    "/api/admin/user-project-wallets",
                    projectId,
                    userId,
                  ],
                })
              }
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : wallet ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Current Spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {formatCurrency(wallet.currentSpending || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Total spending against limit
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Spending Limit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {wallet.limit !== null && wallet.limit !== undefined
                  ? formatCurrency(wallet.limit)
                  : "No limit"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {wallet.limit !== null && wallet.limit !== undefined
                  ? wallet.currentSpending >= wallet.limit
                    ? "Limit reached"
                    : `${formatCurrency(
                        wallet.limit - (wallet.currentSpending || 0)
                      )} remaining`
                  : "Unlimited spending"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Total Transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {wallet.transactionCount}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                All-time transactions
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Limit Management */}
      {wallet && (isProjectAdmin || isOrgAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle>Spending Limit</CardTitle>
            <CardDescription>
              Set or update the spending limit for this user in this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editingLimit ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label htmlFor="limit">Limit (USD)</Label>
                  <Input
                    id="limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    placeholder="No limit (leave empty to remove)"
                    className="mt-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveLimit();
                      } else if (e.key === "Escape") {
                        handleCancelEditLimit();
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 pt-7">
                  <Button
                    size="sm"
                    onClick={handleSaveLimit}
                    disabled={setLimitMutation.isPending}
                    title="Save limit (empty = no limit)"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEditLimit}
                    disabled={setLimitMutation.isPending}
                    title="Cancel"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium">Current Limit</p>
                  <p className="text-2xl font-bold mt-1">
                    {wallet.limit !== null && wallet.limit !== undefined
                      ? formatCurrency(wallet.limit)
                      : "No limit set"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleEditLimit}
                    disabled={setLimitMutation.isPending}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {wallet.limit !== null && wallet.limit !== undefined
                      ? "Edit Limit"
                      : "Set Limit"}
                  </Button>
                  {wallet.limit !== null && wallet.limit !== undefined && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveLimit}
                      disabled={setLimitMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Limit
                    </Button>
                  )}
                </div>
              </div>
            )}
            {wallet.limit !== null && wallet.limit !== undefined && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Usage</span>
                  <span>
                    {formatCurrency(wallet.currentSpending || 0)} /{" "}
                    {formatCurrency(wallet.limit)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (wallet.currentSpending || 0) >= wallet.limit
                        ? "bg-destructive"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(
                        ((wallet.currentSpending || 0) / wallet.limit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(
                    ((wallet.currentSpending || 0) / wallet.limit) *
                    100
                  ).toFixed(1)}
                  % of limit used
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            View all spending and credit transactions for this user in this
            project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance Before</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, idx) => (
                      <TableRow key={transaction.id || idx}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaction.type === "credit" ? (
                              <ArrowUpCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 text-red-500" />
                            )}
                            <Badge
                              variant={
                                transaction.type === "credit"
                                  ? "default"
                                  : "destructive"
                              }
                              className="capitalize"
                            >
                              {transaction.type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          <span
                            className={
                              transaction.type === "credit"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {transaction.type === "credit" ? "+" : "-"}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {formatCurrency(transaction.balanceBefore)}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {formatCurrency(transaction.balanceAfter)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {transaction.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!pagination.hasMore}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">
                Transactions will appear here when the user makes purchases or
                credits are added
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
