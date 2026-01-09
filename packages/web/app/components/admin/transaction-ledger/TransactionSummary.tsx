import { BookOpen, CurrencyDollar, TrendDown, TrendUp } from "@phosphor-icons/react";
import { Card, CardContent } from "../../ui/card";
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
  const cards = [
    {
      icon: TrendUp,
      label: "Total Credits",
      value: `+${formatCurrency(summary.totalCredits)}`,
      color: "text-green-500",
    },
    {
      icon: TrendDown,
      label: "Total Debits",
      value: `-${formatCurrency(summary.totalDebits)}`,
      color: "text-red-500",
    },
    {
      icon: CurrencyDollar,
      label: "Net Flow",
      value: `${summary.netFlow >= 0 ? "+" : ""}${formatCurrency(
        summary.netFlow
      )}`,
      color: summary.netFlow >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      icon: BookOpen,
      label: "Total Transactions",
      value: `${summary.totalTransactions}`,
      color: "text-[#7b4cff]",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="bg-surface-1 border border-subtle rounded-[12px] h-full">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-secondary text-[13px] tracking-[-0.26px]">
                <Icon className={`h-4 w-4 ${card.color}`} />
                {card.label}
              </div>
              <div className={`text-[20px] font-bold mt-1 tracking-[-0.40px] ${card.color}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

