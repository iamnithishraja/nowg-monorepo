import { TableCell, TableRow } from "@/components/ui/table";
import { ArrowUpCircle, ArrowDownCircle, Building2, FolderKanban, User } from "lucide-react";
import { LedgerTransaction } from "./types";
import { formatDate, formatCurrency, getWalletTypeBadge } from "./utils";

interface TransactionRowProps {
  transaction: LedgerTransaction;
}

export function TransactionRow({ transaction: txn }: TransactionRowProps) {
  return (
    <TableRow>
      <TableCell className="font-mono text-sm whitespace-nowrap">
        {formatDate(txn.createdAt)}
      </TableCell>
      <TableCell>{getWalletTypeBadge(txn.walletType)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {txn.transactionType === "credit" ? (
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          )}
          <span
            className={
              txn.transactionType === "credit"
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {txn.transactionType === "credit" ? "+" : "-"}
            {formatCurrency(txn.amount)}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {formatCurrency(txn.balanceBefore)} → {formatCurrency(txn.balanceAfter)}
      </TableCell>
      <TableCell>
        {txn.fromAddress ? (
          <div className="flex flex-col gap-1 text-xs">
            {txn.fromAddressType === "organization" && (
              <span className="flex items-center gap-1 text-blue-600">
                <Building2 className="h-3 w-3" />
                {txn.fromAddressName || "Organization"}
              </span>
            )}
            {txn.fromAddressType === "project" && (
              <span className="flex items-center gap-1 text-green-600">
                <FolderKanban className="h-3 w-3" />
                {txn.fromAddressName || "Project"}
              </span>
            )}
            {txn.fromAddressType === "user_project" && (
              <span className="flex items-center gap-1 text-purple-600">
                <User className="h-3 w-3" />
                {txn.fromAddressName || "User"}
              </span>
            )}
            {!txn.fromAddressType && (
              <span className="text-muted-foreground text-xs font-mono">
                {txn.fromAddress.substring(0, 8)}...
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">External</span>
        )}
      </TableCell>
      <TableCell>
        {txn.toAddress ? (
          <div className="flex flex-col gap-1 text-xs">
            {txn.toAddressType === "organization" && (
              <span className="flex items-center gap-1 text-blue-600">
                <Building2 className="h-3 w-3" />
                {txn.toAddressName || "Organization"}
              </span>
            )}
            {txn.toAddressType === "project" && (
              <span className="flex items-center gap-1 text-green-600">
                <FolderKanban className="h-3 w-3" />
                {txn.toAddressName || "Project"}
              </span>
            )}
            {txn.toAddressType === "user_project" && (
              <span className="flex items-center gap-1 text-purple-600">
                <User className="h-3 w-3" />
                {txn.toAddressName || "User"}
              </span>
            )}
            {!txn.toAddressType && (
              <span className="text-muted-foreground text-xs font-mono">
                {txn.toAddress.substring(0, 8)}...
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-xs">
          {txn.organizationName && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {txn.organizationName}
            </span>
          )}
          {txn.projectName && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              {txn.projectName}
            </span>
          )}
          {txn.userName && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              {txn.userName}
              {txn.userEmail && (
                <span className="text-muted-foreground">({txn.userEmail})</span>
              )}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-md text-muted-foreground">
        <div className="break-words whitespace-pre-wrap">
          {txn.description || "-"}
        </div>
      </TableCell>
    </TableRow>
  );
}

