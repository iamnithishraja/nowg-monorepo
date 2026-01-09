import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Wallet as WalletIcon,
  Plus,
  DollarSign,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Transaction } from "@shared/schema";

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddFundsDialogOpen, setIsAddFundsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");

  // Disabled - backend API not implemented
  const { data: transactions = [], isLoading: isLoadingTransactions } =
    useQuery<Transaction[]>({
      queryKey: ["/api/transactions"],
      enabled: false, // Disabled until backend is implemented
    });

  const addFundsMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("POST", "/api/wallet/add-funds", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setIsAddFundsDialogOpen(false);
      setAmount("");
      toast({
        title: "Funds added successfully",
        description: "Your wallet balance has been updated.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add funds. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddFunds = (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(amount);
    if (amountValue > 0) {
      addFundsMutation.mutate(amountValue);
    }
  };

  // Parse balance values safely
  const cashBalance = user?.balance ? parseFloat(user.balance as string) : 0;
  const tokenBalance = user?.tokenBalance ?? 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
      case "refunded":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "token_purchase":
      case "subscription":
        return <ArrowUpRight className="h-4 w-4" />;
      case "refund":
        return <ArrowDownLeft className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Wallet
          </h1>
          <Button
            onClick={() => setIsAddFundsDialogOpen(true)}
            data-testid="button-add-funds"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Funds
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card data-testid="card-cash-balance">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-lg">Cash Balance</CardTitle>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="text-4xl font-bold"
                data-testid="text-cash-balance"
              >
                ${cashBalance.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Available for purchases
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-token-balance">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-lg">AI Tokens</CardTitle>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="text-4xl font-bold"
                data-testid="text-token-balance"
              >
                {tokenBalance.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Tokens remaining
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card data-testid="card-transaction-history">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Recent account activity and purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 p-4 border rounded-lg flex-wrap"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => {
                  const txAmount = parseFloat(transaction.amount as string);
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate flex-wrap"
                      data-testid={`transaction-${transaction.id}`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getTypeIcon(transaction.type)}
                        </div>
                        <div>
                          <div
                            className="font-medium"
                            data-testid={`transaction-description-${transaction.id}`}
                          >
                            {transaction.description ||
                              transaction.type.replace(/_/g, " ")}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                            <Clock className="h-3 w-3" />
                            <span
                              data-testid={`transaction-date-${transaction.id}`}
                            >
                              {format(
                                new Date(transaction.createdAt),
                                "MMM d, yyyy h:mm a"
                              )}
                            </span>
                            <Badge
                              variant={getStatusColor(transaction.status)}
                              data-testid={`transaction-status-${transaction.id}`}
                            >
                              {transaction.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-semibold ${
                            transaction.type === "refund"
                              ? "text-green-600"
                              : ""
                          }`}
                          data-testid={`transaction-amount-${transaction.id}`}
                        >
                          {transaction.type === "refund" ? "+" : "-"}$
                          {txAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.currency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <WalletIcon className="h-16 w-16 text-muted-foreground mb-4" />
                <h3
                  className="text-lg font-medium mb-2"
                  data-testid="text-no-transactions"
                >
                  No transactions yet
                </h3>
                <p className="text-sm text-muted-foreground mb-6 text-center">
                  Add funds to your wallet to get started with AI tokens and
                  projects
                </p>
                <Button
                  onClick={() => setIsAddFundsDialogOpen(true)}
                  data-testid="button-add-funds-empty"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Funds
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Funds Dialog */}
      <Dialog
        open={isAddFundsDialogOpen}
        onOpenChange={setIsAddFundsDialogOpen}
      >
        <DialogContent data-testid="dialog-add-funds">
          <form onSubmit={handleAddFunds}>
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">
                Add Funds
              </DialogTitle>
              <DialogDescription>
                Add funds to your wallet to purchase AI tokens and premium
                features
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9"
                    required
                    data-testid="input-amount"
                  />
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                  <span className="text-sm">Subtotal</span>
                  <span className="font-medium">${amount || "0.00"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                  <span className="text-sm">Processing Fee</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">
                      ${amount || "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddFundsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addFundsMutation.isPending}
                data-testid="button-submit-payment"
              >
                {addFundsMutation.isPending ? "Processing..." : "Add Funds"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
