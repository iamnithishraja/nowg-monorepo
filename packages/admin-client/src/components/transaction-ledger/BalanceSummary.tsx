import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "./utils";
import { UserBalancesResponse } from "./types";

interface BalanceSummaryProps {
  summary: UserBalancesResponse["summary"];
}

export function BalanceSummary({ summary }: BalanceSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total Balance</div>
          <div className="text-xl font-bold text-primary mt-1">
            {formatCurrency(summary.totalBalance)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Wallets</div>
          <div className="text-xl font-bold mt-1">{summary.totalWallets}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Unique Users</div>
          <div className="text-xl font-bold mt-1">{summary.uniqueUsers}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Projects</div>
          <div className="text-xl font-bold mt-1">
            {summary.uniqueProjects}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Organizations</div>
          <div className="text-xl font-bold mt-1">
            {summary.uniqueOrganizations}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

