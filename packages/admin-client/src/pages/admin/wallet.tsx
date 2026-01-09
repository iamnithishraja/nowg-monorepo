import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  CreditCard,
  Receipt,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { UserRole, hasAdminAccess } from "@/types/roles";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: "recharge" | "deduction" | "refund";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  stripePaymentId?: string;
  conversationId?: string;
  messageId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: string;
  walletType?: "org_wallet" | "project_wallet" | "user_project_wallet" | "user_wallet";
  projectId?: string;
  projectName?: string;
  organizationId?: string;
  organizationName?: string;
}

interface WalletInfo {
  balance: number;
  type: string;
  transactionCount: number;
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
  walletInfo?: WalletInfo;
}

export default function WalletPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  // Check if user is full admin
  const isFullAdmin = hasAdminAccess(userRole);
  // Check both role and hasOrgAdminAccess flag
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  // Check both role and hasProjectAdminAccess flag
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const userOrganizationId = (user as any)?.organizationId;
  const projectId = (user as any)?.projectId;

  // Get projects for project_admin - fetch all projects
  const { data: projectsData } = useQuery<{ projects: any[] }>({
    queryKey: ["/api/admin/projects", "all"],
    queryFn: () =>
      client.get<{ projects: any[] }>("/api/admin/projects", {
        params: {
          page: 1,
          limit: 100, // Fetch all projects for project admin
        },
      }),
    enabled: isProjectAdmin && !isOrgAdmin && !isFullAdmin,
  });
  const projects = projectsData?.projects || [];
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  // Set default selected project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Get organizationId from URL query params (from Stripe redirect) or fall back to user's org
  const params = new URLSearchParams(window.location.search);
  const organizationIdFromUrl = params.get("organizationId");
  const organizationId = organizationIdFromUrl || userOrganizationId;

  // Check for payment success in URL and verify payment
  useEffect(() => {
    if (!isOrgAdmin || !organizationId) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId && organizationId) {
      // Verify the payment
      stripeVerifyMutation.mutate({
        sessionId,
        organizationId,
      });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [isOrgAdmin, organizationId]);

  // Stripe verify mutation
  const stripeVerifyMutation = useMutation({
    mutationFn: async (data: { sessionId: string; organizationId: string }) => {
      return client.post(
        `/api/admin/org-wallets/${data.organizationId}/stripe-verify`,
        { sessionId: data.sessionId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/wallet"],
      });
      toast({
        title: "Payment Successful",
        description: "Credits have been added to your wallet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });

  // Use project-wallets transactions endpoint for project_admin when project is selected
  // Otherwise use the general wallet endpoint
  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: [
      isProjectAdmin && !isOrgAdmin && !isFullAdmin && selectedProjectId
        ? "/api/admin/project-wallets/:projectId/transactions"
        : "/api/admin/wallet",
      isProjectAdmin && !isOrgAdmin && !isFullAdmin && selectedProjectId
        ? selectedProjectId
        : undefined,
      currentPage,
      searchTerm,
    ],
    queryFn: async () => {
      if (isProjectAdmin && !isOrgAdmin && !isFullAdmin && selectedProjectId) {
        // Use project-wallets transactions endpoint and transform response
        const response = await client.get<{
          transactions: any[];
          pagination: any;
          wallet: any;
        }>(`/api/admin/project-wallets/${selectedProjectId}/transactions`, {
          params: {
            page: currentPage,
            limit: 10,
          },
        });

        // Transform to match TransactionsResponse format
        let transformedTransactions = response.transactions.map((t: any) => ({
          _id: t.id || t._id,
          userId: selectedProjectId,
          userEmail: "Project Wallet",
          userName: selectedProject?.name || "Project",
          type: t.type === "credit" ? "recharge" : "deduction",
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description || "",
          stripePaymentId: t.stripePaymentId,
          createdAt: t.createdAt,
          walletType: "project_wallet" as const,
          projectId: selectedProjectId,
          projectName: selectedProject?.name,
          organizationId: selectedProject?.organizationId,
          organizationName: (selectedProject as any)?.organization?.name || "",
        }));

        // Apply client-side search filter if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          transformedTransactions = transformedTransactions.filter((t: Transaction) => {
            const desc = (t.description || "").toLowerCase();
            const paymentId = (t.stripePaymentId || "").toLowerCase();
            return desc.includes(searchLower) || paymentId.includes(searchLower);
          });
        }

        return {
          transactions: transformedTransactions,
          pagination: response.pagination,
          walletInfo: response.wallet
            ? {
                balance: response.wallet.balance,
                type: "project_wallet",
                transactionCount: transformedTransactions.length,
              }
            : undefined,
        } as TransactionsResponse;
      } else {
        // Use general wallet endpoint
        return client.get<TransactionsResponse>("/api/admin/wallet", {
          params: {
            page: currentPage,
            limit: 10,
            ...(searchTerm && { search: searchTerm }),
          },
        });
      }
    },
    enabled:
      !isProjectAdmin ||
      isOrgAdmin ||
      isFullAdmin ||
      (isProjectAdmin && !isOrgAdmin && !isFullAdmin && !!selectedProjectId),
  });

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "recharge":
        return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case "deduction":
        return <ArrowDownCircle className="h-4 w-4 text-red-500" />;
      case "refund":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      recharge: "default",
      deduction: "destructive",
      refund: "secondary",
    };
    return (
      <Badge variant={variants[type] || "outline"} className="capitalize">
        {type}
      </Badge>
    );
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    // Format time consistently
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);

    if (isToday) {
      return `Today ${timeStr}`;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${timeStr}`;
    }

    // If same year, show month and day
    if (isThisYear) {
      const dateStr = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
      return `${dateStr} ${timeStr}`;
    }

    // Otherwise show full date
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {isFullAdmin
              ? "All Wallet Transactions"
              : isProjectAdmin
              ? "Project Wallet Transactions"
              : isOrgAdmin
              ? "Organization Wallet Transactions"
              : "Wallet Recharges"}
          </h1>
          <p className="text-muted-foreground">
            {isFullAdmin
              ? "View external payment gateway transactions (Stripe payments) across all wallets"
              : isProjectAdmin
              ? "View external payment gateway transactions (Stripe payments) for project wallets"
              : isOrgAdmin
              ? "View external payment gateway transactions (Stripe payments) for organization wallets"
              : "View external payment gateway transactions (Stripe payments) for user wallets"}
          </p>
        </div>

        {/* Project Selector (if multiple projects for project_admin) */}
        {isProjectAdmin && !isOrgAdmin && !isFullAdmin && projects.length > 1 && (
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Project:</label>
                <Select
                  value={selectedProjectId || ""}
                  onValueChange={(value) => {
                    setSelectedProjectId(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet Summary - For Org Admin and Project Admin (not for full admin) */}
        {(isOrgAdmin || isProjectAdmin) && !isFullAdmin && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {isLoading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : data?.walletInfo ? (
              <>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/10 rounded-full">
                        <CreditCard className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Current Balance
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          ${data.walletInfo.balance.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-full">
                        <Receipt className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Transactions
                        </p>
                        <p className="text-2xl font-bold">
                          {data.walletInfo.transactionCount}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/10 rounded-full">
                        <Building2 className="h-6 w-6 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Wallet Type
                        </p>
                        <p className="text-2xl font-bold capitalize">
                          {data.walletInfo.type.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                isFullAdmin
                  ? "Search by user, organization, project, or payment ID..."
                  : "Search by payment ID..."
              }
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : data && data.transactions.length > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {isFullAdmin
                    ? "All Transactions"
                    : isProjectAdmin
                    ? "Project Transactions"
                    : isOrgAdmin
                    ? "Organization Transactions"
                    : "Recharge Transactions"}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({data.pagination.total} total)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {isFullAdmin && <TableHead>Wallet Type</TableHead>}
                        {isFullAdmin && <TableHead>Organization</TableHead>}
                        {isFullAdmin && <TableHead>Project</TableHead>}
                        {(!isOrgAdmin || isFullAdmin) && <TableHead>User</TableHead>}
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance Before</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map((transaction) => (
                        <TableRow key={transaction._id}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(transaction.createdAt)}
                          </TableCell>
                          {isFullAdmin && (
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {transaction.walletType?.replace(/_/g, " ") || "Unknown"}
                              </Badge>
                            </TableCell>
                          )}
                          {isFullAdmin && (
                            <TableCell>
                              {transaction.organizationName ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {transaction.organizationName}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          {isFullAdmin && (
                            <TableCell>
                              {transaction.projectName ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {transaction.projectName}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          {(!isOrgAdmin || isFullAdmin) && (
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {transaction.userName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {transaction.userEmail}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(transaction.type)}
                              {getTypeBadge(transaction.type)}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            <span
                              className={
                                transaction.type === "recharge" ||
                                transaction.type === "refund"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {transaction.type === "recharge" ||
                              transaction.type === "refund"
                                ? "+"
                                : "-"}
                              {formatAmount(Math.abs(transaction.amount))}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {formatAmount(transaction.balanceBefore)}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {formatAmount(transaction.balanceAfter)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {transaction.description && (
                                <div className="text-muted-foreground">
                                  {transaction.description}
                                </div>
                              )}
                              {transaction.model && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">
                                    Model:
                                  </span>{" "}
                                  {transaction.model}
                                </div>
                              )}
                              {transaction.inputTokens !== undefined &&
                                transaction.outputTokens !== undefined && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">
                                      Tokens:
                                    </span>{" "}
                                    {transaction.inputTokens.toLocaleString()}↑{" "}
                                    {transaction.outputTokens.toLocaleString()}↓
                                  </div>
                                )}
                              {transaction.stripePaymentId && (
                                <div className="text-xs font-mono text-muted-foreground">
                                  {transaction.stripePaymentId}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {data.pagination.page} of{" "}
                      {data.pagination.totalPages}
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
                        disabled={!data.pagination.hasMore}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-24">
              <Wallet className="h-20 w-20 text-muted-foreground mb-6" />
              <h3 className="text-xl font-medium mb-2">
                No recharge transactions found
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Recharge transactions will appear here"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
