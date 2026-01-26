import {
    BalanceFilters,
    BalanceSummary,
    BalanceTable,
    TransactionFilters,
    TransactionSummary,
    TransactionTable,
    WalletSummaryCards,
    type FilterOrganization,
    type FilterProject,
    type LedgerResponse,
    type UserBalancesResponse,
    type WalletSummaryResponse,
} from "@/components/transaction-ledger";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { client } from "@/lib/client";
import { UserRole } from "@nowgai/shared/types";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function TransactionLedgerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("transactions");
  const [isDownloading, setIsDownloading] = useState(false);

  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.TECH_SUPPORT;
  const isOrgAdmin = user?.role === UserRole.ORG_ADMIN;
  const isProjectAdmin =
    user?.role === UserRole.PROJECT_ADMIN ||
    (user as any)?.hasProjectAdminAccess === true;

  // Redirect org_admin and project_admin to their scoped ledger pages
  useEffect(() => {
    if (isOrgAdmin) {
      setLocation("/admin/organizations/ledger");
      return;
    }
    if (isProjectAdmin && !isOrgAdmin) {
      setLocation("/admin/projects/ledger");
      return;
    }
  }, [isOrgAdmin, isProjectAdmin, setLocation]);

  // Don't render anything if redirecting
  if (isOrgAdmin || (isProjectAdmin && !isOrgAdmin)) {
    return null;
  }

  // Transaction filters
  const [currentPage, setCurrentPage] = useState(1);
  const [walletType, setWalletType] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [whitelisted, setWhitelisted] = useState(false); // Default: exclude whitelisted transactions

  // User balances filters
  const [balancesPage, setBalancesPage] = useState(1);
  const [balanceOrgId, setBalanceOrgId] = useState("");
  const [balanceProjectId, setBalanceProjectId] = useState("");
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceSearchInput, setBalanceSearchInput] = useState("");
  const [balanceSortBy, setBalanceSortBy] = useState("balance");
  const [balanceSortOrder, setBalanceSortOrder] = useState("desc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBalanceSearch(balanceSearchInput);
      setBalancesPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [balanceSearchInput]);

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery<{
    organizations: FilterOrganization[];
  }>({
    queryKey: ["/api/admin/ledger/organizations"],
    queryFn: () => client.get("/api/admin/ledger/organizations"),
  });

  // Fetch projects for filter
  const { data: projectsData } = useQuery<{ projects: FilterProject[] }>({
    queryKey: ["/api/admin/ledger/projects", organizationId],
    queryFn: () =>
      client.get("/api/admin/ledger/projects", {
        params: organizationId ? { organizationId } : {},
      }),
  });

  // Fetch wallet summary
  const { data: summaryData, isLoading: summaryLoading } =
    useQuery<WalletSummaryResponse>({
      queryKey: ["/api/admin/ledger/summary"],
      queryFn: () => client.get("/api/admin/ledger/summary"),
    });

  // Fetch transactions
  const {
    data: ledgerData,
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = useQuery<LedgerResponse>({
    queryKey: [
      "/api/admin/ledger",
      currentPage,
      walletType,
      transactionType,
      organizationId,
      projectId,
      search,
      startDate,
      endDate,
      whitelisted,
    ],
    queryFn: () => {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: 50,
      };
      if (walletType !== "all") params.walletType = walletType;
      if (transactionType !== "all") params.transactionType = transactionType;
      if (organizationId) params.organizationId = organizationId;
      if (projectId) params.projectId = projectId;
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      // Always send whitelisted parameter (defaults to false on server if not "true")
      params.whitelisted = whitelisted ? "true" : "false";

      return client.get("/api/admin/ledger", { params });
    },
  });

  // Fetch user balances
  const {
    data: balancesData,
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = useQuery<UserBalancesResponse>({
    queryKey: [
      "/api/admin/ledger/user-balances",
      balancesPage,
      balanceOrgId,
      balanceProjectId,
      balanceSearch,
      balanceSortBy,
      balanceSortOrder,
    ],
    queryFn: () => {
      const params: Record<string, string | number> = {
        page: balancesPage,
        limit: 50,
        sortBy: balanceSortBy,
        sortOrder: balanceSortOrder,
      };
      if (balanceOrgId) params.organizationId = balanceOrgId;
      if (balanceProjectId) params.projectId = balanceProjectId;
      if (balanceSearch) params.search = balanceSearch;

      return client.get("/api/admin/ledger/user-balances", { params });
    },
    enabled: activeTab === "balances",
  });

  const clearAllFilters = () => {
    setWalletType("all");
    setTransactionType("all");
    setOrganizationId("");
    setProjectId("");
    setSearchInput("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setWhitelisted(false); // Reset to default (exclude whitelisted)
    setCurrentPage(1);
  };

  const handleDownloadPDF = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can download ledger PDFs",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    try {
      const params: Record<string, string | number> = {};
      if (walletType !== "all") params.walletType = walletType;
      if (transactionType !== "all") params.transactionType = transactionType;
      if (organizationId) params.organizationId = organizationId;
      if (projectId) params.projectId = projectId;
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      // Always send whitelisted parameter (defaults to false on server if not "true")
      params.whitelisted = whitelisted ? "true" : "false";

      const response = await client.get("/api/admin/ledger/download-pdf", {
        params,
        responseType: "blob",
      });

      // Create blob and download
      const blob = new Blob([response as BlobPart], {
        type: "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `ledger-${new Date().toISOString().split("T")[0]}.pdf`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Ledger PDF download has started",
      });
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Universal Transaction Ledger
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all wallet transactions across organizations, projects, and
            users
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download PDF"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchLedger();
              refetchBalances();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Wallet Summary Cards */}
      {!summaryLoading && summaryData && (
        <WalletSummaryCards data={summaryData} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="transactions">Transaction Ledger</TabsTrigger>
          <TabsTrigger value="balances">User Balances</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <TransactionFilters
            walletType={walletType}
            transactionType={transactionType}
            organizationId={organizationId}
            projectId={projectId}
            searchInput={searchInput}
            startDate={startDate}
            endDate={endDate}
            whitelisted={whitelisted}
            organizations={organizationsData?.organizations}
            projects={projectsData?.projects}
            onWalletTypeChange={(v) => {
              setWalletType(v);
              setCurrentPage(1);
            }}
            onTransactionTypeChange={(v) => {
              setTransactionType(v);
              setCurrentPage(1);
            }}
            onOrganizationChange={(v) => {
              setOrganizationId(v);
              setProjectId("");
              setCurrentPage(1);
            }}
            onProjectChange={(v) => {
              setProjectId(v);
              setCurrentPage(1);
            }}
            onSearchChange={setSearchInput}
            onStartDateChange={(v) => {
              setStartDate(v);
              setCurrentPage(1);
            }}
            onEndDateChange={(v) => {
              setEndDate(v);
              setCurrentPage(1);
            }}
            onWhitelistedChange={(v) => {
              setWhitelisted(v);
              setCurrentPage(1);
            }}
            onClearFilters={clearAllFilters}
          />

          {ledgerData?.summary && (
            <TransactionSummary summary={ledgerData.summary} />
          )}

          <TransactionTable
            data={ledgerData}
            isLoading={ledgerLoading}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        {/* User Balances Tab */}
        <TabsContent value="balances" className="space-y-4 mt-4">
          {balancesData?.summary && (
            <BalanceSummary summary={balancesData.summary} />
          )}

          <BalanceFilters
            searchInput={balanceSearchInput}
            organizationId={balanceOrgId}
            sortBy={balanceSortBy}
            sortOrder={balanceSortOrder}
            organizations={organizationsData?.organizations}
            onSearchChange={setBalanceSearchInput}
            onOrganizationChange={(v) => {
              setBalanceOrgId(v);
              setBalanceProjectId("");
              setBalancesPage(1);
            }}
            onSortByChange={(v) => {
              setBalanceSortBy(v);
              setBalancesPage(1);
            }}
            onSortOrderChange={(v) => {
              setBalanceSortOrder(v);
              setBalancesPage(1);
            }}
          />

          <BalanceTable
            data={balancesData}
            isLoading={balancesLoading}
            currentPage={balancesPage}
            onPageChange={setBalancesPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
