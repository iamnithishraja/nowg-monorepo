import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    CreditCard,
    Download,
    MoreVertical,
    Receipt,
    RefreshCw,
    Search,
    Wallet
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { UserRole, hasAdminAccess } from "~/lib/types/roles";
import { AdminLayout } from "../components/AdminLayout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/useAuth";
import { useStripeVerify } from "../hooks/useDashboard";
import { adminClient } from "../lib/adminClient";
import { auth } from "../lib/auth";

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
  walletType?:
    | "org_wallet"
    | "project_wallet"
    | "user_project_wallet"
    | "user_wallet";
  projectId?: string;
  projectName?: string;
  organizationId?: string;
  organizationName?: string;
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
  wallet?: {
    balance: number;
    type: string;
    transactionCount: number;
  };
  walletInfo?: {
    balance: number;
    type: string;
    transactionCount: number;
  };
  projects?: Array<{
    id: string;
    name: string;
  }>;
}

interface OrganizationData {
  id: string;
  name: string;
  paymentProvider: "stripe" | "razorpay" | "payu" | null;
  createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Wallet - Admin - Nowgai" },
    { name: "description", content: "Wallet management" },
  ];
}

export default function AdminWallet() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [requestFundsOpen, setRequestFundsOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [isRequestingFunds, setIsRequestingFunds] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isFullAdmin = hasAdminAccess(userRole);
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;
  const userOrganizationId = (user as any)?.organizationId;
  const projectId = (user as any)?.projectId;

  // Get projects for project_admin - fetch all projects
  const { data: projectsData } = useQuery<{ projects: any[] }>({
    queryKey: ["/api/admin/projects", "all"],
    queryFn: () =>
      adminClient.get<{ projects: any[] }>("/api/admin/projects", {
        params: {
          page: 1,
          limit: 100, // Fetch all projects for project admin
        },
      }),
    enabled: isProjectAdmin && !isOrgAdmin && !isFullAdmin,
  });
  const projects = projectsData?.projects || [];

  // Set default selected project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Get organizationId from URL query params (from Stripe redirect) or fall back to user's org
  const [organizationId, setOrganizationId] = useState<string | undefined>(
    userOrganizationId
  );

  // Get organizationId from URL on client side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const organizationIdFromUrl = params.get("organizationId");
      setOrganizationId(organizationIdFromUrl || userOrganizationId);
    }
  }, [userOrganizationId]);

  // Fetch organization data for org_admin
  const { data: organizationData } = useQuery<{ organization: OrganizationData }>({
    queryKey: ["/api/admin/organizations", organizationId],
    queryFn: () =>
      adminClient.get<{ organization: OrganizationData }>(
        `/api/admin/organizations/${organizationId}`
      ),
    enabled: isOrgAdmin && !!organizationId && !isFullAdmin,
  });

  // Fetch wallet data for org_admin (to get balance)
  const { data: walletFullData } = useQuery<{ wallet: { balance: number; transactionCount: number } }>({
    queryKey: ["/api/admin/org-wallets", organizationId],
    queryFn: () =>
      adminClient.get<{ wallet: { balance: number; transactionCount: number } }>(
        `/api/admin/org-wallets/${organizationId}`
      ),
    enabled: isOrgAdmin && !!organizationId && !isFullAdmin,
  });


  // Payment provider update mutation
  const updatePaymentProviderMutation = useMutation({
    mutationFn: async (provider: "stripe" | "razorpay" | "payu" | null) => {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/payment-provider`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paymentProvider: provider }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update payment provider");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/organizations", organizationId],
      });
      toast({
        title: "Payment Provider Updated",
        description: "Payment provider has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update payment provider",
        variant: "destructive",
      });
    },
  });

  // Stripe verify mutation
  const stripeVerifyMutation = useStripeVerify(organizationId, () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/admin/wallet"],
    });
    toast({
      title: "Payment Successful",
      description: "Credits have been added to your wallet",
    });
  });

  // Check for payment success in URL and verify payment (for org wallets)
  useEffect(() => {
    if (typeof window === "undefined" || !isOrgAdmin || !organizationId) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId && organizationId) {
      stripeVerifyMutation.mutate({ sessionId });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [isOrgAdmin, organizationId, stripeVerifyMutation]);

  // Check for payment success in URL and verify payment (for project wallets)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !hasProjectAdminAccess ||
      !selectedProjectId
    )
      return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId && selectedProjectId) {
      // Verify project wallet payment
      adminClient
        .post(`/api/admin/project-wallets/${selectedProjectId}/stripe-verify`, {
          sessionId,
        })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ["/api/admin/wallet"],
          });
          queryClient.invalidateQueries({
            queryKey: [
              "/api/admin/project-wallets/:projectId/transactions",
              selectedProjectId,
            ],
          });
          toast({
            title: "Payment Successful",
            description: "Credits have been added to the project wallet",
          });
          // Clean up URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        })
        .catch((error: Error) => {
          toast({
            title: "Payment Verification Failed",
            description: error.message || "Failed to verify payment",
            variant: "destructive",
          });
        });
    }
  }, [hasProjectAdminAccess, selectedProjectId, queryClient, toast]);

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
        const response = await adminClient.get<{
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
          transformedTransactions = transformedTransactions.filter((t) => {
            const desc = (t.description || "").toLowerCase();
            const paymentId = (t.stripePaymentId || "").toLowerCase();
            return (
              desc.includes(searchLower) || paymentId.includes(searchLower)
            );
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
        return adminClient.get<TransactionsResponse>("/api/admin/wallet", {
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

  // Calculate credits used and purchased from transaction data
  // Credits used = sum of all debit transactions
  // Credits purchased = sum of all credit transactions that are external payments (have payment IDs)
  const creditsUsed = data?.transactions
    ?.filter((t) => t.type === "deduction")
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const creditsPurchased = data?.transactions
    ?.filter((t) => t.type === "recharge" && t.stripePaymentId)
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalAvailableCredits = isProjectAdmin && !isOrgAdmin && !isFullAdmin
    ? (data?.walletInfo?.balance || data?.wallet?.balance || 0)
    : (walletFullData?.wallet?.balance || data?.wallet?.balance || 0);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort transactions based on sortColumn and sortDirection
  const sortedTransactions = data?.transactions ? [...data.transactions].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "date":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case "amount":
        aValue = a.amount;
        bValue = b.amount;
        break;
      case "category":
        aValue = a.type === "recharge" ? "Credit Refill" : "Org. Plan (1m)";
        bValue = b.type === "recharge" ? "Credit Refill" : "Org. Plan (1m)";
        break;
      case "startingBal":
        aValue = a.balanceBefore;
        bValue = b.balanceBefore;
        break;
      case "endingBal":
        aValue = a.balanceAfter;
        bValue = b.balanceAfter;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }) : [];

  // Sortable header component
  const SortableHeader = ({ 
    column, 
    children, 
    isPrimary = false 
  }: { 
    column: string; 
    children: string;
    isPrimary?: boolean;
  }) => {
    const isActive = sortColumn === column;
    return (
      <TableHead 
        className="text-[#525252] cursor-pointer hover:text-white transition-colors"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          <span>{children}</span>
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${
                isActive && sortDirection === "asc" 
                  ? "text-white" 
                  : "text-[#525252]"
              }`} 
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${
                isActive && sortDirection === "desc" 
                  ? "text-white" 
                  : "text-[#525252]"
              }`} 
            />
          </div>
        </div>
      </TableHead>
    );
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

  // Format date for billing history (matches image format: "Dec 17 7:35 PM")
  const formatBillingDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Get payment provider display name
  const getPaymentProviderName = (provider: string | null) => {
    if (!provider) return "Default";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  // Handle Buy Credits
  const handleBuyCredits = async () => {
    if (!organizationId) return;

    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than $0",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Get country code for payment
      const { getCountryCodeForPayment, handlePaymentResponse } = await import(
        "~/utils/payment"
      );
      const countryCode = await getCountryCodeForPayment();

      const response = await fetch(
        `/api/admin/org-wallets/${organizationId}/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            amount: amount,
            countryCode: countryCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Handle different payment providers
      await handlePaymentResponse(data, amount, () => {
        setIsProcessingPayment(false);
        setBuyCreditsOpen(false);
        setCreditAmount("");
      });
    } catch (error: any) {
      console.error("Error initiating payment:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  // Handle Request Funds for project_admin
  const handleRequestFunds = async () => {
    if (!selectedProjectId) return;

    const amount = parseFloat(requestAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than $0",
        variant: "destructive",
      });
      return;
    }

    setIsRequestingFunds(true);
    try {
      const response = await fetch("/api/admin/fund-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          projectId: selectedProjectId,
          amount: amount,
          description: requestDescription || `Fund request for ${selectedProject?.name || "project"}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to create fund request");
      }

      toast({
        title: "Request Submitted",
        description: "Fund request has been submitted for approval",
      });

      setRequestFundsOpen(false);
      setRequestAmount("");
      setRequestDescription("");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/project-wallets/:projectId/transactions", selectedProjectId],
      });
    } catch (error: any) {
      console.error("Error requesting funds:", error);
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit fund request",
        variant: "destructive",
      });
    } finally {
      setIsRequestingFunds(false);
    }
  };

  // Handle PDF Export
  const handleExportPDF = async () => {
    const entityId = isProjectAdmin && !isOrgAdmin && !isFullAdmin ? selectedProjectId : organizationId;
    if (!entityId || !data) return;

    setIsExportingPDF(true);
    try {
      // Create PDF content
      const pdfContent = {
        title: "Billing History",
        entity: isProjectAdmin && !isOrgAdmin && !isFullAdmin
          ? (selectedProject?.name || "Project")
          : (organizationData?.organization?.name || "Organization"),
        transactions: data.transactions.map((t) => ({
          date: formatBillingDate(t.createdAt),
          category: t.type === "recharge" ? "Credit Refill" : "Org. Plan (1m)",
          status: "Success",
          amount: `$${t.amount.toFixed(2)}`,
          startingBal: `$${t.balanceBefore.toFixed(2)}`,
          endingBal: `$${t.balanceAfter.toFixed(2)}`,
          details: t.description || t.stripePaymentId || "",
        })),
      };

      // For now, create a simple CSV/PDF download
      // In production, you'd want to use a proper PDF library
      const csvContent = [
        ["Date", "Category", "Status", "Amount", "Starting Bal.", "Ending Bal.", "Details"],
        ...pdfContent.transactions.map((t) => [
          t.date,
          t.category,
          t.status,
          t.amount,
          t.startingBal,
          t.endingBal,
          t.details,
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `billing-history-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Started",
        description: "Billing history has been exported",
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export billing history",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Get payment provider icon - credit card style with brand colors
  const getPaymentProviderIcon = (provider: string | null) => {
    if (!provider || provider === "stripe") {
      // Stripe - white card with purple accent
      return (
        <div className="relative w-10 h-6 bg-white rounded overflow-hidden shadow-sm border border-gray-200/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#635BFF]"></div>
          <div className="absolute bottom-1 left-2 text-[#635BFF] text-[8px] font-bold">STRIPE</div>
        </div>
      );
    }

    switch (provider) {
      case "razorpay":
        // Razorpay - blue card
        return (
          <div className="relative w-10 h-6 bg-[#3395FF] rounded overflow-hidden shadow-sm">
            <div className="absolute bottom-1 left-2 text-white text-[8px] font-bold">RAZOR</div>
          </div>
        );
      case "payu":
        // PayU - orange card
        return (
          <div className="relative w-10 h-6 bg-[#FF6B35] rounded overflow-hidden shadow-sm">
            <div className="absolute bottom-1 left-2 text-white text-[8px] font-bold">PAYU</div>
          </div>
        );
      default:
        return (
          <div className="relative w-10 h-6 bg-white rounded overflow-hidden shadow-sm border border-gray-200/30">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#635BFF]"></div>
            <div className="absolute bottom-1 left-2 text-[#635BFF] text-[8px] font-bold">STRIPE</div>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div>
          {isOrgAdmin && !isFullAdmin ? (
            // Credits & Billing Page for Org Admin
            <>
              {/* Project Selector (if multiple projects for project_admin) */}
              {isProjectAdmin && !isOrgAdmin && projects.length > 1 && (
                <div className="mb-6">
                  <Select
                    value={selectedProjectId || ""}
                    onValueChange={(value) => {
                      setSelectedProjectId(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[300px] bg-[#0a0a0a] border-[#1a1a1a] text-white">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-[#1a1a1a]">
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-white mb-1">
                    Credits & Billing
                  </h1>
                  <p className="text-sm text-[#525252]">
                    {isProjectAdmin && !isOrgAdmin
                      ? "Manage project credits and fund requests."
                      : "Manage plan, credits and payment information."}
                  </p>
                </div>
              </div>

              {/* Credits Balance Section */}
              <Card className="mb-6 bg-[#0a0a0a] border-[#1a1a1a]">
                <CardHeader>
                  <CardTitle className="text-white">Credits Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Credit Card Widget */}
                    <div className="relative bg-[#080808] rounded-lg p-6 border border-[#1a1a1a] min-h-[200px]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-2xl font-bold text-white">NOWG</div>
                        <div className="w-12 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded opacity-50"></div>
                      </div>
                      <div className="text-4xl font-bold text-white mb-2">
                        ${totalAvailableCredits.toFixed(2)}
                      </div>
                      <div className="text-sm text-[#525252]">
                        {isProjectAdmin && !isOrgAdmin
                          ? (selectedProject?.name?.toUpperCase() || "PROJECT") + " JOINED " + (selectedProject?.createdAt
                              ? new Date(selectedProject.createdAt).toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  year: "2-digit",
                                })
                              : "")
                          : (organizationData?.organization?.name?.toUpperCase() || "ORGANIZATION") + " JOINED " + (organizationData?.organization?.createdAt
                              ? new Date(organizationData.organization.createdAt).toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  year: "2-digit",
                                })
                              : "")}
                      </div>
                      <div className="mt-4 text-sm text-[#525252]">
                        Your monthly credits reset in 7 days.
                      </div>
                    </div>

                    {/* Right: Credit Details */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Select defaultValue="dec-25">
                          <SelectTrigger className="w-[120px] bg-[#0a0a0a] border-[#1a1a1a] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-[#1a1a1a]">
                            <SelectItem value="dec-25">Dec '25</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#525252]">Credit Used</span>
                            <span className="text-xs text-[#525252] cursor-help">ⓘ</span>
                          </div>
                          <span className="text-sm font-medium text-white">
                            ${creditsUsed.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#525252]">Credits Purchased</span>
                            <span className="text-xs text-[#525252] cursor-help">ⓘ</span>
                          </div>
                          <span className="text-sm font-medium text-white">
                            ${creditsPurchased.toFixed(2)}
                          </span>
                        </div>
                        <div className="pt-3 border-t border-[#1a1a1a]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">Total Available Credits</span>
                            <span className="text-lg font-bold text-white">
                              ${totalAvailableCredits.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isProjectAdmin && !isOrgAdmin ? (
                        <Button 
                          onClick={() => setRequestFundsOpen(true)}
                          className="w-full text-white hover:opacity-90 border-0"
                          style={{
                            background: "linear-gradient(89.84deg, #4208FF 5.63%, #611BF3 49.1%, #D30DFF 88.1%, #FF76B9 99.84%)"
                          }}
                        >
                          Request Funds
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => setBuyCreditsOpen(true)}
                          className="w-full text-white hover:opacity-90 border-0"
                          style={{
                            background: "linear-gradient(89.84deg, #4208FF 5.63%, #611BF3 49.1%, #D30DFF 88.1%, #FF76B9 99.84%)"
                          }}
                        >
                          Buy Credits
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method Section - Only for Org Admin */}
              {isOrgAdmin && !isProjectAdmin && (
                <Card className="mb-6 bg-[#0a0a0a] border-[#1a1a1a]">
                  <CardHeader>
                    <CardTitle className="text-white">Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg border border-[#1a1a1a]">
                      <div className="flex items-center gap-3">
                        {getPaymentProviderIcon(organizationData?.organization?.paymentProvider || null)}
                        <div>
                          <div className="text-sm font-medium text-white">
                            {getPaymentProviderName(organizationData?.organization?.paymentProvider || null)}
                            {organizationData?.organization?.paymentProvider && (
                              <span className="text-[#525252] ml-2">
                                (.... {organizationData.organization.paymentProvider.slice(-4)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#0a0a0a]">
                            <MoreVertical className="h-4 w-4 text-[#525252]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#0a0a0a] border-[#1a1a1a]">
                          <DropdownMenuItem
                            onClick={() => updatePaymentProviderMutation.mutate("stripe")}
                            className="text-white hover:bg-[#1a1a1a]"
                          >
                            Stripe
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updatePaymentProviderMutation.mutate("razorpay")}
                            className="text-white hover:bg-[#1a1a1a]"
                          >
                            Razorpay
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updatePaymentProviderMutation.mutate("payu")}
                            className="text-white hover:bg-[#1a1a1a]"
                          >
                            PayU
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updatePaymentProviderMutation.mutate(null)}
                            className="text-white hover:bg-[#1a1a1a]"
                          >
                            Default
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Billing History Section */}
              <Card className="bg-[#0a0a0a] border-[#1a1a1a]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Billing History</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleExportPDF}
                      disabled={isExportingPDF || !data || data.transactions.length === 0}
                      className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isExportingPDF ? "Exporting..." : "Export"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search and Filters */}
                  <div className="mb-4 space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#525252]" />
                      <Input
                        placeholder="Search by payment ID or user.."
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10 bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder:text-[#525252]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={searchTerm === "" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSearchChange("")}
                        className={searchTerm === "" ? "bg-[#7b4cff] text-white" : "bg-transparent border-[#1a1a1a] text-white"}
                      >
                        All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                      >
                        Plan Billing
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                      >
                        Credit Refills
                      </Button>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  {isLoading ? (
                    <div className="text-center py-8 text-[#525252]">Loading transactions...</div>
                  ) : data && data.transactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#1a1a1a] hover:bg-transparent">
                            <SortableHeader column="date" isPrimary>Date</SortableHeader>
                            <SortableHeader column="category">Category</SortableHeader>
                            <TableHead className="text-[#525252]">Status</TableHead>
                            <SortableHeader column="amount" isPrimary>Amount</SortableHeader>
                            <SortableHeader column="startingBal">Starting Bal.</SortableHeader>
                            <SortableHeader column="endingBal">Ending Bal.</SortableHeader>
                            <TableHead className="text-[#525252]">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedTransactions.map((transaction) => (
                            <TableRow key={transaction._id} className="border-[#1a1a1a] hover:bg-[#1a1a1a]">
                              <TableCell className="text-white font-mono text-sm">
                                {formatBillingDate(transaction.createdAt)}
                              </TableCell>
                              <TableCell className="text-white">
                                {transaction.type === "recharge" ? "Credit Refill" : "Org. Plan (1m)"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={transaction.type === "recharge" ? "default" : "default"}
                                  className={
                                    transaction.type === "recharge"
                                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                                      : "bg-green-500/20 text-green-400 border-green-500/30"
                                  }
                                >
                                  Success
                                </Badge>
                              </TableCell>
                              <TableCell className="text-white font-mono">
                                ${transaction.amount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-[#525252] font-mono text-sm">
                                ${transaction.balanceBefore.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-white font-mono text-sm">
                                ${transaction.balanceAfter.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-[#525252]">
                                  {transaction.description || transaction.stripePaymentId || ""}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[#525252]">
                      No transactions found
                    </div>
                  )}

                  {/* Pagination */}
                  {data && data.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-[#525252]">
                        Page {data.pagination.page} of {data.pagination.totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => prev + 1)}
                          disabled={!data.pagination.hasMore}
                          className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-[#525252]">
                    {isProjectAdmin && !isOrgAdmin
                      ? "Billing history shows only external payment transactions to project wallet. To see transaction details visit "
                      : "Billing history shows only external payment transactions to organization wallet. To see transaction details within org. visit "}
                    <a 
                      href={isProjectAdmin && !isOrgAdmin 
                        ? `/admin/projects/${selectedProjectId}/ledger` 
                        : "/admin/organizations/ledger"} 
                      className="text-[#7b4cff] hover:underline"
                    >
                      Wallet Transactions
                    </a>
                    .
                  </div>
                </CardContent>
              </Card>

              {/* Buy Credits Dialog - For Org Admin */}
              {isOrgAdmin && !isProjectAdmin && (
                <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
                  <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Buy Credits</DialogTitle>
                      <DialogDescription className="text-[#525252]">
                        Add credits to your organization wallet
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-white">
                          Amount (USD)
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="Enter amount"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          className="bg-[#1a1a1a] border-[#1a1a1a] text-white"
                          min="1"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setBuyCreditsOpen(false);
                          setCreditAmount("");
                        }}
                        className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBuyCredits}
                        disabled={isProcessingPayment || !creditAmount || parseFloat(creditAmount) <= 0}
                        className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {isProcessingPayment ? "Processing..." : "Continue"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Request Funds Dialog - For Project Admin */}
              {isProjectAdmin && !isOrgAdmin && (
                <Dialog open={requestFundsOpen} onOpenChange={setRequestFundsOpen}>
                  <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Request Funds</DialogTitle>
                      <DialogDescription className="text-[#525252]">
                        Request funds from organization wallet for your project
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="request-amount" className="text-white">
                          Amount (USD)
                        </Label>
                        <Input
                          id="request-amount"
                          type="number"
                          placeholder="Enter amount"
                          value={requestAmount}
                          onChange={(e) => setRequestAmount(e.target.value)}
                          className="bg-[#1a1a1a] border-[#1a1a1a] text-white"
                          min="1"
                          step="0.01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="request-description" className="text-white">
                          Description (Optional)
                        </Label>
                        <Input
                          id="request-description"
                          type="text"
                          placeholder="Enter description for this request"
                          value={requestDescription}
                          onChange={(e) => setRequestDescription(e.target.value)}
                          className="bg-[#1a1a1a] border-[#1a1a1a] text-white"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRequestFundsOpen(false);
                          setRequestAmount("");
                          setRequestDescription("");
                        }}
                        className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRequestFunds}
                        disabled={isRequestingFunds || !requestAmount || parseFloat(requestAmount) <= 0}
                        className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {isRequestingFunds ? "Submitting..." : "Submit Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          ) : (
            // Original UI for other roles
            <>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-[6px] accent-primary/10">
                    <CreditCard className="h-6 w-6 text-[#7b4cff]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-primary">
                      {isFullAdmin
                        ? "All Wallet Transactions"
                        : isProjectAdmin
                        ? "Project Wallet Transactions"
                        : "Wallet Recharges"}
                    </h1>
                    <p className="text-secondary text-sm mt-0.5">
                      {isFullAdmin
                        ? "View external payment gateway transactions (Stripe payments) across all wallets"
                        : isProjectAdmin
                        ? "View external payment gateway transactions (Stripe payments) for project wallets"
                        : "View external payment gateway transactions (Stripe payments) for user wallets"}
                    </p>
                  </div>
                </div>
              </div>

          {/* Project Selector (if multiple projects for project_admin) */}
          {isProjectAdmin &&
            !isOrgAdmin &&
            !isFullAdmin &&
            projects.length > 1 && (
              <div className="rounded-[12px] bg-surface-1 border border-subtle mb-6">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-primary">Project:</label>
                      <Select
                        value={selectedProjectId || ""}
                        onValueChange={(value) => {
                          setSelectedProjectId(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[300px] bg-surface-2 border-subtle text-primary">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-2 border-subtle">
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-primary">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* Wallet Summary - For Org Admin and Project Admin (not for full admin) */}
          {(isOrgAdmin || isProjectAdmin) && !isFullAdmin && (
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {isLoading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[12px] bg-surface-1 border border-subtle"
                    >
                      <Card className="bg-transparent border-0 shadow-none">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-surface-2 rounded-full animate-pulse" />
                            <div className="space-y-2">
                              <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
                              <div className="h-6 w-16 bg-surface-2 rounded animate-pulse" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </>
              ) : data?.wallet || data?.walletInfo ? (
                <>
                  <div className="rounded-[12px] bg-surface-1 border border-subtle">
                    <Card className="bg-transparent border-0 shadow-none">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-success-500/10 rounded-full">
                            <CreditCard className="h-6 w-6 text-[#22c55e]" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">
                              Current Balance
                            </p>
                            <p className="text-2xl font-bold text-[#22c55e]">
                              $
                              {(
                                data.wallet || data.walletInfo
                              )?.balance.toFixed(2) || "0.00"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-transparent border-0 shadow-none">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-info-500/10 rounded-full">
                            <Receipt className="h-6 w-6 text-info-500" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">
                              Total Transactions
                            </p>
                            <p className="text-2xl font-bold text-primary">
                              {(data.wallet || data.walletInfo)
                                ?.transactionCount || 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="rounded-[12px] bg-surface-1 border border-subtle">
                    <Card className="bg-transparent border-0 shadow-none">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 accent-primary/10 rounded-full">
                            <Building2 className="h-6 w-6 text-[#7b4cff]" />
                          </div>
                          <div>
                            <p className="text-sm text-secondary">
                              Wallet Type
                            </p>
                            <p className="text-2xl font-bold capitalize text-primary">
                              {(
                                (data.wallet || data.walletInfo)?.type || ""
                              ).replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
              <Input
                placeholder={
                  isFullAdmin
                    ? "Search by user, organization, project, or payment ID..."
                    : "Search by payment ID..."
                }
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-surface-1 border-subtle text-primary placeholder:text-tertiary focus:border-[#555558]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader className="border-b border-subtle">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Wallet className="h-5 w-5 text-[#7b4cff]" />
                    {isFullAdmin
                      ? "All Transactions"
                      : isProjectAdmin
                      ? "Project Transactions"
                      : isOrgAdmin
                      ? "Organization Transactions"
                      : "Recharge Transactions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="rounded-[12px] border border-subtle bg-surface-2 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-subtle hover:bg-transparent">
                          <TableHead className="text-secondary">Date</TableHead>
                          {isFullAdmin && <TableHead className="text-secondary">Wallet Type</TableHead>}
                          {isFullAdmin && <TableHead className="text-secondary">Organization</TableHead>}
                          {isFullAdmin && <TableHead className="text-secondary">Project</TableHead>}
                          {(!isOrgAdmin || isFullAdmin) && (
                            <TableHead className="text-secondary">User</TableHead>
                          )}
                          <TableHead className="text-secondary">Type</TableHead>
                          <TableHead className="text-secondary">Amount</TableHead>
                          <TableHead className="text-secondary">Balance Before</TableHead>
                          <TableHead className="text-secondary">Balance After</TableHead>
                          <TableHead className="text-secondary">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...Array(5)].map((_, i) => (
                          <TableRow key={i} className="border-b border-subtle">
                            {[...Array(isFullAdmin ? 10 : 8)].map((__, j) => (
                              <TableCell key={j} className="py-3">
                                <div className="h-4 w-full rounded bg-subtle animate-pulse" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : data && data.transactions.length > 0 ? (
            <>
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="border-b border-subtle">
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Wallet className="h-5 w-5 text-[#7b4cff]" />
                      {isFullAdmin
                        ? "All Transactions"
                        : isProjectAdmin
                        ? "Project Transactions"
                        : isOrgAdmin
                        ? "Organization Transactions"
                        : "Recharge Transactions"}
                      <span className="text-sm font-normal text-tertiary ml-2">
                        ({data.pagination.total} total)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-[12px] border border-subtle">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-subtle hover:bg-transparent">
                            <TableHead className="text-secondary">Date</TableHead>
                            {isFullAdmin && <TableHead className="text-secondary">Wallet Type</TableHead>}
                            {isFullAdmin && <TableHead className="text-secondary">Organization</TableHead>}
                            {isFullAdmin && <TableHead className="text-secondary">Project</TableHead>}
                            {(!isOrgAdmin || isFullAdmin) && (
                              <TableHead className="text-secondary">User</TableHead>
                            )}
                            <TableHead className="text-secondary">Type</TableHead>
                            <TableHead className="text-secondary">Amount</TableHead>
                            <TableHead className="text-secondary">Balance Before</TableHead>
                            <TableHead className="text-secondary">Balance After</TableHead>
                            <TableHead className="text-secondary">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.transactions.map((transaction) => (
                            <TableRow key={transaction._id} className="border-b border-subtle hover:bg-surface-2">
                              <TableCell className="font-mono text-sm text-primary">
                                {formatDate(transaction.createdAt)}
                              </TableCell>
                              {isFullAdmin && (
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="capitalize border-subtle text-secondary"
                                  >
                                    {transaction.walletType?.replace(
                                      /_/g,
                                      " "
                                    ) || "Unknown"}
                                  </Badge>
                                </TableCell>
                              )}
                              {isFullAdmin && (
                                <TableCell>
                                  {transaction.organizationName ? (
                                    <div className="text-sm">
                                      <div className="font-medium text-primary">
                                        {transaction.organizationName}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-tertiary">
                                      -
                                    </span>
                                  )}
                                </TableCell>
                              )}
                              {isFullAdmin && (
                                <TableCell>
                                  {transaction.projectName ? (
                                    <div className="text-sm">
                                      <div className="font-medium text-primary">
                                        {transaction.projectName}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-tertiary">
                                      -
                                    </span>
                                  )}
                                </TableCell>
                              )}
                              {(!isOrgAdmin || isFullAdmin) && (
                                <TableCell>
                                  <div>
                                    <div className="font-medium text-primary">
                                      {transaction.userName}
                                    </div>
                                    <div className="text-xs text-tertiary">
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
                                      ? "text-[#22c55e]"
                                      : "text-[#ef4444]"
                                  }
                                >
                                  {transaction.type === "recharge" ||
                                  transaction.type === "refund"
                                    ? "+"
                                    : "-"}
                                  {formatAmount(Math.abs(transaction.amount))}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-tertiary">
                                {formatAmount(transaction.balanceBefore)}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium text-primary">
                                {formatAmount(transaction.balanceAfter)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm space-y-1">
                                  {transaction.description && (
                                    <div className="text-secondary">
                                      {transaction.description}
                                    </div>
                                  )}
                                  {transaction.model && (
                                    <div className="text-xs">
                                      <span className="text-tertiary">
                                        Model:
                                      </span>{" "}
                                      <span className="text-primary">{transaction.model}</span>
                                    </div>
                                  )}
                                  {transaction.inputTokens !== undefined &&
                                    transaction.outputTokens !== undefined && (
                                      <div className="text-xs">
                                        <span className="text-tertiary">
                                          Tokens:
                                        </span>{" "}
                                        <span className="text-primary">{transaction.inputTokens.toLocaleString()}
                                        ↑{" "}
                                        {transaction.outputTokens.toLocaleString()}
                                        ↓</span>
                                      </div>
                                    )}
                                  {transaction.stripePaymentId && (
                                    <div className="text-xs font-mono text-tertiary">
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
                        <div className="text-sm text-tertiary">
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
                            className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558] disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            disabled={!data.pagination.hasMore}
                            className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558] disabled:opacity-50"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="rounded-[12px] bg-surface-1 border border-subtle">
              <Card className="bg-transparent border-0 shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-24">
                  <Wallet className="h-20 w-20 text-tertiary mb-6" />
                  <h3 className="text-xl font-medium mb-2 text-primary">
                    No recharge transactions found
                  </h3>
                  <p className="text-sm text-tertiary">
                    {searchTerm
                      ? "Try adjusting your search criteria"
                      : "Recharge transactions will appear here"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
