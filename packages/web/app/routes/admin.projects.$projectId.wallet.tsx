import type { LoaderFunctionArgs } from "react-router";
import { redirect, useParams, useNavigate } from "react-router";
import { auth } from "~/lib/auth";
import { AdminLayout } from "~/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import {
  Wallet,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  FolderKanban,
  Building2,
  Users,
  Plus,
} from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { adminClient } from "~/lib/adminClient";
import { useProjectWallet } from "~/hooks/useDashboard";
import { UserRole } from "~/lib/types/roles";
import { useAuth } from "~/hooks/useAuth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user, projectId: params.projectId };
}

export function meta() {
  return [
    { title: "Project Wallet - Admin - Nowgai" },
    { name: "description", content: "Project wallet management" },
  ];
}

interface WalletData {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  balance: number;
  transactionCount: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
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
}

interface UserWallet {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  limit: number | null;
  currentSpending: number;
}

interface UserWalletsResponse {
  wallets: UserWallet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

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

export default function ProjectWalletPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const projectId = params.projectId;
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [creditBackDialogOpen, setCreditBackDialogOpen] = useState(false);
  const [creditBackAmount, setCreditBackAmount] = useState("");
  const [creditBackDescription, setCreditBackDescription] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [userWalletsPage, setUserWalletsPage] = useState(1);

