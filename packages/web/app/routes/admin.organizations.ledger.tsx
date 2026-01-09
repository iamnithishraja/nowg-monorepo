import {
  BookOpen,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
  Building2,
  FolderKanban,
  User,
  Zap,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  Globe,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { ArrowRight } from "lucide-react";
import {
    type LedgerTransaction,
} from "~/components/admin/transaction-ledger";
import { AdminLayout } from "~/components/AdminLayout";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
    Table,
    TableBody,
  TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { useToast } from "~/hooks/use-toast";
import { useAuth } from "~/hooks/useAuth";
import { useOrganization } from "~/hooks/useDashboard";
import { adminClient } from "~/lib/adminClient";
import { getAdminSession } from "~/lib/adminMiddleware";
import { UserRole } from "~/lib/types/roles";
import { useQuery } from "@tanstack/react-query";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getAdminSession(request);

  if (!user) {
    throw redirect("/");
  }

  // Only org_admin can access this page
  const isOrgAdmin = user.role === UserRole.ORG_ADMIN;

  if (!isOrgAdmin) {
    throw redirect("/admin");
  }

  return { user };
}

export function meta() {
  return [
    { title: "Transaction Ledger - Organization - Nowgai" },
    { name: "description", content: "Organization transaction ledger" },
  ];
}

