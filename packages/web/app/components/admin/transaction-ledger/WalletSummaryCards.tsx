import { Buildings, FolderSimple, User, Wallet } from "@phosphor-icons/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from "../../ui/card";
import type { WalletSummaryResponse } from "./index";
import { formatCurrency } from "./utils";

interface WalletSummaryCardsProps {
  data: WalletSummaryResponse;
}

export function WalletSummaryCards({ data }: WalletSummaryCardsProps) {
  const cards = [
    {
      icon: Wallet,
      label: "Total Balance (All Wallets)",
      value: formatCurrency(data.overall.totalBalance),
      sub: `${data.overall.totalWallets} wallets`,
    },
    {
      icon: Buildings,
      label: "Organization Wallets",
      value: formatCurrency(data.organizationWallets.totalBalance),
      sub: `${data.organizationWallets.count} wallets • ${data.organizationWallets.totalTransactions} txns`,
    },
    {
      icon: FolderSimple,
      label: "Project Wallets",
      value: formatCurrency(data.projectWallets.totalBalance),
      sub: `${data.projectWallets.count} wallets • ${data.projectWallets.totalTransactions} txns`,
    },
    {
      icon: User,
      label: "User Project Wallets",
      value: formatCurrency(data.userProjectWallets.totalBalance),
      sub: `${data.userProjectWallets.count} wallets • ${data.userProjectWallets.uniqueUsers} users`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="bg-surface-1 border border-subtle rounded-[12px] h-full">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-[13px] text-secondary tracking-[-0.26px]">
                <Icon className="h-4 w-4 text-[#7b4cff]" />
                {card.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-[22px] font-bold text-primary tracking-[-0.44px]">
                {card.value}
              </div>
              <p className="text-[13px] text-tertiary mt-1 tracking-[-0.26px]">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

