import { Database, CurrencyDollar, ChatCircle, Lightning } from "@phosphor-icons/react";
import { Card, CardContent } from "~/components/ui/card";
import type { UserDetailType } from "./types";

interface UserStatsCardsProps {
  userDetail: UserDetailType;
}

export function UserStatsCards({ userDetail }: UserStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CurrencyDollar className="h-8 w-8 text-green-500" weight="fill" />
            <div>
              <p className="text-[13px] text-secondary tracking-[-0.26px]">Balance</p>
              <p className="text-[20px] font-bold text-primary tracking-[-0.40px]">
                ${(userDetail.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Lightning className="h-8 w-8 text-yellow-500" weight="fill" />
            <div>
              <p className="text-[13px] text-secondary tracking-[-0.26px]">Tokens</p>
              <p className="text-[20px] font-bold text-primary tracking-[-0.40px]">
                {(userDetail.totalTokens || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <ChatCircle className="h-8 w-8 text-blue-500" weight="fill" />
            <div>
              <p className="text-[13px] text-secondary tracking-[-0.26px]">Messages</p>
              <p className="text-[20px] font-bold text-primary tracking-[-0.40px]">
                {userDetail.totalMessages || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-surface-1 border border-subtle rounded-[12px]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-purple-500" weight="fill" />
            <div>
              <p className="text-[13px] text-secondary tracking-[-0.26px]">Projects</p>
              <p className="text-[20px] font-bold text-primary tracking-[-0.40px]">
                {userDetail.totalProjects || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

