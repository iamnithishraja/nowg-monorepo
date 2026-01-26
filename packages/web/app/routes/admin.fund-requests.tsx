import { UserRole } from "@nowgai/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Search,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { AdminLayout } from "~/components/AdminLayout";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { useAuth } from "~/hooks/useAuth";
import { adminClient } from "~/lib/adminClient";
import { auth } from "~/lib/auth";

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
    { title: "Credit Refill Requests - Admin - Nowgai" },
    { name: "description", content: "Manage credit refill requests" },
  ];
}

interface FundRequest {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedByUser?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  reviewedBy: string | null;
  reviewComments: string;
  createdAt: string;
  reviewedAt: string | null;
}

interface FundRequestsResponse {
  fundRequests: FundRequest[];
}

interface ProjectWallet {
  balance: number;
  creditsUsed?: number;
  creditsTotal?: number;
}

const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months}mo ago`;
  }
};

const getUserInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "U";
};

export default function FundRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(
    null
  );
  const [reviewComments, setReviewComments] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );

  // Filters and search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<"all" | "30d" | "6m" | "1y">(
    "all"
  );
  const [statusFilters, setStatusFilters] = useState({
    pending: true,
    approved: true,
    rejected: true,
  });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isExporting, setIsExporting] = useState(false);

  const userRole = (user as any)?.role;
  const hasOrgAdminAccess = (user as any)?.hasOrgAdminAccess;
  const hasProjectAdminAccess = (user as any)?.hasProjectAdminAccess;
  const isOrgAdmin =
    userRole === UserRole.ORG_ADMIN || hasOrgAdminAccess === true;
  const isProjectAdmin =
    userRole === UserRole.PROJECT_ADMIN || hasProjectAdminAccess === true;

  // Fetch fund requests
  const { data: fundRequestsData, isLoading } = useQuery<FundRequestsResponse>({
    queryKey: ["/api/admin/fund-requests"],
    queryFn: async () => {
      return adminClient.get<FundRequestsResponse>("/api/admin/fund-requests");
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // User info is now included in the API response, no need to fetch separately

  // Fetch project wallet balances
  const projectIds = useMemo(() => {
    if (!fundRequestsData?.fundRequests) return [];
    return [
      ...new Set(
        fundRequestsData.fundRequests.map((r) => r.projectId).filter(Boolean)
      ),
    ];
  }, [fundRequestsData]);

  const [walletMap, setWalletMap] = useState<Map<string, ProjectWallet>>(
    new Map()
  );

  useEffect(() => {
    const fetchWallets = async () => {
      if (projectIds.length === 0) return;
      const wallets = new Map<string, ProjectWallet>();
      for (const projectId of projectIds) {
        try {
          const walletData = await adminClient.get<{ wallet: ProjectWallet }>(
            `/api/admin/project-wallets/${projectId}`
          );
          if (walletData.wallet) {
            wallets.set(projectId, walletData.wallet);
          }
        } catch (error) {
          // If wallet doesn't exist, use defaults
          wallets.set(projectId, { balance: 0 });
        }
      }
      setWalletMap(wallets);
    };
    fetchWallets();
  }, [projectIds]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Calculate date range filter
  const getDateFilter = () => {
    if (dateRange === "all") return null;
    const now = new Date();
    let start = new Date();
    switch (dateRange) {
      case "30d":
        start.setDate(now.getDate() - 30);
        break;
      case "6m":
        start.setMonth(now.getMonth() - 6);
        break;
      case "1y":
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    return start;
  };

  // Filter and sort requests
  const filteredAndSortedRequests = useMemo(() => {
    if (!fundRequestsData?.fundRequests) return [];

    let filtered = [...fundRequestsData.fundRequests];

    // Apply status filters
    filtered = filtered.filter((r) => {
      if (r.status === "pending" && !statusFilters.pending) return false;
      if (r.status === "approved" && !statusFilters.approved) return false;
      if (r.status === "rejected" && !statusFilters.rejected) return false;
      return true;
    });

    // Apply date filter
    const dateFilter = getDateFilter();
    if (dateFilter) {
      filtered = filtered.filter((r) => new Date(r.createdAt) >= dateFilter);
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.projectName.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.status.toLowerCase().includes(searchLower) ||
          formatTimeAgo(r.createdAt).toLowerCase().includes(searchLower) ||
          formatCurrency(r.amount).toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case "member":
            aValue = (
              a.requestedByUser?.name ||
              a.requestedByUser?.email ||
              ""
            ).toLowerCase();
            bValue = (
              b.requestedByUser?.name ||
              b.requestedByUser?.email ||
              ""
            ).toLowerCase();
            break;
          case "details":
            aValue = (a.description || "").toLowerCase();
            bValue = (b.description || "").toLowerCase();
            break;
          case "project":
            aValue = a.projectName.toLowerCase();
            bValue = b.projectName.toLowerCase();
            break;
          case "creditsUsed":
            const aWallet = walletMap.get(a.projectId);
            const bWallet = walletMap.get(b.projectId);
            aValue = aWallet?.balance || 0;
            bValue = bWallet?.balance || 0;
            break;
          case "requested":
            aValue = a.amount;
            bValue = b.amount;
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "createdAt":
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by createdAt desc
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return filtered;
  }, [
    fundRequestsData,
    statusFilters,
    dateRange,
    search,
    sortColumn,
    sortDirection,
    walletMap,
  ]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return adminClient.post(`/api/admin/fund-requests/${requestId}/approve`, {
        reviewComments: reviewComments.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Approved",
        description: "Funds have been transferred to the project",
      });
      setSelectedRequest(null);
      setReviewComments("");
      setActionType(null);
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

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return adminClient.post(`/api/admin/fund-requests/${requestId}/reject`, {
        reviewComments: reviewComments.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/fund-requests"],
      });
      toast({
        title: "Request Rejected",
        description: "Fund request has been rejected",
      });
      setSelectedRequest(null);
      setReviewComments("");
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (request: FundRequest) => {
    setSelectedRequest(request);
    setActionType("approve");
    setReviewComments("");
  };

  const handleReject = (request: FundRequest) => {
    setSelectedRequest(request);
    setActionType("reject");
    setReviewComments("");
  };

  const confirmAction = () => {
    if (!selectedRequest) return;

    if (actionType === "approve") {
      approveMutation.mutate(selectedRequest.id);
    } else if (actionType === "reject") {
      rejectMutation.mutate(selectedRequest.id);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({
    column,
    children,
  }: {
    column: string;
    children: string;
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

  const handleExport = async () => {
    if (!filteredAndSortedRequests.length) return;

    setIsExporting(true);
    try {
      const csvContent = [
        [
          "Member",
          "Details",
          "Project",
          "Credits Used",
          "Requested",
          "Status",
          "Requested Date",
        ],
        ...filteredAndSortedRequests.map((r) => {
          const wallet = walletMap.get(r.projectId);
          return [
            r.requestedByUser?.name ||
              r.requestedByUser?.email ||
              r.requestedBy,
            r.description || "",
            r.projectName,
            wallet
              ? `${formatCurrency(wallet.balance)}/${formatCurrency(
                  wallet.balance + (r.amount || 0)
                )}`
              : "-",
            formatCurrency(r.amount),
            r.status,
            new Date(r.createdAt).toLocaleString(),
          ];
        }),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `credit-refill-requests-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Started",
        description: "Credit refill requests have been exported",
      });
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export requests",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Allow both org_admin and project_admin to view fund requests
  if (!isOrgAdmin && !isProjectAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px] bg-[#0a0a0a]">
          <div className="rounded-[12px] bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="p-6">
              <p className="text-[#525252]">
                You don't have permission to view fund requests. Only
                organization admins and project admins can view fund requests.
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 p-8 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-1">
                Credit Refill Requests
              </h1>
              <p className="text-sm text-[#525252]">
                Wallet / Credit Refill Requests
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || filteredAndSortedRequests.length === 0}
                className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white mb-2 block">
                All Requests
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#525252]" />
                <Input
                  placeholder="Search requests by date, user, or status.."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder:text-[#525252]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              {/* Date Range Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={dateRange === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("all")}
                  className={
                    dateRange === "all"
                      ? "bg-[#7b4cff] text-white border-0"
                      : "bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                  }
                >
                  All
                </Button>
                <Button
                  variant={dateRange === "30d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("30d")}
                  className={
                    dateRange === "30d"
                      ? "bg-[#7b4cff] text-white border-0"
                      : "bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                  }
                >
                  Last 30D
                </Button>
                <Button
                  variant={dateRange === "6m" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("6m")}
                  className={
                    dateRange === "6m"
                      ? "bg-[#7b4cff] text-white border-0"
                      : "bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                  }
                >
                  Last 6M
                </Button>
                <Button
                  variant={dateRange === "1y" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange("1y")}
                  className={
                    dateRange === "1y"
                      ? "bg-[#7b4cff] text-white border-0"
                      : "bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a]"
                  }
                >
                  Last 1Y
                </Button>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#525252]">Filter by status</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pending"
                      checked={statusFilters.pending}
                      onCheckedChange={(checked) =>
                        setStatusFilters({
                          ...statusFilters,
                          pending: checked === true,
                        })
                      }
                      className="border-[#1a1a1a] data-[state=checked]:bg-[#7b4cff] data-[state=checked]:border-[#7b4cff]"
                    />
                    <label
                      htmlFor="pending"
                      className="text-sm text-white cursor-pointer"
                    >
                      Pending
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rejected"
                      checked={statusFilters.rejected}
                      onCheckedChange={(checked) =>
                        setStatusFilters({
                          ...statusFilters,
                          rejected: checked === true,
                        })
                      }
                      className="border-[#1a1a1a] data-[state=checked]:bg-[#7b4cff] data-[state=checked]:border-[#7b4cff]"
                    />
                    <label
                      htmlFor="rejected"
                      className="text-sm text-white cursor-pointer"
                    >
                      Rejected
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="approved"
                      checked={statusFilters.approved}
                      onCheckedChange={(checked) =>
                        setStatusFilters({
                          ...statusFilters,
                          approved: checked === true,
                        })
                      }
                      className="border-[#1a1a1a] data-[state=checked]:bg-[#7b4cff] data-[state=checked]:border-[#7b4cff]"
                    />
                    <label
                      htmlFor="approved"
                      className="text-sm text-white cursor-pointer"
                    >
                      Approved
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-[8px] border border-[#1a1a1a] overflow-x-auto bg-[#0a0a0a]">
            {isLoading ? (
              <div className="text-center py-8 text-[#525252]">
                Loading requests...
              </div>
            ) : filteredAndSortedRequests.length === 0 ? (
              <div className="text-center py-8 text-[#525252]">
                No requests found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#1a1a1a] hover:bg-transparent">
                    <SortableHeader column="member">Member</SortableHeader>
                    <SortableHeader column="details">Details</SortableHeader>
                    <SortableHeader column="project">Project</SortableHeader>
                    <SortableHeader column="creditsUsed">
                      Credits Used
                    </SortableHeader>
                    <SortableHeader column="requested">
                      Requested
                    </SortableHeader>
                    <SortableHeader column="status">Status</SortableHeader>
                    {isOrgAdmin && (
                      <TableHead className="text-[#525252]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRequests.map((request) => {
                    const userInfo = request.requestedByUser;
                    const wallet = walletMap.get(request.projectId);
                    const creditsUsed = wallet?.balance || 0;
                    const creditsTotal = creditsUsed + request.amount;

                    return (
                      <TableRow
                        key={request.id}
                        className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]"
                      >
                        {/* Member */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {userInfo?.image ? (
                                <img
                                  src={userInfo.image}
                                  alt=""
                                  className="h-full w-full rounded-full"
                                />
                              ) : (
                                <AvatarFallback className="bg-[#1a1a1a] text-white text-xs">
                                  {getUserInitials(
                                    userInfo?.name,
                                    userInfo?.email
                                  )}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <div className="text-sm text-white font-medium">
                                {userInfo?.name ||
                                  userInfo?.email ||
                                  "Unknown User"}
                              </div>
                              <div className="text-xs text-[#525252]">
                                {formatTimeAgo(request.createdAt)}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Details */}
                        <TableCell>
                          <div className="text-sm text-white">
                            {request.description || "-"}
                          </div>
                        </TableCell>

                        {/* Project */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-[#1a1a1a] text-white border-[#1a1a1a]"
                          >
                            {request.projectName}
                          </Badge>
                        </TableCell>

                        {/* Credits Used */}
                        <TableCell>
                          <div className="text-sm text-white font-mono">
                            {formatCurrency(creditsUsed)}/
                            {formatCurrency(creditsTotal)}
                          </div>
                        </TableCell>

                        {/* Requested */}
                        <TableCell>
                          <div className="text-sm text-white font-medium">
                            {formatCurrency(request.amount)}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {request.status === "pending" ? (
                            <Badge className="bg-[#eab308]/10 text-[#eab308] border-[#eab308]/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          ) : request.status === "approved" ? (
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions - only show for org_admin */}
                        {isOrgAdmin && (
                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleReject(request)}
                                  disabled={
                                    approveMutation.isPending ||
                                    rejectMutation.isPending
                                  }
                                  className="h-8 w-8 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                  <X className="h-4 w-4 text-red-400" />
                                </button>
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={
                                    approveMutation.isPending ||
                                    rejectMutation.isPending
                                  }
                                  className="h-8 w-8 rounded-full bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-[#525252]">-</div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setReviewComments("");
            setActionType(null);
          }
        }}
      >
        <DialogContent className="bg-[#0a0a0a] border border-[#1a1a1a]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {actionType === "approve"
                ? "Approve Fund Request"
                : "Reject Fund Request"}
            </DialogTitle>
            <DialogDescription className="text-[#525252]">
              {selectedRequest && (
                <>
                  {actionType === "approve"
                    ? `Approve ${formatCurrency(selectedRequest.amount)} for ${
                        selectedRequest.projectName
                      }?`
                    : `Reject ${formatCurrency(
                        selectedRequest.amount
                      )} request from ${selectedRequest.projectName}?`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-[#525252]">Project</Label>
                    <p className="font-medium text-white">
                      {selectedRequest.projectName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#525252]">Amount</Label>
                    <p className="font-medium text-green-400">
                      {formatCurrency(selectedRequest.amount)}
                    </p>
                  </div>
                </div>
                {selectedRequest.description && (
                  <div>
                    <Label className="text-xs text-[#525252]">
                      Description
                    </Label>
                    <p className="text-sm text-white">
                      {selectedRequest.description}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="review-comments" className="text-white">
                Review Comments (Optional)
              </Label>
              <Textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add any comments about this decision..."
                rows={3}
                className="mt-2 bg-[#1a1a1a] border-[#1a1a1a] text-white placeholder:text-[#525252] focus:border-[#7b4cff] focus:ring-[#7b4cff]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#1a1a1a] bg-transparent text-white hover:bg-[#1a1a1a] hover:border-[#555558]"
              onClick={() => {
                setSelectedRequest(null);
                setReviewComments("");
                setActionType(null);
              }}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className={
                actionType === "reject"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[#7b4cff] hover:bg-[#8c63f2] text-white"
              }
            >
              {approveMutation.isPending || rejectMutation.isPending
                ? "Processing..."
                : actionType === "approve"
                ? "Approve"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
