import { TableCell, TableRow } from "@/components/ui/table";
import { Building2, FolderKanban } from "lucide-react";
import { UserBalance } from "./types";
import { formatDate, formatCurrency } from "./utils";

interface BalanceRowProps {
  wallet: UserBalance;
}

export function BalanceRow({ wallet }: BalanceRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{wallet.userName}</span>
          <span className="text-xs text-muted-foreground">
            {wallet.userEmail}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          <FolderKanban className="h-3 w-3 text-muted-foreground" />
          {wallet.projectName}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          {wallet.organizationName}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span
          className={`font-mono font-bold ${
            wallet.balance > 0 ? "text-green-600" : "text-muted-foreground"
          }`}
        >
          {formatCurrency(wallet.balance)}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">
        {wallet.limit !== null ? formatCurrency(wallet.limit) : "No limit"}
      </TableCell>
      <TableCell className="text-right">{wallet.transactionCount}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {wallet.lastTransactionAt
          ? formatDate(wallet.lastTransactionAt)
          : "Never"}
      </TableCell>
    </TableRow>
  );
}

