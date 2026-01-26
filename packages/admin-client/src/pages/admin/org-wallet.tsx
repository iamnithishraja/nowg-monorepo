import { WalletTransactionAnalytics } from "@/components/analytics/WalletTransactionAnalytics";
import { useOrganizationWalletAnalytics } from "@/components/analytics/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowDownCircle,
    ArrowLeft,
    ArrowRight,
    ArrowUpCircle,
    Building2,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    DollarSign,
    FolderKanban,
    History,
    Plus,
    Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

interface WalletData {
  id: string;
  organizationId: string;
  organizationName: string;
  type: string;
  balance: number;
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
  createdAt: string;
}

interface WalletResponse {
  wallet: WalletData;
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
    organizationId: string;
    organizationName: string;
    type: string;
    balance: number;
  };
}

export default function OrgWalletPage() {
  const params = useParams();
  const organizationId = params.organizationId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const isOrgAdmin = userRole === UserRole.ORG_ADMIN;
  const isFullAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;

  // Debug: Log role info (remove in production)
  useEffect(() => {
    if (user) {
      console.log("User role check:", {
        userRole,
        isOrgAdmin,
        isFullAdmin,
        UserRole_ORG_ADMIN: UserRole.ORG_ADMIN,
        match: userRole === UserRole.ORG_ADMIN,
      });
    }
  }, [user, userRole, isOrgAdmin, isFullAdmin]);

  // Check for payment success in URL and verify payment
  useEffect(() => {
    if (!organizationId) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      // Verify the payment
      stripeVerifyMutation.mutate({ sessionId });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [organizationId]);

  // Fetch wallet data - this will auto-create the wallet if it doesn't exist
  const {
    data: walletData,
    isLoading: walletLoading,
    error: walletError,
  } = useQuery<WalletResponse>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      client.get<WalletResponse>(`/api/admin/org-wallets/${organizationId}`),
    enabled: !!organizationId,
    retry: 1, // Retry once in case of transient errors
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } =
    useQuery<TransactionsResponse>({
      queryKey: [
        "/api/admin/org-wallets",
        organizationId,
        "transactions",
        currentPage,
      ],
      queryFn: () =>
        client.get<TransactionsResponse>(
          `/api/admin/org-wallets/${organizationId}/transactions`,
          {
            params: {
              page: currentPage,
              limit: 10,
            },
          }
        ),
      enabled: !!organizationId,
    });

  // Fetch wallet analytics
  const {
    data: walletAnalyticsData,
    isLoading: walletAnalyticsLoading,
    error: walletAnalyticsError,
  } = useOrganizationWalletAnalytics(organizationId, !!organizationId);

  // Fetch projects for transfer dropdown
  const { data: projectsData, isLoading: projectsLoading } = useQuery<{
    projects: Array<{ id: string; name: string; organizationId: string }>;
  }>({
    queryKey: ["/api/admin/projects", "for-transfer", organizationId],
    queryFn: () => {
      const params: Record<string, string | number | boolean> = {
        page: 1,
        limit: 100, // Get all projects for dropdown
      };
      if (organizationId) {
        params.organizationId = organizationId;
      }
      return client.get<{
        projects: Array<{ id: string; name: string; organizationId: string }>;
      }>("/api/admin/projects", { params });
    },
    enabled: isOrgAdmin && (transferDialogOpen || requestDialogOpen) && !!organizationId,
    retry: 1,
  });

  // Add credits mutation (manual)
  const addCreditsMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organizationId}/add-credits`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId, "transactions"],
      });
      toast({
        title: "Credits Added",
        description: `Successfully added ${creditAmount} credits to the wallet`,
      });
      setAddCreditsOpen(false);
      setCreditAmount("");
      setCreditDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credits",
        variant: "destructive",
      });
    },
  });

  // Stripe checkout mutation
  const stripeCheckoutMutation = useMutation({
    mutationFn: async (data: { amount: number }) => {
      // Get user's country code from browser location
      const { getCountryCodeForPayment } = await import("@/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      console.log("🌍 Detected country code:", countryCode);

      const response = await client.post<{ 
        provider: string;
        url?: string; 
        sessionId: string;
        keyId?: string;
        formData?: Record<string, string>;
        formAction?: string;
      }>(
        `/api/admin/org-wallets/${organizationId}/stripe-checkout`,
        { ...data, countryCode }
      );
      return { ...response, amount: data.amount };
    },
    onSuccess: async (data) => {
      if (data) {
        const { handlePaymentResponse } = await import("@/utils/payment");
        await handlePaymentResponse(data, data.amount);
      }
    },
    onError: (error: any) => {
      console.error("Stripe checkout error:", error);
      toast({
        title: "Error",
        description:
          error?.message ||
          "Failed to create checkout session. Please check your Stripe configuration.",
        variant: "destructive",
      });
    },
  });

  // Stripe verify mutation
  const stripeVerifyMutation = useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      return client.post(
        `/api/admin/org-wallets/${organizationId}/stripe-verify`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId, "transactions"],
      });
      toast({
        title: "Payment Successful",
        description: "Credits have been added to your wallet",
      });
      setAddCreditsOpen(false);
      setCreditAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });

  // Transfer funds mutation (direct transfer)
  const transferMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      amount: number;
      description: string;
    }) => {
      return client.post(
        `/api/admin/project-wallets/${data.projectId}/transfer-from-org`,
        {
          amount: data.amount,
          description: data.description,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/org-wallets", organizationId, "transactions"],
      });
      toast({
        title: "Transfer Successful",
        description: `Successfully transferred ${transferAmount} credits to project`,
      });
      setTransferDialogOpen(false);
      setTransferAmount("");
      setTransferDescription("");
      setSelectedProjectId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer funds",
        variant: "destructive",
      });
    },
  });

  // Create fund request mutation
  const requestMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      amount: number;
      description: string;
    }) => {
      return client.post("/api/admin/fund-requests", {
        projectId: data.projectId,
        amount: data.amount,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Created",
        description: `Fund request for ${requestAmount} credits has been submitted`,
      });
      setRequestDialogOpen(false);
      setRequestAmount("");
      setRequestDescription("");
      setSelectedProjectId("");
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create fund request";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAddCredits = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    addCreditsMutation.mutate({
      amount,
      description: creditDescription.trim(),
    });
  };

  const handleStripeCheckout = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    stripeCheckoutMutation.mutate({ amount });
  };

  const handleTransfer = () => {
    if (!selectedProjectId) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (wallet && wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Organization wallet has insufficient balance. Current balance: ${wallet.balance}`,
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      projectId: selectedProjectId,
      amount,
      description: transferDescription.trim(),
    });
  };

  const handleRequest = () => {
    if (!selectedProjectId) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (wallet && wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Organization wallet has insufficient balance. Current balance: ${wallet.balance}`,
        variant: "destructive",
      });
      return;
    }

    requestMutation.mutate({
      projectId: selectedProjectId,
      amount,
      description: requestDescription.trim(),
    });
  };

  // Filter projects to only show those in the current organization
  const availableProjects =
    projectsData?.projects?.filter(
      (p) => p.organizationId === organizationId
    ) || [];

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

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Invalid organization ID</p>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const transactions = transactionsData?.transactions || [];
  const pagination = transactionsData?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin/organizations")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8" />
            Organization Wallet
          </h1>
          {wallet && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {wallet.organizationName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOrgAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(true)}
                disabled={!wallet || wallet.balance === 0}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Direct Transfer
              </Button>
              <Button
                variant="outline"
                onClick={() => setRequestDialogOpen(true)}
                disabled={!wallet || wallet.balance === 0}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                Request Transfer
              </Button>
            </>
          )}
          {!isFullAdmin && (
            <Button onClick={() => setAddCreditsOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Credits
            </Button>
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
                  queryKey: ["/api/admin/org-wallets", organizationId],
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
                Current Balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {formatCurrency(wallet.balance)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {wallet.balance} credits available
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

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-lg py-1 px-3">
                {wallet.type === "org_wallet" ? "Organization" : wallet.type}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Created {formatDate(wallet.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Transaction History */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment Transactions
            </CardTitle>
            <CardDescription>
              View external payment gateway transactions (Stripe payments only)
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
              <p className="text-sm">Add credits to see transaction history</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {isOrgAdmin ? "Add Credits via Stripe" : "Add Credits"}
            </DialogTitle>
            <DialogDescription>
              {isOrgAdmin
                ? "Add credits to this organization's wallet. Payment method will be selected based on your location. 1 credit = $1 (1:1 ratio)"
                : "Add credits to this organization's wallet. 1 credit = $1"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isOrgAdmin
                  ? "Enter the amount you want to pay. You'll receive the same amount in credits (1:1 ratio)."
                  : "Enter the number of credits to add"}
              </p>
            </div>

            {/* Description field only for full admins */}
            {isFullAdmin && (
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={creditDescription}
                  onChange={(e) => setCreditDescription(e.target.value)}
                  placeholder="e.g., Initial credit allocation, Bonus credits..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            )}

            {/* Payment Summary - Only show for org_admin */}
            {isOrgAdmin && creditAmount && parseFloat(creditAmount) > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-medium">Secure Payment</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to Pay:</span>
                  <span className="font-medium">
                    ${parseFloat(creditAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Credits You'll Receive:
                  </span>
                  <span className="font-medium text-green-600">
                    ${parseFloat(creditAmount).toFixed(2)} credits
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total:</span>
                    <span>${parseFloat(creditAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddCreditsOpen(false);
                setCreditAmount("");
                setCreditDescription("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            {isOrgAdmin ? (
              <Button
                onClick={handleStripeCheckout}
                disabled={stripeCheckoutMutation.isPending || !creditAmount}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              >
                {stripeCheckoutMutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAddCredits}
                disabled={addCreditsMutation.isPending || !creditAmount}
                className="w-full sm:w-auto"
              >
                {addCreditsMutation.isPending ? "Adding..." : "Add Credits"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Transfer to Project Dialog */}
      {isOrgAdmin && (
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Direct Transfer to Project
              </DialogTitle>
              <DialogDescription>
                Immediately transfer credits from organization wallet to a project wallet.
                This is an atomic transaction that happens instantly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-select">Project *</Label>
                {projectsLoading ? (
                  <div className="mt-2 p-3 border rounded-md text-sm text-muted-foreground">
                    Loading projects...
                  </div>
                ) : (
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                  >
                    <SelectTrigger id="project-select" className="mt-2">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.length > 0 ? (
                        availableProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No projects available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="transfer-amount">Amount (Credits)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="transfer-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={wallet?.balance}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available balance:{" "}
                  {wallet ? formatCurrency(wallet.balance) : "$0.00"}
                </p>
              </div>
              <div>
                <Label htmlFor="transfer-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="transfer-description"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  placeholder="e.g., Initial project funding, Monthly allocation..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTransferDialogOpen(false);
                  setTransferAmount("");
                  setTransferDescription("");
                  setSelectedProjectId("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={
                  transferMutation.isPending ||
                  !transferAmount ||
                  !selectedProjectId
                }
              >
                {transferMutation.isPending
                  ? "Transferring..."
                  : "Transfer Credits"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Request Transfer Dialog */}
      {isOrgAdmin && (
        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Request Transfer to Project
              </DialogTitle>
              <DialogDescription>
                Submit a fund request for approval. The request will need to be reviewed and approved before funds are transferred.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="request-project-select">Project *</Label>
                {projectsLoading ? (
                  <div className="mt-2 p-3 border rounded-md text-sm text-muted-foreground">
                    Loading projects...
                  </div>
                ) : (
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                  >
                    <SelectTrigger id="request-project-select" className="mt-2">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.length > 0 ? (
                        availableProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No projects available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="request-amount">Amount (Credits)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="request-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={wallet?.balance}
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available balance:{" "}
                  {wallet ? formatCurrency(wallet.balance) : "$0.00"}
                </p>
              </div>
              <div>
                <Label htmlFor="request-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="request-description"
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="e.g., Q1 budget allocation, Emergency funding request..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRequestDialogOpen(false);
                  setRequestAmount("");
                  setRequestDescription("");
                  setSelectedProjectId("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequest}
                disabled={
                  requestMutation.isPending ||
                  !requestAmount ||
                  !selectedProjectId
                }
              >
                {requestMutation.isPending
                  ? "Submitting..."
                  : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Wallet Transaction Analytics */}
      <WalletTransactionAnalytics
        data={walletAnalyticsData}
        isLoading={walletAnalyticsLoading}
        error={walletAnalyticsError}
        isProject={false}
      />
    </div>
  );
}
