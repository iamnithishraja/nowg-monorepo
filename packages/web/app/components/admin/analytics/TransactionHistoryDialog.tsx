import {
  ArrowCircleDown,
  ArrowCircleUp,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  Receipt,
} from "@phosphor-icons/react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface TransactionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  transactions: Transaction[];
  isLoading: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  onPageChange: (page: number) => void;
}

export function TransactionHistoryDialog({
  open,
  onOpenChange,
  projectName,
  transactions,
  isLoading,
  pagination,
  onPageChange,
}: TransactionHistoryDialogProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface-1 border-subtle p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-subtle/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 flex items-center justify-center">
              <ClockCounterClockwise className="h-5 w-5 text-sky-400" weight="fill" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-primary">
                Transaction History
              </DialogTitle>
              <p className="text-sm text-tertiary mt-0.5">{projectName}</p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin mb-3" />
              <p className="text-sm text-tertiary">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                <Receipt className="h-7 w-7 text-tertiary" />
              </div>
              <p className="text-sm font-medium text-secondary mb-1">No transactions yet</p>
              <p className="text-xs text-tertiary max-w-[220px]">
                Transactions will appear here once credits are transferred or used
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-subtle bg-surface-2 hover:bg-surface-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        tx.type === "credit"
                          ? "bg-emerald-500/10"
                          : "bg-rose-500/10"
                      }`}
                    >
                      {tx.type === "credit" ? (
                        <ArrowCircleDown className="h-5 w-5 text-emerald-400" weight="fill" />
                      ) : (
                        <ArrowCircleUp className="h-5 w-5 text-rose-400" weight="fill" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {tx.description || (tx.type === "credit" ? "Credit" : "Debit")}
                      </p>
                      <p className="text-xs text-tertiary mt-0.5">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-base font-bold ${
                        tx.type === "credit" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.type === "credit" ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-tertiary mt-0.5">
                      Balance: ${tx.balanceAfter.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-subtle bg-surface-2 flex items-center justify-between">
            <p className="text-xs text-tertiary">
              Page {pagination.page} of {pagination.totalPages}
              <span className="text-tertiary/60 ml-1">
                ({pagination.total} transactions)
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="h-8 w-8 p-0 bg-surface-2 border-subtle hover:bg-surface-3"
              >
                <CaretLeft className="h-4 w-4" weight="bold" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="h-8 w-8 p-0 bg-surface-2 border-subtle hover:bg-surface-3"
              >
                <CaretRight className="h-4 w-4" weight="bold" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