export default function OrgLedgerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOrgAdmin = (user as any)?.role === UserRole.ORG_ADMIN;

  // Get organization for org_admin
  const { data: orgsData } = useOrganization(isOrgAdmin);
  const organization = orgsData?.organizations?.[0];

  // Transaction filters
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRange, setDateRange] = useState("all"); // "all", "30d", "6m", "1y"
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Data states
  const [ledgerData, setLedgerData] = useState<{
    transactions: LedgerTransaction[];
    pagination: any;
  } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch fund requests for the organization (all statuses)
  const { data: fundRequestsData } = useQuery<{
    fundRequests: Array<{
      id: string;
      status: "pending" | "approved" | "rejected";
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/admin/fund-requests", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { fundRequests: [] };
      return adminClient.get<{ fundRequests: any[] }>(
        "/api/admin/fund-requests",
        {
          params: {
            organizationId: organization.id,
            // Don't filter by status - get all requests
          },
        }
      );
    },
    enabled: !!organization?.id,
  });

  // Calculate approved and rejected fund requests (overall)
  const { approvedCount, rejectedCount } = useMemo(() => {
    if (!fundRequestsData?.fundRequests) {
      return { approvedCount: 0, rejectedCount: 0 };
    }

    const approved = fundRequestsData.fundRequests.filter(
      (req) => req.status === "approved"
    ).length;
    const rejected = fundRequestsData.fundRequests.filter(
      (req) => req.status === "rejected"
    ).length;

    return { approvedCount: approved, rejectedCount: rejected };
  }, [fundRequestsData]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Calculate date range based on selection
  useEffect(() => {
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
      default:
        start = new Date(0); // All time
    }

    if (dateRange !== "all") {
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [dateRange]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!organization?.id) return;
      try {
        const walletData = await adminClient.get<{
          wallet: { balance: number };
        }>(`/api/admin/org-wallets/${organization.id}`);
        setWalletBalance(walletData.wallet.balance);
      } catch (error) {
        console.error("Failed to fetch wallet balance:", error);
      }
    };
    fetchWalletBalance();
  }, [organization?.id]);

  // Fetch transactions (all credits for organization)
  useEffect(() => {
    const fetchLedger = async () => {
      if (!organization?.id) return;

      setLedgerLoading(true);
      try {
        // Fetch all credit transactions from ledger endpoint
        const ledgerData = await adminClient.get<{
          transactions: any[];
          pagination: any;
        }>(`/api/admin/org-wallets/${organization.id}/ledger`, {
          params: { page: currentPage, limit: 50 },
        });

        // Get all transactions (credits and debits) and map to ledger format
        // This includes Stripe payments (credits) and project transfers (debits)
        const allTransactions = ledgerData.transactions.map((t: any) => ({
            id: t.id || `txn-${t.createdAt}`,
            walletType: "organization" as const,
            walletId: organization.id,
          transactionType: (t.type === "credit" ? "credit" : "debit") as
            | "credit"
            | "debit",
            amount: t.amount,
            balanceBefore: t.balanceBefore,
            balanceAfter: t.balanceAfter,
            description: t.description || "",
            performedBy: t.performedBy || "",
            createdAt: new Date(t.createdAt).toISOString(),
            organizationId: organization.id,
            organizationName: organization.name,
            stripePaymentId: t.stripePaymentId,
            fromAddress: t.fromAddress || null,
            fromAddressType: t.fromAddressType || null,
            fromAddressName: t.fromAddressName || null,
            toAddress: t.toAddress || null,
            toAddressType: t.toAddressType || null,
            toAddressName: t.toAddressName || null,
          }));

        // Apply filters
        let filtered = allTransactions;

        if (search) {
          filtered = filtered.filter(
            (t) =>
              t.description.toLowerCase().includes(search.toLowerCase()) ||
              (t.stripePaymentId &&
                t.stripePaymentId
                  .toLowerCase()
                  .includes(search.toLowerCase())) ||
              t.amount.toString().includes(search) ||
              new Date(t.createdAt).toLocaleDateString().includes(search)
          );
        }

        if (startDate) {
          const start = new Date(startDate);
          filtered = filtered.filter((t) => new Date(t.createdAt) >= start);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter((t) => new Date(t.createdAt) <= end);
        }

        // Use pagination from API, but apply filters client-side
        // Note: For better performance, filters should be server-side
        setLedgerData({
          transactions: filtered,
          pagination: ledgerData.pagination,
        });
      } catch (error) {
        console.error("Failed to fetch ledger:", error);
        toast({
          title: "Error",
          description: "Failed to load transaction ledger",
          variant: "destructive",
        });
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [
    organization?.id,
    currentPage,
    search,
    startDate,
    endDate,
    toast,
  ]);

  // Format date for display (matches image format: "Dec 17 7:35 PM")
  const formatTransactionDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort transactions
  const sortedTransactions = ledgerData?.transactions
    ? [...ledgerData.transactions].sort((a, b) => {
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
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      })
    : [];

  // Sortable header component
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

  // Calculate summary stats
  const totalUnusedCredits = walletBalance;

  const lastTransaction = ledgerData?.transactions[0];

  // Get wallet icon based on type
  const getWalletIcon = (type: string | null | undefined) => {
    switch (type) {
      case "organization":
        return <Building2 className="h-4 w-4" />;
      case "project":
        return <FolderKanban className="h-4 w-4" />;
      case "user_project":
        return <User className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  // Handle Export
  const handleExport = async () => {
    if (!ledgerData || !organization) return;

    setIsExporting(true);
    try {
        const csvContent = [
        [
          "Date",
          "From",
          "To",
          "Transaction Information",
          "Amount",
          "Balance Before",
          "Balance After",
        ],
        ...sortedTransactions.map((t) => {
          const fromName = t.fromAddressType === "organization"
            ? t.fromAddressName || t.organizationName || "Org Wallet"
            : t.fromAddressType === "project"
            ? t.fromAddressName || "Project Wallet"
            : t.fromAddressName || "User Wallet" || "—";
          
          const toName = t.toAddressType === "organization"
            ? t.toAddressName || t.organizationName || "Org Wallet"
            : t.toAddressType === "project"
            ? t.toAddressName || "Project Wallet"
            : t.toAddressType === "user_project"
            ? t.toAddressName || "User Wallet"
            : t.transactionType === "debit" && !t.toAddressType
            ? "LLM Engine"
            : "—";
          
          return [
            formatTransactionDate(t.createdAt),
            t.fromAddressType ? fromName : "—",
            toName,
            t.description || "",
            `${t.transactionType === "credit" ? "+" : "-"}${formatCurrency(
              t.amount
            )}`,
            formatCurrency(t.balanceBefore),
            formatCurrency(t.balanceAfter),
          ];
        }),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wallet-transactions-${organization.name}-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Started",
        description: "Wallet transactions have been exported",
      });
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export transactions",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!organization) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-tertiary">Loading organization...</p>
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
                Wallet Transactions
              </h1>
              <p className="text-sm text-[#525252]">
                Track detailed flow of credits across project and user wallets.
              </p>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Unused Credits */}
            <Card className="bg-[#0a0a0a] border-[#1a1a1a]">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1a1a1a] rounded-full">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#525252] mb-1">
                      Total Unused Credits
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(Math.max(0, totalUnusedCredits))}
                    </p>
                    <p className="text-xs text-[#525252] mt-1">
                      available in {ledgerData?.pagination?.total || 0} Wallets
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Last Transaction */}
            <Card className="bg-[#0a0a0a] border-[#1a1a1a]">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1a1a1a] rounded-full">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#525252] mb-1">
                      Last Transaction
                    </p>
                    {lastTransaction ? (
                      <>
                        <p
                          className={`text-2xl font-bold ${
                            lastTransaction.transactionType === "credit"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {lastTransaction.transactionType === "credit"
                            ? "+"
                            : "-"}
                          {formatCurrency(lastTransaction.amount)}
                        </p>
                        <p className="text-xs text-[#525252] mt-1">
                          {formatTransactionDate(lastTransaction.createdAt)} •{" "}
                          {lastTransaction.description}
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-[#525252]">
                        No transactions
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Credit Refill Requests */}
            <Card className="bg-[#0a0a0a] border-[#1a1a1a]">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1a1a1a] rounded-full">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#525252] mb-1">
                      Credit Refill Requests
                    </p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-green-500">
                          {approvedCount}
                        </p>
                        <p className="text-xs text-[#525252] mt-1">Approved</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-500">
                          {rejectedCount}
                        </p>
                        <p className="text-xs text-[#525252] mt-1">Rejected</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Transactions Section */}
          <Card className="bg-[#0a0a0a] border-[#1a1a1a]">
            <CardHeader className="border-b border-[#1a1a1a]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">All Transactions</CardTitle>
            <Button
              variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={
                    isExporting ||
                    !ledgerData ||
                    sortedTransactions.length === 0
                  }
                  className="bg-transparent border-[#1a1a1a] text-white hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Search and Filters */}
              <div className="mb-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#525252]" />
                  <Input
                    placeholder="Search transactions by date, amount, or type.."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10 bg-[#0a0a0a] border-[#1a1a1a] text-white placeholder:text-[#525252]"
                  />
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

                </div>
              </div>

          {/* Transaction Table */}
          {ledgerLoading ? (
                <div className="text-center py-8 text-[#525252]">
                  Loading transactions...
                </div>
              ) : !ledgerData || sortedTransactions.length === 0 ? (
                <div className="text-center py-8 text-[#525252]">
                    No transactions found
                </div>
              ) : (
                <>
                  <div className="rounded-[8px] border border-[#1a1a1a] overflow-x-auto">
                  <Table>
                    <TableHeader>
                        <TableRow className="border-b border-[#1a1a1a] hover:bg-transparent">
                          <SortableHeader column="date">Date</SortableHeader>
                          <TableHead className="text-[#525252]">From → To</TableHead>
                          <TableHead className="text-[#525252]">
                            Transaction Information
                          </TableHead>
                          <SortableHeader column="amount">
                            Amount
                          </SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTransactions.map((transaction) => {
                          return (
                            <TableRow
                          key={transaction.id}
                              className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]"
                            >
                              {/* Date */}
                              <TableCell className="text-white font-mono text-sm">
                                {formatTransactionDate(transaction.createdAt)}
                              </TableCell>

                              {/* From → To */}
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-white min-w-0 flex-1">
                                    {transaction.fromAddressType ? (
                                      <>
                                        {getWalletIcon(transaction.fromAddressType)}
                                        <span className="text-xs truncate">
                                          {transaction.fromAddressType === "organization"
                                            ? transaction.fromAddressName || transaction.organizationName || "Org Wallet"
                                            : transaction.fromAddressType === "project"
                                            ? transaction.fromAddressName || "Project Wallet"
                                            : transaction.fromAddressName || "User Wallet"}
                                        </span>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-[#525252]">
                                        <Globe className="h-4 w-4" />
                                        <span className="text-xs">External</span>
                                      </div>
                                    )}
                                  </div>
                                  {(transaction.fromAddressType || transaction.toAddressType) && (
                                    <ArrowRight className="h-3.5 w-3.5 text-[#7b4cff] flex-shrink-0 mx-0.5" />
                                  )}
                                  <div className="flex items-center gap-1.5 text-white min-w-0 flex-1">
                                    {transaction.toAddressType ? (
                                      <>
                                        {getWalletIcon(transaction.toAddressType)}
                                        <span className="text-xs truncate">
                                          {transaction.toAddressType === "organization"
                                            ? transaction.toAddressName || transaction.organizationName || "Org Wallet"
                                            : transaction.toAddressType === "project"
                                            ? transaction.toAddressName || "Project Wallet"
                                            : transaction.toAddressName || "User Wallet"}
                                        </span>
                                      </>
                                    ) : transaction.transactionType === "debit" && !transaction.toAddressType ? (
                                      <div className="flex items-center gap-1.5 text-[#7b4cff]">
                                        <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="text-xs">LLM Engine</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Transaction Information */}
                              <TableCell>
                                <div className="text-sm text-white">
                                  {transaction.description || "Transaction"}
                                </div>
                              </TableCell>

                              {/* Amount */}
                              <TableCell>
                                <div className="flex flex-col">
                                  <span
                                    className={`font-mono text-sm ${
                                      transaction.transactionType === "credit"
                                        ? "text-green-500"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {transaction.transactionType === "credit"
                                      ? "+"
                                      : "-"}
                                    {formatCurrency(transaction.amount)}
                                  </span>
                                  <span className="text-xs text-[#525252] font-mono">
                                    {formatCurrency(transaction.balanceBefore)}{" "}
                                    → {formatCurrency(transaction.balanceAfter)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>

                  {/* Pagination Footer */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-[#525252]">
                      Showing {sortedTransactions.length} of{" "}
                      {ledgerData.pagination.total} results.
                    </div>
                    {ledgerData.pagination.hasMore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="text-[#7b4cff] hover:text-[#8b5cf6] hover:bg-transparent"
                      >
                        Load 50 more
                      </Button>
                    )}
                  </div>
                </>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
