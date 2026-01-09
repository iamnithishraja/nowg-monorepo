import {
    ArrowCircleDown,
    ArrowCircleUp,
    Buildings,
    FolderSimple,
    User,
} from "@phosphor-icons/react";
import { TableCell, TableRow } from "../../ui/table";
import type { LedgerTransaction } from "./index";
import { formatCurrency, formatDate, getWalletTypeBadge } from "./utils";

interface TransactionRowProps {
  transaction: LedgerTransaction;
}

export function TransactionRow({ transaction: txn }: TransactionRowProps) {
  return (
    <TableRow className="border-b border-subtle hover:bg-surface-2">
      <TableCell className="font-mono text-sm whitespace-nowrap text-primary">
        {formatDate(txn.createdAt)}
      </TableCell>
      <TableCell>{getWalletTypeBadge(txn.walletType)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {txn.transactionType === "credit" ? (
            <ArrowCircleUp className="h-4 w-4 text-[#22c55e]" weight="fill" />
          ) : (
            <ArrowCircleDown className="h-4 w-4 text-[#ef4444]" weight="fill" />
          )}
          <span
            className={
              txn.transactionType === "credit"
                ? "text-[#22c55e]"
                : "text-[#ef4444]"
            }
          >
            {txn.transactionType === "credit" ? "+" : "-"}
            {formatCurrency(txn.amount)}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-tertiary">
        {formatCurrency(txn.balanceBefore)} → {formatCurrency(txn.balanceAfter)}
      </TableCell>
      <TableCell>
        {txn.fromAddress ? (
          <div className="flex flex-col gap-1 text-xs">
            {txn.fromAddressType === "organization" && (
              <span className="flex items-center gap-1 text-info-500">
                <Buildings className="h-3 w-3" />
                {txn.fromAddressName || "Organization"}
              </span>
            )}
            {txn.fromAddressType === "project" && (
              <span className="flex items-center gap-1 text-[#22c55e]">
                <FolderSimple className="h-3 w-3" />
                {txn.fromAddressName || "Project"}
              </span>
            )}
            {txn.fromAddressType === "user_project" && (
              <span className="flex items-center gap-1 text-[#7b4cff]">
                <User className="h-3 w-3" />
                {txn.fromAddressName || "User"}
              </span>
            )}
            {!txn.fromAddressType && (
              <span className="text-tertiary text-xs font-mono">
                {txn.fromAddress.substring(0, 8)}...
              </span>
            )}
          </div>
        ) : (
          <span className="text-tertiary text-xs">External</span>
        )}
      </TableCell>
      <TableCell>
        {txn.toAddress ? (
          <div className="flex flex-col gap-1 text-xs">
            {txn.toAddressType === "organization" && (
              <span className="flex items-center gap-1 text-info-500">
                <Buildings className="h-3 w-3" />
                {txn.toAddressName || "Organization"}
              </span>
            )}
            {txn.toAddressType === "project" && (
              <span className="flex items-center gap-1 text-[#22c55e]">
                <FolderSimple className="h-3 w-3" />
                {txn.toAddressName || "Project"}
              </span>
            )}
            {txn.toAddressType === "user_project" && (
              <span className="flex items-center gap-1 text-[#7b4cff]">
                <User className="h-3 w-3" />
                {txn.toAddressName || "User"}
              </span>
            )}
            {!txn.toAddressType && (
              <span className="text-tertiary text-xs font-mono">
                {txn.toAddress.substring(0, 8)}...
              </span>
            )}
          </div>
        ) : (
          <span className="text-tertiary text-xs">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-xs">
          {txn.organizationName && (
            <span className="flex items-center gap-1 text-tertiary">
              <Buildings className="h-3 w-3" />
              {txn.organizationName}
            </span>
          )}
          {txn.projectName && (
            <span className="flex items-center gap-1 text-tertiary">
              <FolderSimple className="h-3 w-3" />
              {txn.projectName}
            </span>
          )}
          {txn.userName && (
            <span className="flex items-center gap-1 text-tertiary">
              <User className="h-3 w-3" />
              {txn.userName}
              {txn.userEmail && (
                <span className="text-tertiary">({txn.userEmail})</span>
              )}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-xs truncate text-tertiary">
        {txn.description || "-"}
      </TableCell>
    </TableRow>
  );
}

