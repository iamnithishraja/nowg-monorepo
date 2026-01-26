import { getRoleBadgeVariant } from "@nowgai/shared/types";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { UserDetailType } from "./types";
import { UserStatsCards } from "./UserStatsCards";

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userDetail: UserDetailType | undefined;
  isLoading: boolean;
}

export function UserDetailDialog({
  open,
  onOpenChange,
  userDetail,
  isLoading,
}: UserDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-surface-1 border-subtle">
        <DialogHeader>
          <DialogTitle className="text-primary">User Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-tertiary">Loading user details...</div>
          </div>
        ) : userDetail ? (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-surface-2 border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-secondary">Email</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-primary">{userDetail.email}</p>
                </CardContent>
              </Card>
              <Card className="bg-surface-2 border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-secondary">Name</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-primary">
                    {userDetail.name || "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-surface-2 border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-secondary">Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getRoleBadgeVariant(userDetail.role)}>
                    {userDetail.role}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="bg-surface-2 border-subtle">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-secondary">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={userDetail.isActive ? "default" : "secondary"}
                  >
                    {userDetail.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {userDetail.isWhitelisted && (
                    <Badge variant="outline" className="ml-2 border-subtle text-secondary">
                      Whitelisted
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Stats Cards */}
            <UserStatsCards userDetail={userDetail} />

            {/* Deployment Stats */}
            {userDetail.deploymentStats && (
              <Card className="bg-surface-2 border-subtle">
                <CardHeader>
                  <CardTitle className="text-primary">Deployment Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-tertiary">Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {userDetail.deploymentStats.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-tertiary">
                        Successful
                      </p>
                      <p className="text-2xl font-bold text-[#22c55e]">
                        {userDetail.deploymentStats.successful}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-tertiary">Failed</p>
                      <p className="text-2xl font-bold text-[#ef4444]">
                        {userDetail.deploymentStats.failed}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-tertiary">
                        In Progress
                      </p>
                      <p className="text-2xl font-bold text-[#eab308]">
                        {userDetail.deploymentStats.inProgress}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for Model Usage and Transactions */}
            <Tabs defaultValue="models" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-surface-2 border-subtle">
                <TabsTrigger value="models" className="data-[state=active]:accent-primary data-[state=active]:text-white">Model Usage</TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:accent-primary data-[state=active]:text-white">
                  Recent Transactions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="models" className="mt-4">
                <Card className="bg-surface-2 border-subtle">
                  <CardHeader>
                    <CardTitle className="text-primary">Top Models Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetail.modelUsage &&
                    userDetail.modelUsage.length > 0 ? (
                      <div className="space-y-3">
                        {userDetail.modelUsage.map((model, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-subtle rounded-lg bg-surface-1"
                          >
                            <div>
                              <p className="font-medium text-primary">{model.model}</p>
                              <p className="text-sm text-tertiary">
                                {model.messages} messages
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-primary">
                                {model.tokens.toLocaleString()} tokens
                              </p>
                              <p className="text-sm text-[#22c55e]">
                                ${model.cost.toFixed(4)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-tertiary py-8">
                        No model usage data
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="transactions" className="mt-4">
                <Card className="bg-surface-2 border-subtle">
                  <CardHeader>
                    <CardTitle className="text-primary">Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetail.recentTransactions &&
                    userDetail.recentTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {userDetail.recentTransactions.map(
                          (transaction, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 border border-subtle rounded-lg bg-surface-1"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      transaction.type === "recharge"
                                        ? "default"
                                        : transaction.type === "refund"
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {transaction.type}
                                  </Badge>
                                  {transaction.model && (
                                    <span className="text-xs text-tertiary">
                                      {transaction.model}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-secondary mt-1">
                                  {transaction.description || "No description"}
                                </p>
                                <p className="text-xs text-tertiary">
                                  {new Date(
                                    transaction.createdAt
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-semibold ${
                                    transaction.type === "recharge"
                                      ? "text-[#22c55e]"
                                      : "text-[#ef4444]"
                                  }`}
                                >
                                  {transaction.type === "recharge" ? "+" : "-"}$
                                  {Math.abs(transaction.amount).toFixed(4)}
                                </p>
                                <p className="text-xs text-tertiary">
                                  Balance: $
                                  {transaction.balanceAfter.toFixed(4)}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-tertiary py-8">
                        No transactions
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

