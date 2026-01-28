import { WalletTransactionAnalytics } from "@/components/analytics/WalletTransactionAnalytics";
import { useProjectWalletAnalytics } from "@/components/analytics/hooks";
import {
    AddFundsDialog,
    CreditBackDialog,
    RequestDialog,
    TransactionHistoryTable,
    TransferDialog,
    UserWallet,
    UserWalletsTable,
    WalletHeader,
    WalletOverviewCards,
} from "@/components/project-wallet";
import {
    useApproveFundRequest,
    useCreateFundRequest,
    useCreditBackToOrg,
    useFundRequests,
    useOrgWallet,
    useProjectWallet,
    useProjectWalletTransactions,
    useRejectFundRequest,
    useSetWalletLimit,
    useStripeCheckout,
    useStripeVerify,
    useTransferFromOrg,
    useUserProjectWallets,
} from "@/components/project-wallet/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@nowgai/shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

export default function ProjectWalletPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [userWalletsPage, setUserWalletsPage] = useState(1);
  const [editingLimit, setEditingLimit] = useState<{
    walletId: string;
    userId: string;
    currentLimit: number | null;
  } | null>(null);
  const [limitValue, setLimitValue] = useState("");
  const [creditBackDialogOpen, setCreditBackDialogOpen] = useState(false);
  const [creditBackAmount, setCreditBackAmount] = useState("");
  const [creditBackDescription, setCreditBackDescription] = useState("");

  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const isSystemAdmin =
    userRole === UserRole.ADMIN || userRole === UserRole.TECH_SUPPORT;
  // Only org admins and system admins can add funds (not project admins)
  const canAddFunds = isOrgAdmin || isSystemAdmin;

  // Fetch wallet data
  const {
    data: walletData,
    isLoading: walletLoading,
    error: walletError,
  } = useProjectWallet(projectId);

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } =
    useProjectWalletTransactions(projectId, currentPage);

  // Fetch org wallet for transfer/request
  const { data: orgWalletData } = useOrgWallet(
    walletData?.wallet?.organizationId,
    (transferDialogOpen || requestDialogOpen) && (isOrgAdmin || isProjectAdmin)
  );

  // Fetch fund requests
  const { data: fundRequestsData, refetch: refetchFundRequests } =
    useFundRequests(
      projectId,
      walletData?.wallet?.organizationId,
      !!projectId
    );

  // Fetch user wallets
  const { data: userWalletsData, isLoading: userWalletsLoading } =
    useUserProjectWallets(projectId, userWalletsPage);

  // Fetch wallet analytics
  const {
    data: walletAnalyticsData,
    isLoading: walletAnalyticsLoading,
    error: walletAnalyticsError,
  } = useProjectWalletAnalytics(projectId, !!projectId);

  // Mutations
  const transferMutation = useTransferFromOrg(
    projectId,
    walletData?.wallet?.organizationId
  );

  const requestMutation = useCreateFundRequest(
    projectId,
    walletData?.wallet?.organizationId
  );

  const approveRequestMutation = useApproveFundRequest(
    projectId,
    walletData?.wallet?.organizationId
  );

  const rejectRequestMutation = useRejectFundRequest();

  const stripeCheckoutMutation = useStripeCheckout(projectId);
  const stripeVerifyMutation = useStripeVerify(projectId, () => {
    setAddCreditsOpen(false);
    setCreditAmount("");
  });

  const creditBackMutation = useCreditBackToOrg(
    projectId,
    walletData?.wallet?.organizationId
  );

  const setLimitMutation = useSetWalletLimit(projectId);

  // Check for payment success in URL and verify payment
  useEffect(() => {
    if (!projectId) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      stripeVerifyMutation.mutate({ sessionId });
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [projectId, stripeVerifyMutation]);

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (orgWalletData?.wallet && orgWalletData.wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Organization wallet has insufficient balance. Current balance: $${orgWalletData.wallet.balance.toFixed(
          2
        )}`,
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate(
      {
        amount,
        description: transferDescription.trim(),
      },
      {
        onSuccess: () => {
          setTransferDialogOpen(false);
          setTransferAmount("");
          setTransferDescription("");
        },
      }
    );
  };

  const handleRequest = () => {
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (orgWalletData?.wallet && orgWalletData.wallet.balance < amount) {
      toast({
        title: "Insufficient Funds",
        description: `Organization wallet does not have sufficient funds. Current balance: $${orgWalletData.wallet.balance.toFixed(
          2
        )}, Required: $${amount.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    requestMutation.mutate(
      {
        amount,
        description: requestDescription.trim(),
      },
      {
        onSuccess: () => {
          setRequestDialogOpen(false);
          setRequestAmount("");
          setRequestDescription("");
          refetchFundRequests();
        },
      }
    );
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

  const handleEditLimit = (wallet: UserWallet) => {
    setEditingLimit({
      walletId: wallet.id,
      userId: wallet.userId,
      currentLimit: wallet.limit ?? null,
    });
    setLimitValue(wallet.limit?.toString() || "");
  };

  const handleSaveLimit = () => {
    if (!editingLimit) return;

    const limit = limitValue.trim() === "" ? null : parseFloat(limitValue);
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      toast({
        title: "Invalid Limit",
        description: "Limit must be a positive number or empty",
        variant: "destructive",
      });
      return;
    }

    setLimitMutation.mutate(
      {
        userId: editingLimit.userId,
        limit,
      },
      {
        onSuccess: () => {
          setEditingLimit(null);
          setLimitValue("");
        },
      }
    );
  };

  const handleCancelEditLimit = () => {
    setEditingLimit(null);
    setLimitValue("");
  };

  const handleRemoveLimit = (userId: string) => {
    setLimitMutation.mutate({
      userId,
      limit: null,
    });
  };

  const handleCreditBack = () => {
    const amount = parseFloat(creditBackAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }
    if (walletData?.wallet && amount > walletData.wallet.balance) {
      toast({
        title: "Insufficient Balance",
        description: `Cannot credit back more than current balance: $${walletData.wallet.balance.toFixed(
          2
        )}`,
        variant: "destructive",
      });
      return;
    }
    creditBackMutation.mutate(
      {
        amount,
        description: creditBackDescription.trim(),
      },
      {
        onSuccess: () => {
          setCreditBackDialogOpen(false);
          setCreditBackAmount("");
          setCreditBackDescription("");
        },
      }
    );
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Invalid project ID</p>
      </div>
    );
  }

  const wallet = walletData?.wallet;

  return (
    <div className="space-y-6 p-6">
      <WalletHeader
        wallet={wallet}
        isProjectAdmin={isProjectAdmin}
        isOrgAdmin={isOrgAdmin}
        canAddFunds={canAddFunds}
        projectId={projectId}
        onBack={() => setLocation("/admin/projects")}
        onAddFunds={() => setAddCreditsOpen(true)}
        onTransfer={() => {
          if (isProjectAdmin && !isOrgAdmin) {
            setRequestDialogOpen(true);
          } else {
            setTransferDialogOpen(true);
          }
        }}
        onCreditBack={() => setCreditBackDialogOpen(true)}
        onViewFundRequests={() => {
          if (isProjectAdmin && !isOrgAdmin) {
            setLocation(`/admin/projects/${projectId}/fund-requests`);
          } else if (isOrgAdmin) {
            setLocation("/admin/fund-requests");
          }
        }}
      />

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
                  queryKey: ["/api/admin/project-wallets", projectId],
                })
              }
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : wallet ? (
        <WalletOverviewCards wallet={wallet} />
      ) : null}

      {/* User Wallets Section */}
      <UserWalletsTable
        data={userWalletsData}
        isLoading={userWalletsLoading}
        currentPage={userWalletsPage}
        isProjectAdmin={isProjectAdmin}
        isOrgAdmin={isOrgAdmin}
        editingLimit={editingLimit}
        limitValue={limitValue}
        isUpdatingLimit={setLimitMutation.isPending}
        onPageChange={setUserWalletsPage}
        onEditLimit={handleEditLimit}
        onSaveLimit={handleSaveLimit}
        onCancelEditLimit={handleCancelEditLimit}
        onRemoveLimit={handleRemoveLimit}
        onLimitValueChange={setLimitValue}
        onViewDetails={(userId) =>
          setLocation(`/admin/projects/${projectId}/user-wallet/${userId}`)
        }
        projectId={projectId}
      />

      {/* Fund Requests Section (Org Admin) */}
      {isOrgAdmin &&
        fundRequestsData?.fundRequests &&
        fundRequestsData.fundRequests.filter((r) => r.status === "pending")
          .length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Fund Requests</CardTitle>
                  <CardDescription>
                    Review and approve or reject fund requests from project admins
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/fund-requests")}
                >
                  View All Requests
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fundRequestsData.fundRequests
                  .filter((req) => req.status === "pending")
                  .map((request) => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{request.projectName}</Badge>
                            <span className="text-sm text-muted-foreground">
                              ${request.amount.toFixed(2)}
                            </span>
                          </div>
                          {request.description && (
                            <p className="text-sm text-muted-foreground">
                              {request.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested{" "}
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              rejectRequestMutation.mutate({
                                requestId: request.id,
                              });
                            }}
                            disabled={
                              rejectRequestMutation.isPending ||
                              approveRequestMutation.isPending
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              approveRequestMutation.mutate({
                                requestId: request.id,
                              });
                            }}
                            disabled={
                              approveRequestMutation.isPending ||
                              rejectRequestMutation.isPending
                            }
                          >
                            {approveRequestMutation.isPending
                              ? "Approving..."
                              : "Approve"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Transaction History */}
      <TransactionHistoryTable
        data={transactionsData}
        isLoading={transactionsLoading}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      {/* Dialogs */}
      {canAddFunds && (
        <AddFundsDialog
          open={addCreditsOpen}
          onOpenChange={(open) => {
            setAddCreditsOpen(open);
            if (!open) setCreditAmount("");
          }}
          amount={creditAmount}
          onAmountChange={setCreditAmount}
          isLoading={stripeCheckoutMutation.isPending}
          onSubmit={handleStripeCheckout}
        />
      )}

      {isProjectAdmin && !isOrgAdmin && (
        <RequestDialog
          open={requestDialogOpen}
          onOpenChange={(open) => {
            setRequestDialogOpen(open);
            if (!open) {
              setRequestAmount("");
              setRequestDescription("");
            }
          }}
          wallet={wallet}
          orgBalance={orgWalletData?.wallet?.balance}
          amount={requestAmount}
          description={requestDescription}
          onAmountChange={setRequestAmount}
          onDescriptionChange={setRequestDescription}
          isLoading={requestMutation.isPending}
          onSubmit={handleRequest}
        />
      )}

      {isOrgAdmin && (
        <TransferDialog
          open={transferDialogOpen}
          onOpenChange={(open) => {
            setTransferDialogOpen(open);
            if (!open) {
              setTransferAmount("");
              setTransferDescription("");
            }
          }}
          wallet={wallet}
          orgBalance={orgWalletData?.wallet?.balance}
          amount={transferAmount}
          description={transferDescription}
          onAmountChange={setTransferAmount}
          onDescriptionChange={setTransferDescription}
          isLoading={transferMutation.isPending}
          onSubmit={handleTransfer}
        />
      )}

      {isOrgAdmin && (
        <CreditBackDialog
          open={creditBackDialogOpen}
          onOpenChange={(open) => {
            setCreditBackDialogOpen(open);
            if (!open) {
              setCreditBackAmount("");
              setCreditBackDescription("");
            }
          }}
          wallet={wallet}
          amount={creditBackAmount}
          description={creditBackDescription}
          onAmountChange={setCreditBackAmount}
          onDescriptionChange={setCreditBackDescription}
          isLoading={creditBackMutation.isPending}
          onSubmit={handleCreditBack}
        />
      )}

      {/* Wallet Transaction Analytics */}
      {projectId && (
        <WalletTransactionAnalytics
          data={walletAnalyticsData}
          isLoading={walletAnalyticsLoading}
          error={walletAnalyticsError}
          isProject={true}
        />
      )}
    </div>
  );
}
