import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, BookOpen } from "lucide-react";
import { formatCurrency } from "./utils";

interface TransactionSummaryProps {
  summary: {
    totalTransactions: number;
    totalCredits: number;
    totalDebits: number;
    netFlow: number;
  };
}

export function TransactionSummary({ summary }: TransactionSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Total Credits
          </div>
          <div className="text-xl font-bold text-green-600 mt-1">
            +{formatCurrency(summary.totalCredits)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Total Debits
          </div>
          <div className="text-xl font-bold text-red-600 mt-1">
            -{formatCurrency(summary.totalDebits)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <DollarSign className="h-4 w-4" />
            Net Flow
          </div>
          <div
            className={`text-xl font-bold mt-1 ${
              summary.netFlow >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {summary.netFlow >= 0 ? "+" : ""}
            {formatCurrency(summary.netFlow)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BookOpen className="h-4 w-4" />
            Total Transactions
          </div>
          <div className="text-xl font-bold mt-1">
            {summary.totalTransactions}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

