import { User } from "lucide-react";
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
import { UserBalancesResponse } from "./types";
import { BalanceRow } from "./BalanceRow";
import { Pagination } from "./Pagination";

interface BalanceTableProps {
  data: UserBalancesResponse | undefined;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function BalanceTable({
  data,
  isLoading,
  currentPage,
  onPageChange,
}: BalanceTableProps) {
  const balances = data?.wallets || [];
  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Balances by Project</CardTitle>
        <CardDescription>
          {pagination
            ? `Showing ${balances.length} of ${pagination.total} user wallets`
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
        ) : balances.length > 0 ? (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead>Last Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((wallet) => (
                    <BalanceRow key={wallet.id} wallet={wallet} />
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
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No user wallets found</p>
            <p className="text-sm">
              Users will appear here when they have project wallets
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

