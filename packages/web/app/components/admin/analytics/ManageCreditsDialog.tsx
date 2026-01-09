import { ArrowCircleDown, ArrowCircleUp, ArrowCounterClockwise, CurrencyDollar, Wallet, ArrowSquareOut } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { adminClient } from "../../../lib/adminClient";

interface ManageCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId?: string;
  projectBalance: number;
  orgBalance: number;
  isOrgAdmin: boolean;
  onTransfer: (amount: number, description: string) => void;
  onRequestCredits: (amount: number, description: string) => void;
  onCreditBackToOrg?: (amount: number, description: string) => void;
  isTransferring: boolean;
  isRequesting: boolean;
  isCreditingBack?: boolean;
}

interface FundRequest {
  id: string;
  projectId: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  createdAt: string;
}

interface FundRequestsResponse {
  fundRequests: FundRequest[];
}

export function ManageCreditsDialog({
  open,
  onOpenChange,
  projectName,
  projectId,
  projectBalance,
  orgBalance,
  isOrgAdmin,
  onTransfer,
  onRequestCredits,
  onCreditBackToOrg,
  isTransferring,
  isRequesting,
  isCreditingBack = false,
}: ManageCreditsDialogProps) {
  const [mode, setMode] = useState<"transfer" | "request" | "creditback">(
    isOrgAdmin ? "transfer" : "request"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Fetch fund requests for this project (only for project_admin, not org_admin)
  const { data: fundRequestsData } = useQuery<FundRequestsResponse>({
    queryKey: ["/api/admin/fund-requests", projectId],
    queryFn: async () => {
      if (!projectId) return { fundRequests: [] };
      try {
        const response = await adminClient.get<FundRequestsResponse>("/api/admin/fund-requests", {
          params: { projectId },
        });
        return response || { fundRequests: [] };
      } catch (error) {
        console.error("Error fetching fund requests:", error);
        return { fundRequests: [] };
      }
    },
    enabled: !isOrgAdmin && !!projectId && open, // Only fetch for project_admin when dialog is open
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter fund requests for this specific project
  const projectFundRequests = fundRequestsData?.fundRequests?.filter(
    (req) => req.projectId === projectId
  ) || [];
  
  // Check if there are any pending requests
  const hasPendingRequests = projectFundRequests.some(
    (req) => req.status === "pending"
  );

  // Reset mode when dialog opens
  useEffect(() => {
    if (open) {
      setMode(isOrgAdmin ? "transfer" : "request");
      setAmount("");
      setDescription("");
    }
  }, [open, isOrgAdmin]);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (mode === "transfer") {
      onTransfer(numAmount, description);
    } else if (mode === "request") {
      onRequestCredits(numAmount, description);
    } else if (mode === "creditback" && onCreditBackToOrg) {
      onCreditBackToOrg(numAmount, description);
    }

    // Reset form
    setAmount("");
    setDescription("");
  };

  const isSubmitting = 
    mode === "transfer" ? isTransferring : 
    mode === "request" ? isRequesting : 
    isCreditingBack;

  const canSubmit = (() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    
    if (mode === "transfer") {
      return numAmount <= orgBalance;
    } else if (mode === "creditback") {
      return numAmount <= projectBalance;
    }
    return true; // request mode
  })();

  const getValidationError = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;
    
    if (mode === "transfer" && numAmount > orgBalance) {
      return "Amount exceeds organization balance";
    }
    if (mode === "creditback" && numAmount > projectBalance) {
      return "Amount exceeds project balance";
    }
    return null;
  };

  const validationError = getValidationError();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface-1 border-subtle p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-subtle/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-primary/20 to-emerald-500/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-primary">
                Manage Project Credits
              </DialogTitle>
              <DialogDescription className="text-sm text-tertiary mt-0.5">
                {projectName}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Balance Info */}
          <div className="flex gap-3">
            <div className="flex-1 p-4 rounded-xl border border-subtle bg-surface-2">
              <p className="text-xs text-tertiary mb-1.5">Project Balance</p>
              <p className="text-2xl font-bold text-primary tracking-tight">
                ${projectBalance.toFixed(2)}
              </p>
            </div>
            {isOrgAdmin && (
              <div className="flex-1 p-4 rounded-xl border border-subtle bg-surface-2">
                <p className="text-xs text-tertiary mb-1.5">Org Balance</p>
                <p className="text-2xl font-bold text-primary tracking-tight">
                  ${orgBalance.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          {isOrgAdmin ? (
            <div className="flex gap-1.5 p-1 rounded-xl bg-surface-2 border border-subtle">
              <button
                onClick={() => setMode("transfer")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium text-xs transition-all ${
                  mode === "transfer"
                    ? "bg-accent-primary text-white shadow-sm"
                    : "text-secondary hover:text-primary hover:bg-surface-3"
                }`}
              >
                <ArrowCircleDown className="h-3.5 w-3.5" weight="fill" />
                Transfer In
              </button>
              <button
                onClick={() => setMode("creditback")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium text-xs transition-all ${
                  mode === "creditback"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-secondary hover:text-primary hover:bg-surface-3"
                }`}
              >
                <ArrowCounterClockwise className="h-3.5 w-3.5" />
                Credit Back
              </button>
              <button
                onClick={() => setMode("request")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium text-xs transition-all ${
                  mode === "request"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-secondary hover:text-primary hover:bg-surface-3"
                }`}
              >
                <ArrowCircleUp className="h-3.5 w-3.5" weight="fill" />
                Request
              </button>
            </div>
          ) : (
            // Non-org admin can only request or credit back
            <div className="flex gap-2 p-1 rounded-xl bg-surface-2 border border-subtle">
              {onCreditBackToOrg && projectBalance > 0 && (
                <button
                  onClick={() => setMode("creditback")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${
                    mode === "creditback"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-secondary hover:text-primary hover:bg-surface-3"
                  }`}
                >
                  <ArrowCounterClockwise className="h-4 w-4" />
                  Credit Back
                </button>
              )}
              <button
                onClick={() => setMode("request")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${
                  mode === "request"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-secondary hover:text-primary hover:bg-surface-3"
                }`}
              >
                <ArrowCircleUp className="h-4 w-4" weight="fill" />
                Request
              </button>
            </div>
          )}

          {/* Mode Description */}
          <div className={`p-3 rounded-lg border text-xs ${
            mode === "transfer" 
              ? "bg-accent-primary/5 border-accent-primary/20 text-accent-primary" 
              : mode === "creditback"
              ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
              : "bg-sky-500/5 border-sky-500/20 text-sky-400"
          }`}>
            {mode === "transfer" && "Transfer credits from organization wallet to this project."}
            {mode === "creditback" && "Return unused credits from this project back to the organization wallet."}
            {mode === "request" && "Submit a request for additional credits from the organization."}
          </div>

          {/* Fund Request Link for project_admin */}
          {!isOrgAdmin && projectFundRequests.length > 0 && (
            <div className="p-3 rounded-lg border border-subtle bg-surface-2">
              <p className="text-xs text-tertiary mb-1.5">
                {hasPendingRequests
                  ? `You have ${projectFundRequests.filter((r) => r.status === "pending").length} pending fund request${projectFundRequests.filter((r) => r.status === "pending").length > 1 ? "s" : ""} for this project.`
                  : `You have ${projectFundRequests.length} fund request${projectFundRequests.length > 1 ? "s" : ""} for this project.`}
              </p>
              <Link
                to="/admin/fund-requests"
                className="inline-flex items-center gap-1.5 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
                onClick={() => onOpenChange(false)}
              >
                <span>View all fund requests</span>
                <ArrowSquareOut className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">Amount ($)</Label>
            <div className="relative">
              <CurrencyDollar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9 h-11 bg-surface-2 border-subtle text-primary text-lg font-medium"
                min="0"
                step="0.01"
              />
            </div>
            {validationError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-rose-400" />
                {validationError}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">Description</Label>
            <Textarea
              placeholder={
                mode === "transfer"
                  ? "Enter transfer description..."
                  : mode === "creditback"
                  ? "Reason for credit back..."
                  : "Describe why you need these credits..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface-2 border-subtle text-primary resize-none min-h-[80px]"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-subtle bg-surface-2 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 text-secondary hover:text-primary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`h-10 px-5 text-white font-medium shadow-sm ${
              mode === "transfer" 
                ? "bg-accent-primary hover:bg-accent-primary/90 shadow-accent-primary/20"
                : mode === "creditback"
                ? "bg-amber-500 hover:bg-amber-500/90 shadow-amber-500/20"
                : "bg-sky-500 hover:bg-sky-500/90 shadow-sky-500/20"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                {mode === "transfer" ? "Transferring..." : mode === "creditback" ? "Crediting Back..." : "Requesting..."}
              </div>
            ) : mode === "transfer" ? (
              "Transfer Credits"
            ) : mode === "creditback" ? (
              "Credit Back to Org"
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
