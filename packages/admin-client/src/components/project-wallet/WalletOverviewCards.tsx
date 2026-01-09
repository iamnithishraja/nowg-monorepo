import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, History, Wallet } from "lucide-react";
import { WalletData } from "./types";
import { formatCurrency, formatDate } from "./utils";

interface WalletOverviewCardsProps {
  wallet: WalletData;
}

export function WalletOverviewCards({ wallet }: WalletOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Current Balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {formatCurrency(wallet.balance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {wallet.balance} credits available
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Total Transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{wallet.transactionCount}</div>
          <p className="text-sm text-muted-foreground mt-1">
            All-time transactions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallet Type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="text-lg py-1 px-3">
            Project Wallet
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Created {formatDate(wallet.createdAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
