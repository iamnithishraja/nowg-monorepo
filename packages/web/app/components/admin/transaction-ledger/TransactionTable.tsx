import { BookOpen, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "../../ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../../ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../ui/table";
import type { LedgerResponse } from "./index";
import { TransactionRow } from "./TransactionRow";

interface TransactionTableProps {
  data: LedgerResponse | undefined;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function TransactionTable({
  data,
  isLoading,
  currentPage,
  onPageChange,
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardHeader className="border-b border-subtle px-5 py-3">
          <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Transactions</CardTitle>
          <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">Loading recent activity</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-[8px] border border-subtle bg-surface-2/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-subtle">
                  <TableHead className="text-secondary">Date</TableHead>
                  <TableHead className="text-secondary">Wallet Type</TableHead>
                  <TableHead className="text-secondary">Amount</TableHead>
                  <TableHead className="text-secondary">Balance</TableHead>
                  <TableHead className="text-secondary">From</TableHead>
                  <TableHead className="text-secondary">To</TableHead>
                  <TableHead className="text-secondary">Context</TableHead>
                  <TableHead className="text-secondary">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(6)].map((_, i) => (
                  <TableRow key={i} className="border-b border-subtle">
                    {[...Array(8)].map((__, j) => (
                      <TableCell key={j} className="py-3">
                        <div className="h-4 w-full rounded bg-surface-2 animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.transactions || data.transactions.length === 0) {
    return (
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardHeader className="border-b border-subtle px-5 py-3">
          <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-tertiary mb-4 opacity-50" />
            <p className="text-secondary font-medium mb-2">
              No transactions found
            </p>
            <p className="text-[13px] text-tertiary tracking-[-0.26px]">
              Try adjusting your filters to see more results
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { transactions, pagination } = data;

  return (
    <Card className="bg-surface-1 border border-subtle rounded-[12px]">
      <CardHeader className="border-b border-subtle px-5 py-3">
        <CardTitle className="text-[14px] font-medium text-primary tracking-[-0.28px]">Transaction Ledger</CardTitle>
        <CardDescription className="text-[13px] text-secondary tracking-[-0.26px]">
          Showing {transactions.length} of {pagination.total} transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-[8px] border border-subtle bg-surface-2/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-subtle">
                <TableHead className="text-secondary">Date</TableHead>
                <TableHead className="text-secondary">Wallet Type</TableHead>
                <TableHead className="text-secondary">Amount</TableHead>
                <TableHead className="text-secondary">Balance</TableHead>
                <TableHead className="text-secondary">From</TableHead>
                <TableHead className="text-secondary">To</TableHead>
                <TableHead className="text-secondary">Context</TableHead>
                <TableHead className="text-secondary">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-[13px] text-secondary tracking-[-0.26px]">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={pagination.page <= 1}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
            >
              <CaretLeft className="h-4 w-4" weight="bold" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!pagination.hasMore}
              className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558]"
            >
              Next
              <CaretRight className="h-4 w-4" weight="bold" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
