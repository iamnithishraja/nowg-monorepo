import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Zap, MessageSquare, Database } from "lucide-react";
import { UserDetailType } from "./types";

interface UserStatsCardsProps {
  userDetail: UserDetailType;
}

export function UserStatsCards({ userDetail }: UserStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-xl font-bold">
                ${(userDetail.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Tokens</p>
              <p className="text-xl font-bold">
                {(userDetail.totalTokens || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Messages</p>
              <p className="text-xl font-bold">
                {userDetail.totalMessages || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Projects</p>
              <p className="text-xl font-bold">
                {userDetail.totalProjects || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
