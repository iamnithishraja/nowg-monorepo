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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Transaction, TransactionsResponse } from "./types";
import { formatDate, formatCurrency } from "./utils";
import { Pagination } from "./Pagination";

interface TransactionHistoryTableProps {
  data: TransactionsResponse | undefined;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function TransactionHistoryTable({
  data,
  isLoading,
  currentPage,
  onPageChange,
}: TransactionHistoryTableProps) {
  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Payment Transactions
        </CardTitle>
        <CardDescription>
          View external payment gateway transactions (Stripe payments only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <>
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
                    <TransactionRow
                      key={transaction.id || idx}
                      transaction={transaction}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                hasMore={pagination.hasMore}
                onPrevious={() => onPageChange(currentPage - 1)}
                onNext={() => onPageChange(currentPage + 1)}
              />
            )}
          </>
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
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <TableRow>
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
            variant={transaction.type === "credit" ? "default" : "destructive"}
            className="capitalize"
          >
            {transaction.type}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="font-mono">
        <span
          className={
            transaction.type === "credit" ? "text-green-600" : "text-red-600"
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
  );
}
