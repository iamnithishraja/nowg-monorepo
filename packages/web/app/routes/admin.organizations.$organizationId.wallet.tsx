import {
    ArrowDownCircle,
    ArrowLeft,
    ArrowRight,
    ArrowUpCircle,
    Building2,
    DollarSign,
    History,
    Plus,
    Wallet,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate, useParams } from "react-router";
import { AdminLayout } from "~/components/AdminLayout";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { adminClient } from "~/lib/adminClient";
import { auth } from "~/lib/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user, organizationId: params.organizationId };
}

export function meta() {
  return [
    { title: "Organization Wallet - Admin - Nowgai" },
    { name: "description", content: "Organization wallet management" },
  ];
}

export default function OrgWalletPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const organizationId = params.organizationId;
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!organizationId) return;

    const fetchWallet = async () => {
      try {
        const data = await adminClient.get<{ wallet: any }>(
          `/api/admin/org-wallets/${organizationId}`
        );
        setWallet(data.wallet);
      } catch (error) {
        console.error("Failed to fetch wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTransactions = async () => {
      try {
        const data = await adminClient.get<{ transactions: any[] }>(
          `/api/admin/org-wallets/${organizationId}/transactions`,
          { params: { page: currentPage, limit: 10 } }
        );
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      }
    };

    fetchWallet();
    fetchTransactions();
  }, [organizationId, currentPage]);

  useEffect(() => {
    if (transferDialogOpen && organizationId) {
      const fetchProjects = async () => {
        try {
          const data = await adminClient.get<{ projects: any[] }>(
            `/api/admin/projects`,
            { params: { organizationId, limit: 100 } }
          );
          setProjects(data.projects || []);
        } catch (error) {
          console.error("Failed to fetch projects:", error);
        }
      };
      fetchProjects();
    }
  }, [transferDialogOpen, organizationId]);

  const handleAddCredits = async () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminClient.post(
        `/api/admin/org-wallets/${organizationId}/add-credits`,
        {
          amount,
          description: "Manual credit addition",
        }
      );

      toast({
        title: "Credits Added",
        description: `Successfully added ${amount} credits`,
      });
      setAddCreditsOpen(false);
      setCreditAmount("");
      // Refresh wallet
      const data = await adminClient.get<{ wallet: any }>(
        `/api/admin/org-wallets/${organizationId}`
      );
      setWallet(data.wallet);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add credits",
        variant: "destructive",
      });
    }
  };

  const handleTransfer = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (wallet && wallet.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Organization wallet has insufficient balance. Current balance: ${wallet.balance}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await adminClient.post(
        `/api/admin/project-wallets/${selectedProjectId}/transfer-from-org`,
        {
          amount,
          description: transferDescription.trim(),
        }
      );

      toast({
        title: "Transfer Successful",
        description: `Successfully transferred ${amount} credits to project`,
      });
      setTransferDialogOpen(false);
      setTransferAmount("");
      setTransferDescription("");
      setSelectedProjectId("");
      // Refresh wallet
      const walletData = await adminClient.get<{ wallet: any }>(
        `/api/admin/org-wallets/${organizationId}`
      );
      setWallet(walletData.wallet);
      // Refresh transactions
      const transactionsData = await adminClient.get<{ transactions: any[] }>(
        `/api/admin/org-wallets/${organizationId}/transactions`,
        { params: { page: currentPage, limit: 10 } }
      );
      setTransactions(transactionsData.transactions || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to transfer funds",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (!organizationId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Invalid organization ID</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/organizations")}
              className="text-secondary hover:text-primary hover:bg-surface-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2 rounded-[6px] accent-primary/10">
              <Wallet className="h-6 w-6 text-[#7b4cff]" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-primary">
                Organization Wallet
              </h1>
              {wallet && (
                <p className="text-secondary text-sm flex items-center gap-2 mt-0.5">
                  <Building2 className="h-4 w-4" />
                  {wallet.organizationName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(true)}
                disabled={!wallet || wallet.balance === 0}
                className="bg-surface-2 border-subtle text-primary hover:bg-subtle hover:border-[#555558] disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Transfer to Project
              </Button>
              <Button onClick={() => setAddCreditsOpen(true)} className="accent-primary hover:bg-[#8c63f2] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
            </div>
          </div>

          {/* Wallet Overview */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current Balance skeleton */}
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <DollarSign className="h-4 w-4" />
                      Current Balance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-8 w-32 bg-surface-2 rounded animate-pulse" />
                      <div className="h-4 w-40 bg-surface-2 rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Total Transactions skeleton */}
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <History className="h-4 w-4" />
                      Total Transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-8 w-24 bg-surface-2 rounded animate-pulse" />
                      <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Wallet Type skeleton */}
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <Wallet className="h-4 w-4" />
                      Wallet Type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-7 w-28 bg-surface-2 rounded-full animate-pulse" />
                      <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : wallet ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <DollarSign className="h-4 w-4" />
                      Current Balance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-[#7b4cff]">
                      {formatCurrency(wallet.balance || 0)}
                    </div>
                    <p className="text-sm text-tertiary mt-1">
                      {wallet.balance || 0} credits available
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <History className="h-4 w-4" />
                      Total Transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">
                      {wallet.transactionCount || 0}
                    </div>
                    <p className="text-sm text-tertiary mt-1">
                      All-time transactions
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-[12px] bg-surface-1 border border-subtle">
                <Card className="bg-transparent border-0 shadow-none">
                  <CardHeader className="pb-2 border-b border-subtle">
                    <CardDescription className="flex items-center gap-2 text-secondary">
                      <Wallet className="h-4 w-4" />
                      Wallet Type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-lg py-1 px-3 bg-surface-2 text-primary border-subtle">
                      {wallet.type === "org_wallet"
                        ? "Organization"
                        : wallet.type}
                    </Badge>
                    <p className="text-sm text-tertiary mt-2">
                      Created{" "}
                      {wallet.createdAt ? formatDate(wallet.createdAt) : "N/A"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Transaction History */}
          <div className="rounded-[12px] bg-surface-1 border border-subtle">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="border-b border-subtle">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <History className="h-5 w-5 text-[#7b4cff]" />
                  Payment Transactions
                </CardTitle>
                <CardDescription className="text-tertiary">
                  View Stripe payment transactions (real money only). Project
                  transfers are shown in the transaction ledger.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-subtle hover:bg-transparent">
                        <TableHead className="text-secondary">Date</TableHead>
                        <TableHead className="text-secondary">Type</TableHead>
                        <TableHead className="text-secondary">Amount</TableHead>
                        <TableHead className="text-secondary">Balance Before</TableHead>
                        <TableHead className="text-secondary">Balance After</TableHead>
                        <TableHead className="text-secondary">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(5)].map((_, i) => (
                        <TableRow key={i} className="border-b border-subtle">
                          {[...Array(6)].map((__, j) => (
                            <TableCell key={j} className="py-3">
                              <div className="h-4 w-full rounded bg-subtle animate-pulse" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-subtle hover:bg-transparent">
                        <TableHead className="text-secondary">Date</TableHead>
                        <TableHead className="text-secondary">Type</TableHead>
                        <TableHead className="text-secondary">Amount</TableHead>
                        <TableHead className="text-secondary">Balance Before</TableHead>
                        <TableHead className="text-secondary">Balance After</TableHead>
                        <TableHead className="text-secondary">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction, idx) => (
                        <TableRow key={transaction.id || idx} className="border-b border-subtle hover:bg-surface-2">
                          <TableCell className="font-mono text-sm text-primary">
                            {formatDate(transaction.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {transaction.type === "credit" ? (
                                <ArrowUpCircle className="h-4 w-4 text-[#22c55e]" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4 text-[#ef4444]" />
                              )}
                              <Badge
                                variant={
                                  transaction.type === "credit"
                                    ? "default"
                                    : "destructive"
                                }
                                className="capitalize"
                              >
                                {transaction.type}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            <span
                              className={
                                transaction.type === "credit"
                                  ? "text-[#22c55e]"
                                  : "text-[#ef4444]"
                              }
                            >
                              {transaction.type === "credit" ? "+" : "-"}
                              {formatCurrency(Math.abs(transaction.amount))}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-tertiary">
                            {formatCurrency(transaction.balanceBefore)}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium text-primary">
                            {formatCurrency(transaction.balanceAfter)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-tertiary">
                            {transaction.description || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-tertiary">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Add Credits Dialog */}
          <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
            <DialogContent className="max-w-md bg-surface-1 border-subtle">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <Plus className="h-5 w-5 text-[#7b4cff]" />
                  Add Credits
                </DialogTitle>
                <DialogDescription className="text-secondary">
                  Add credits to this organization's wallet
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount" className="text-primary">Amount (USD)</Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
                    <Input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={creditAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCreditAmount(e.target.value)
                      }
                      placeholder="0.00"
                      className="pl-10 bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddCreditsOpen(false);
                    setCreditAmount("");
                  }}
                  className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
                >
                  Cancel
                </Button>
                <Button onClick={handleAddCredits} disabled={!creditAmount} className="accent-primary hover:bg-[#8c63f2] text-white">
                  Add Credits
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Transfer to Project Dialog */}
          <Dialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
          >
            <DialogContent className="bg-surface-1 border-subtle">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <ArrowRight className="h-5 w-5 text-[#7b4cff]" />
                  Transfer Credits to Project
                </DialogTitle>
                <DialogDescription className="text-secondary">
                  Transfer credits from organization wallet to a project wallet.
                  This is an atomic transaction.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="project-select" className="text-primary">Project *</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                  >
                    <SelectTrigger id="project-select" className="mt-2 bg-surface-2 border-subtle text-primary">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-2 border-subtle">
                      {projects.length > 0 ? (
                        projects.map((project) => (
                          <SelectItem key={project.id} value={project.id} className="text-primary">
                            {project.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled className="text-tertiary">
                          No projects available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="transfer-amount" className="text-primary">Amount (Credits)</Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
                    <Input
                      id="transfer-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={wallet?.balance}
                      value={transferAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransferAmount(e.target.value)
                      }
                      placeholder="0.00"
                      className="pl-10 bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
                    />
                  </div>
                  <p className="text-xs text-tertiary mt-1">
                    Available balance:{" "}
                    {wallet ? formatCurrency(wallet.balance) : "$0.00"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="transfer-description" className="text-primary">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="transfer-description"
                    value={transferDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setTransferDescription(e.target.value)
                    }
                    placeholder="e.g., Initial project funding, Monthly allocation..."
                    rows={3}
                    className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransferDialogOpen(false);
                    setTransferAmount("");
                    setTransferDescription("");
                    setSelectedProjectId("");
                  }}
                  className="bg-surface-2 border-subtle text-primary hover:bg-subtle"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={!transferAmount || !selectedProjectId}
                  className="accent-primary hover:bg-[#8c63f2] text-white"
                >
                  Transfer Credits
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AdminLayout>
  );
}