  // Check user role - project admins cannot add funds
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
  } = useProjectWallet(projectId, !!projectId);

  // Fetch transactions
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery<TransactionsResponse>({
    queryKey: [
      "/api/admin/project-wallets/:projectId/transactions",
      projectId,
      currentPage,
    ],
    queryFn: async (): Promise<TransactionsResponse> => {
      if (!projectId) {
        return {
          transactions: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        };
      }
      const data = await adminClient.get<TransactionsResponse>(
        `/api/admin/project-wallets/${projectId}/transactions`,
        {
          params: { page: currentPage, limit: 10 },
        }
      );
      return (
        data || {
          transactions: [],
          pagination: {
            page: currentPage,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        }
      );
    },
    enabled: !!projectId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch org wallet for transfer (always fetch for org_admin, or when dialogs are open)
  const { data: orgWalletData } = useQuery<{ wallet: { balance: number } }>({
    queryKey: ["/api/admin/org-wallets", walletData?.wallet?.organizationId],
    queryFn: async () => {
      if (!walletData?.wallet?.organizationId) {
        return { wallet: { balance: 0 } };
      }
      return adminClient.get<{ wallet: { balance: number } }>(
        `/api/admin/org-wallets/${walletData.wallet.organizationId}`
      );
    },
    enabled: !!(
      walletData?.wallet?.organizationId &&
      (isOrgAdmin || transferDialogOpen || requestDialogOpen)
    ),
  });

  // Fetch fund requests
  const { data: fundRequestsData, refetch: refetchFundRequests } = useQuery<{
    fundRequests: Array<{
      id: string;
      projectId: string;
      projectName: string;
      organizationId: string;
      organizationName: string;
      amount: number;
      description: string;
      status: "pending" | "approved" | "rejected";
      requestedBy: string;
      reviewedBy: string | null;
      reviewComments: string;
      createdAt: string;
      reviewedAt: string | null;
    }>;
  }>({
    queryKey: [
      "/api/admin/fund-requests",
      projectId,
      walletData?.wallet?.organizationId,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (projectId) params.projectId = projectId;
      if (walletData?.wallet?.organizationId && isOrgAdmin) {
        params.organizationId = walletData.wallet.organizationId;
      }
      return adminClient.get<{ fundRequests: any[] }>(
        "/api/admin/fund-requests",
        {
          params,
        }
      );
    },
    enabled: !!projectId,
  });

  // Fetch user wallets
  const { data: userWalletsData, isLoading: userWalletsLoading } =
    useQuery<UserWalletsResponse>({
      queryKey: [
        "/api/admin/user-project-wallets/project",
        projectId,
        userWalletsPage,
      ],
      queryFn: async (): Promise<UserWalletsResponse> => {
        if (!projectId) {
          return {
            wallets: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          };
        }
        const data = await adminClient.get<UserWalletsResponse>(
          `/api/admin/user-project-wallets/project/${projectId}`,
          {
            params: { page: userWalletsPage, limit: 20 },
          }
        );
        return (
          data || {
            wallets: [],
            pagination: {
              page: userWalletsPage,
              limit: 20,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          }
        );
      },
      enabled: !!projectId,
    });

  // Handle payment success callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const sessionId = urlParams.get("session_id");

    if (paymentStatus === "success" && sessionId) {
      setIsProcessingPayment(true);
      // Verify the payment
      adminClient
        .post(`/api/admin/project-wallets/${projectId}/stripe-verify`, {
          sessionId,
        })
        .then(() => {
          // Invalidate wallet data
          queryClient.invalidateQueries({
            queryKey: ["/api/admin/project-wallets", projectId],
          });
          // Invalidate all transaction queries for this project (all pages)
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) &&
                key[0] ===
                  "/api/admin/project-wallets/:projectId/transactions" &&
                key[1] === projectId
              );
            },
          });
          // Also refetch the current page to ensure immediate update
          queryClient.refetchQueries({
            queryKey: [
              "/api/admin/project-wallets/:projectId/transactions",
              projectId,
              currentPage,
            ],
          });
          // Force refetch transactions immediately
          setTimeout(() => {
            refetchTransactions();
          }, 500);
          toast({
            title: "Payment Successful",
            description: "Credits have been added to the project wallet",
          });
          // Clean up URL
          navigate(`/admin/projects/${projectId}/wallet`, { replace: true });
        })
        .catch((error: Error) => {
          toast({
            title: "Payment Verification Failed",
            description: error.message || "Failed to verify payment",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsProcessingPayment(false);
        });
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "Payment was cancelled",
        variant: "destructive",
      });
      // Clean up URL
      navigate(`/admin/projects/${projectId}/wallet`, { replace: true });
    }
  }, [projectId, queryClient, toast, navigate]);

  const handleAddCredits = async () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessingPayment(true);

      // Get user's country code from browser location
      const { getCountryCodeForPayment } = await import("~/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      console.log("🌍 Detected country code:", countryCode);

      const response = await adminClient.post<{
        success: boolean;
        provider: string;
        url?: string;
        sessionId: string;
        keyId?: string;
        formData?: Record<string, string>;
        formAction?: string;
      }>(`/api/admin/project-wallets/${projectId}/stripe-checkout`, {
        amount,
        countryCode,
      });

      // Handle payment response based on provider (Stripe, Razorpay, PayU)
      const { handlePaymentResponse } = await import("~/utils/payment");
      await handlePaymentResponse(response, amount, () => {
        setIsProcessingPayment(false);
      });
    } catch (error: any) {
      setIsProcessingPayment(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  // Transfer mutation (org admin only)
  const transferMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return adminClient.post(
        `/api/admin/project-wallets/${projectId}/transfer-from-org`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "/api/admin/project-wallets/:projectId/transactions",
          projectId,
        ],
      });
      // Invalidate org wallet query to refresh balance
      if (walletData?.wallet?.organizationId) {
        queryClient.invalidateQueries({
          queryKey: [
            "/api/admin/org-wallets",
            walletData.wallet.organizationId,
          ],
        });
      }
      toast({
        title: "Transfer Successful",
        description: "Successfully transferred credits to project",
      });
      setTransferDialogOpen(false);
      setTransferAmount("");
      setTransferDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer funds",
        variant: "destructive",
      });
    },
  });

  // Fund request mutation (project admin only)
  const requestMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return adminClient.post("/api/admin/fund-requests", {
        projectId: projectId || "",
        amount: data.amount,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      refetchFundRequests();
      toast({
        title: "Request Created",
        description: "Fund request has been submitted for approval",
      });
      setRequestDialogOpen(false);
      setRequestAmount("");
      setRequestDescription("");
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create fund request";
      if (error instanceof Error) {
        const message = error.message;
        try {
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          errorMessage = message;
        }
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

  // Approve fund request mutation
  const approveRequestMutation = useMutation({
    mutationFn: async (data: {
      requestId: string;
      reviewComments?: string;
    }) => {
      return adminClient.post(
        `/api/admin/fund-requests/${data.requestId}/approve`,
        {
          reviewComments: data.reviewComments || "",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "/api/admin/project-wallets/:projectId/transactions",
          projectId,
        ],
      });
      if (walletData?.wallet?.organizationId) {
        queryClient.invalidateQueries({
          queryKey: [
            "/api/admin/org-wallets",
            walletData.wallet.organizationId,
          ],
        });
      }
      refetchFundRequests();
      toast({
        title: "Request Approved",
        description: "Funds have been transferred to the project",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to approve request";
      if (error instanceof Error) {
        const message = error.message;
        try {
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          errorMessage = message;
        }
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Reject fund request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (data: {
      requestId: string;
      reviewComments?: string;
    }) => {
      return adminClient.post(
        `/api/admin/fund-requests/${data.requestId}/reject`,
        {
          reviewComments: data.reviewComments || "",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      refetchFundRequests();
      toast({
        title: "Request Rejected",
        description: "Fund request has been rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

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
        description: `Organization wallet has insufficient balance. Current balance: ${formatCurrency(
          orgWalletData.wallet.balance
        )}`,
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      amount,
      description: transferDescription.trim(),
    });
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
        description: `Organization wallet does not have sufficient funds. Current balance: ${formatCurrency(
          orgWalletData.wallet.balance
        )}, Required: ${formatCurrency(amount)}`,
        variant: "destructive",
      });
      return;
    }

    requestMutation.mutate({
      amount,
      description: requestDescription.trim(),
    });
  };

  // Credit back mutation
  const creditBackMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string }) => {
      return adminClient.post(
        `/api/admin/project-wallets/${projectId}/credit-back-to-org`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "/api/admin/project-wallets/:projectId/transactions",
          projectId,
        ],
      });
      // Invalidate org wallet query to refresh balance
      if (walletData?.wallet?.organizationId) {
        queryClient.invalidateQueries({
          queryKey: [
            "/api/admin/org-wallets",
            walletData.wallet.organizationId,
          ],
        });
      }
      toast({
        title: "Credit Back Successful",
        description: "Successfully credited back funds to organization wallet",
      });
      setCreditBackDialogOpen(false);
      setCreditBackAmount("");
      setCreditBackDescription("");
    },
    onError: (error: any) => {
      // adminClient throws errors as Error objects with message containing status and response text
      let errorMessage = "Failed to credit back funds";

      if (error instanceof Error) {
        // Parse error message which might be in format "400: {error: '...', message: '...'}"
        const message = error.message;
        try {
          // Try to parse JSON from error message
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorData.error || message;
          } else {
            errorMessage = message;
          }
        } catch {
          // If parsing fails, use the message as is
          errorMessage = message;
        }
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

    if (wallet && wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Cannot credit back more than current balance: ${formatCurrency(
          wallet.balance
        )}`,
        variant: "destructive",
      });
      return;
    }

    creditBackMutation.mutate({
      amount,
      description: creditBackDescription.trim(),
    });
  };

  if (!projectId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Invalid project ID</p>
        </div>
      </AdminLayout>
    );
  }

  const wallet = walletData?.wallet;
  const transactions = transactionsData?.transactions || [];
  const userWallets = userWalletsData?.wallets || [];

  // Ensure disabled prop is always a boolean to avoid hydration mismatch
  const isCreditBackDisabled = wallet ? wallet.balance <= 0 : true;

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/projects")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8" />
              Project Wallet
            </h1>
            {wallet && (
              <div className="flex items-center gap-4 mt-1">
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCreditBackDialogOpen(true)}
              disabled={isCreditBackDisabled}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Credit Back to Org
            </Button>
            {isProjectAdmin && !isOrgAdmin ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(`/admin/projects/${projectId}/fund-requests`)
                  }
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  View Requests
                </Button>
                <Button onClick={() => setRequestDialogOpen(true)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Request Funds
                </Button>
              </>
            ) : (
              <>
                {isOrgAdmin && orgWalletData?.wallet && (
                  <Button
                    variant="outline"
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Direct Transfer
                  </Button>
                )}
                {isOrgAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/admin/fund-requests")}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Fund Requests
                  </Button>
                )}
              </>
            )}
            {canAddFunds && (
              <Button onClick={() => setAddCreditsOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
            )}
          </div>
        </div>

        {/* Wallet Overview Cards */}
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
            </CardContent>
          </Card>
        ) : wallet ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />$ Current Balance
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
                  Project Wallet
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Created{" "}
                  {(wallet as any).createdAt
                    ? formatDate((wallet as any).createdAt)
                    : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* User Project Wallets Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Project Wallets
            </CardTitle>
            <CardDescription>
              Manage individual user wallets and spending limits for this
              project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userWalletsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : userWallets.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Spending</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userWallets.map((userWallet) => (
                      <TableRow key={userWallet.id}>
                        <TableCell className="font-medium">
                          {userWallet.user?.name || "No name"}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {formatCurrency(userWallet.currentSpending || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {userWallet.limit !== null
                              ? formatCurrency(userWallet.limit)
                              : "No limit"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {userWallet.limit !== null &&
                          userWallet.currentSpending >= userWallet.limit ? (
                            <Badge variant="destructive">Limit Reached</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No user wallets yet</p>
                <p className="text-sm">
                  User wallets will be created automatically when members use
                  this project
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>
              View all credit additions and deductions for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : transactions.length > 0 ? (
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
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">
                  Transfer credits from organization wallet to see transaction
                  history
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Credits Dialog */}
        <Dialog
          open={addCreditsOpen}
          onOpenChange={(open) => {
            setAddCreditsOpen(open);
            if (!open) {
              setCreditAmount("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Credits
              </DialogTitle>
              <DialogDescription>
                Add credits directly to this project's wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="add-credit-amount">Amount (USD)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="add-credit-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={creditAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreditAmount(e.target.value)
                    }
                    placeholder="0.00"
                    className="pl-10"
                    disabled={isProcessingPayment}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Payment method will be selected based on your location
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddCreditsOpen(false);
                  setCreditAmount("");
                }}
                disabled={isProcessingPayment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCredits}
                disabled={
                  !creditAmount ||
                  parseFloat(creditAmount) <= 0 ||
                  isProcessingPayment
                }
              >
                {isProcessingPayment ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credit Back Dialog */}
        <Dialog
          open={creditBackDialogOpen}
          onOpenChange={(open) => {
            setCreditBackDialogOpen(open);
            if (!open) {
              setCreditBackAmount("");
              setCreditBackDescription("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeft className="h-5 w-5" />
                Credit Back to Organization Wallet
              </DialogTitle>
              <DialogDescription>
                Credit back unused funds from this project wallet to the
                organization wallet. Only funds received from the organization
                can be credited back.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Project</Label>
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <p className="font-medium">
                    {wallet?.projectName || "Loading..."}
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="credit-back-amount">Amount (Credits)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="credit-back-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={wallet?.balance}
                    value={creditBackAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreditBackAmount(e.target.value)
                    }
                    placeholder="0.00"
                    className="pl-10"
                    disabled={creditBackMutation.isPending}
                  />
                </div>
                {wallet && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current balance: {formatCurrency(wallet.balance)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="credit-back-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="credit-back-description"
                  value={creditBackDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCreditBackDescription(e.target.value)
                  }
                  placeholder="Reason for credit back..."
                  className="mt-2"
                  rows={3}
                  disabled={creditBackMutation.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreditBackDialogOpen(false);
                  setCreditBackAmount("");
                  setCreditBackDescription("");
                }}
                disabled={creditBackMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreditBack}
                disabled={
                  !creditBackAmount ||
                  parseFloat(creditBackAmount) <= 0 ||
                  creditBackMutation.isPending
                }
              >
                {creditBackMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Credit Back
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fund Request Dialog (Project Admin & Org Admin) */}
        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                {isOrgAdmin
                  ? "Request Transfer to Project"
                  : "Request Funds from Organization"}
              </DialogTitle>
              <DialogDescription>
                {isOrgAdmin
                  ? "Submit a fund request for approval. The request will need to be reviewed and approved before funds are transferred."
                  : "Request funds from the organization wallet. Your request will be reviewed by the organization admin."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="request-amount">Amount (Credits)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="request-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={requestAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRequestAmount(e.target.value)
                    }
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available in org wallet:{" "}
                  {orgWalletData?.wallet
                    ? formatCurrency(orgWalletData.wallet.balance)
                    : "$0.00"}
                </p>
                {orgWalletData?.wallet &&
                  parseFloat(requestAmount) > orgWalletData.wallet.balance && (
                    <p className="text-xs text-destructive mt-1">
                      Organization wallet does not have sufficient funds
                    </p>
                  )}
              </div>
              <div>
                <Label htmlFor="request-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="request-description"
                  value={requestDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setRequestDescription(e.target.value)
                  }
                  placeholder="e.g., Monthly allocation, project expenses..."
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
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequest}
                disabled={
                  !requestAmount ||
                  requestMutation.isPending ||
                  (orgWalletData?.wallet &&
                    parseFloat(requestAmount) > orgWalletData.wallet.balance)
                }
              >
                {requestMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Direct Transfer Dialog (Org Admin) */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Direct Transfer from Organization
              </DialogTitle>
              <DialogDescription>
                Immediately transfer credits from organization wallet to this
                project wallet. This is an atomic transaction that happens
                instantly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="transfer-amount">Amount (Credits)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="transfer-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={orgWalletData?.wallet?.balance}
                    value={transferAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTransferAmount(e.target.value)
                    }
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available in org wallet:{" "}
                  {orgWalletData?.wallet
                    ? formatCurrency(orgWalletData.wallet.balance)
                    : "$0.00"}
                </p>
              </div>
              <div>
                <Label htmlFor="transfer-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="transfer-description"
                  value={transferDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setTransferDescription(e.target.value)
                  }
                  placeholder="e.g., Monthly allocation..."
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
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={!transferAmount || transferMutation.isPending}
              >
                {transferMutation.isPending
                  ? "Transferring..."
                  : "Transfer Credits"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fund Requests Section (Org Admin) */}
        {isOrgAdmin &&
          fundRequestsData?.fundRequests &&
          fundRequestsData.fundRequests.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pending Fund Requests</CardTitle>
                    <CardDescription>
                      Review and approve or reject fund requests from project
                      admins
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/admin/fund-requests")}
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
                              <Badge variant="outline">
                                {request.projectName}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(request.amount)}
                              </span>
                            </div>
                            {request.description && (
                              <p className="text-sm text-muted-foreground">
                                {request.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested {formatDate(request.createdAt)}
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
      </div>
    </AdminLayout>
  );
}
