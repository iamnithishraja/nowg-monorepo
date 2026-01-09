import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
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
import { useToast } from "@/hooks/use-toast";
import { client } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/roles";
import { useOrganization } from "@/components/dashboard/hooks";
import { TransactionRow } from "@/components/transaction-ledger/TransactionRow";
import { LedgerTransaction } from "@/components/transaction-ledger/types";

interface LedgerTransactionResponse {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: string;
  stripePaymentId?: string;
  relatedOrgWalletTransactionId?: string;
  fromAddress?: string | null;
  fromAddressType?: "organization" | "project" | "user_project" | null;
  fromAddressName?: string | null;
  toAddress?: string | null;
  toAddressType?: "organization" | "project" | "user_project" | null;
  toAddressName?: string | null;
  createdAt: string;
}

interface LedgerResponse {
  transactions: LedgerTransactionResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function OrganizationsLedgerPage() {
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch transactions - org wallet ledger for org_admin only
  const {
    data: ledgerData,
    isLoading: ledgerLoading,
    refetch,
  } = useQuery<LedgerResponse>({
    queryKey: [
      "/api/admin/org-wallets/:organizationId/ledger",
      organization?.id,
      currentPage,
    ],
    queryFn: () => {
      if (organization?.id) {
        return client.get<LedgerResponse>(
          `/api/admin/org-wallets/${organization.id}/ledger`,
          {
            params: { page: currentPage, limit: 50 },
          }
        );
      }
      throw new Error("No organization selected");
    },
    enabled: isOrgAdmin && !!organization?.id,
  });

  // Apply client-side filters
  const filteredTransactions =
    ledgerData?.transactions.filter((t: LedgerTransactionResponse) => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !t.description.toLowerCase().includes(searchLower) &&
          !(
            t.stripePaymentId &&
            t.stripePaymentId.toLowerCase().includes(searchLower)
          )
        ) {
          return false;
        }
      }
      if (startDate) {
        const start = new Date(startDate);
        if (new Date(t.createdAt) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.createdAt) > end) return false;
      }
      return true;
    }) || [];

  // Show loading if waiting for organization
  if (isOrgAdmin && !organization) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  // Map to LedgerTransaction format for TransactionRow component
  const mappedTransactions: LedgerTransaction[] = filteredTransactions.map(
    (t: LedgerTransactionResponse) => {
      if (organization) {
        return {
          id: t.id,
          walletType: "organization" as const,
          walletId: organization.id,
          transactionType: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          performedBy: t.performedBy,
          createdAt: t.createdAt,
          organizationId: organization.id,
          organizationName: organization.name,
          stripePaymentId: t.stripePaymentId,
          fromAddress: t.fromAddress || null,
          fromAddressType: t.fromAddressType || null,
          fromAddressName: t.fromAddressName || null,
          toAddress: t.toAddress || null,
          toAddressType: t.toAddressType || null,
          toAddressName: t.toAddressName || null,
        };
      } else {
        // Fallback (should not happen due to early return, but TypeScript needs this)
        throw new Error("Organization not found");
      }
    }
  );

  return (
    <div className="flex-1 p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Transaction Ledger
            </h1>
            <p className="text-muted-foreground mt-1">
              All wallet transactions for {organization?.name || "organization"} - including
              payments, transfers, refunds, and deductions
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search transactions..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[150px]"
                  placeholder="Start Date"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[150px]"
                  placeholder="End Date"
                />
              </div>
              {(searchInput || startDate || endDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStartDate("");
                    setEndDate("");
                    setCurrentPage(1);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction Table */}
        {ledgerLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                Loading transactions...
              </div>
            </CardContent>
          </Card>
        ) : mappedTransactions.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">
                  No transactions found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters to see more results
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Transaction Ledger</CardTitle>
              <CardDescription>
                Showing {mappedTransactions.length} of{" "}
                {ledgerData?.pagination.total || 0} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Context</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedTransactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {ledgerData?.pagination &&
                ledgerData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {ledgerData.pagination.page} of{" "}
                      {ledgerData.pagination.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(
                            Math.min(
                              ledgerData.pagination.totalPages,
                              currentPage + 1
                            )
                          )
                        }
                        disabled={
                          currentPage >= ledgerData.pagination.totalPages
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
