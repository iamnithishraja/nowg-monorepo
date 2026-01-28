import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRoleBadgeVariant } from "@nowgai/shared/types";
import { UserDetailType } from "./types";
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading user details...</div>
          </div>
        ) : userDetail ? (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Email</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{userDetail.email}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Name</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {userDetail.name || "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getRoleBadgeVariant(userDetail.role)}>
                    {userDetail.role}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={userDetail.isActive ? "default" : "secondary"}
                  >
                    {userDetail.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {userDetail.isWhitelisted && (
                    <Badge variant="outline" className="ml-2">
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
              <Card>
                <CardHeader>
                  <CardTitle>Deployment Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">
                        {userDetail.deploymentStats.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Successful
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {userDetail.deploymentStats.successful}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {userDetail.deploymentStats.failed}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        In Progress
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {userDetail.deploymentStats.inProgress}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for Model Usage and Transactions */}
            <Tabs defaultValue="models" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="models">Model Usage</TabsTrigger>
                <TabsTrigger value="transactions">
                  Recent Transactions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="models" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Models Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetail.modelUsage &&
                    userDetail.modelUsage.length > 0 ? (
                      <div className="space-y-3">
                        {userDetail.modelUsage.map((model, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{model.model}</p>
                              <p className="text-sm text-muted-foreground">
                                {model.messages} messages
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">
                                {model.tokens.toLocaleString()} tokens
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${model.cost.toFixed(4)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No model usage data
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="transactions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDetail.recentTransactions &&
                    userDetail.recentTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {userDetail.recentTransactions.map(
                          (transaction, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 border rounded-lg"
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
                                    <span className="text-xs text-muted-foreground">
                                      {transaction.model}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {transaction.description || "No description"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(
                                    transaction.createdAt
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-semibold ${
                                    transaction.type === "recharge"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {transaction.type === "recharge" ? "+" : "-"}$
                                  {Math.abs(transaction.amount).toFixed(4)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Balance: $
                                  {transaction.balanceAfter.toFixed(4)}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
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
