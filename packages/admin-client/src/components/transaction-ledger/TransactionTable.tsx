import { BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LedgerTransaction, LedgerResponse } from "./types";
import { TransactionRow } from "./TransactionRow";
import { Pagination } from "./Pagination";

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
  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          {pagination
            ? `Showing ${transactions.length} of ${pagination.total} transactions`
            : "Loading..."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-muted rounded animate-pulse"
              />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>From Address</TableHead>
                    <TableHead>To Address</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn, idx) => (
                    <TransactionRow key={txn.id || idx} transaction={txn} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {pagination && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                hasMore={pagination.hasMore}
                onPrevious={() => onPageChange(Math.max(1, currentPage - 1))}
                onNext={() => onPageChange(currentPage + 1)}
              />
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

