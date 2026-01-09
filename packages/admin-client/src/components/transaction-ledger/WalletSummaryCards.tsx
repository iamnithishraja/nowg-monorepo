import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Wallet, Building2, FolderKanban, User } from "lucide-react";
import { WalletSummaryResponse } from "./types";
import { formatCurrency } from "./utils";

interface WalletSummaryCardsProps {
  data: WalletSummaryResponse;
}

export function WalletSummaryCards({ data }: WalletSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Total Balance (All Wallets)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(data.overall.totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.overall.totalWallets} wallets
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization Wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.organizationWallets.totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.organizationWallets.count} wallets •{" "}
            {data.organizationWallets.totalTransactions} txns
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            Project Wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.projectWallets.totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.projectWallets.count} wallets •{" "}
            {data.projectWallets.totalTransactions} txns
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <User className="h-4 w-4" />
            User Project Wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.userProjectWallets.totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.userProjectWallets.count} wallets •{" "}
            {data.userProjectWallets.uniqueUsers} users
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

