import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
    TransactionFilters,
    TransactionSummary,
    TransactionTable,
    WalletSummaryCards,
    type FilterOrganization,
    type FilterProject,
    type LedgerResponse,
    type WalletSummaryResponse,
} from "~/components/admin/transaction-ledger";
import { AdminLayout } from "~/components/AdminLayout";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/hooks/use-toast";
import { adminClient } from "~/lib/adminClient";
import { auth } from "~/lib/auth";
import { hasAdminAccess } from "~/lib/types/roles";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  // Only full admins (ADMIN or TECH_SUPPORT) can access transaction ledger
  const userRole = (session.user as any)?.role;
  const isFullAdmin = hasAdminAccess(userRole);

  if (!isFullAdmin) {
    throw redirect("/admin");
  }

  return { user: session.user };
}

export function meta() {
  return [
    { title: "Transaction Ledger - Admin - Nowgai" },
    { name: "description", content: "Transaction ledger dashboard" },
  ];
}

export default function TransactionLedgerPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("transactions");
  const [isDownloading, setIsDownloading] = useState(false);

  // This route is already protected in loader, so user is guaranteed to be full admin
  const isAdmin = true;

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery<{
    organizations: FilterOrganization[];
  }>({
    queryKey: ["/api/admin/ledger/organizations"],
    queryFn: () => adminClient.get("/api/admin/ledger/organizations"),
  });

  // Fetch projects for filter
  const { data: projectsData } = useQuery<{ projects: FilterProject[] }>({
    queryKey: ["/api/admin/ledger/projects", organizationId],
    queryFn: () =>
      adminClient.get("/api/admin/ledger/projects", {
        params: organizationId ? { organizationId } : {},
      }),
  });

  // Fetch wallet summary
  const { data: summaryData, isLoading: summaryLoading } =
    useQuery<WalletSummaryResponse>({
      queryKey: ["/api/admin/ledger/summary"],
      queryFn: () => adminClient.get("/api/admin/ledger/summary"),
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

      return adminClient.get("/api/admin/ledger", { params });
    },
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

      const response = await fetch(
        `/api/admin/ledger/download-pdf?${new URLSearchParams(
          params as Record<string, string>
        ).toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
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
      }
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
    <AdminLayout>
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-[6px] accent-primary/10">
                <BookOpen className="h-6 w-6 text-[#7b4cff]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-primary">
                  Universal Transaction Ledger
                </h1>
                <p className="text-secondary text-sm mt-0.5">
                  Track all wallet transactions across organizations, projects,
                  and users
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="accent-primary hover:bg-[#8c63f2] text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isDownloading ? "Downloading..." : "Download PDF"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLedger()}
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
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
              <TabsTrigger value="balances" disabled>
                User Balances (Coming Soon)
              </TabsTrigger>
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
                onClearFilters={clearAllFilters}
              />

              {ledgerData?.summary && (
                <TransactionSummary summary={ledgerData.summary} />
              )}

              <TransactionTable
                data={ledgerData || undefined}
                isLoading={ledgerLoading}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}
