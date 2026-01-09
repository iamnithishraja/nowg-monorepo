import { CurrencyDollar, ArrowCounterClockwise, User, Wallet, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
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

interface UserCreditLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberEmail: string;
  currentLimit: number | null;
  currentSpending: number;
  projectBalance: number;
  onSetLimit: (limit: number | null) => void;
  onResetSpending: () => void;
  isSettingLimit: boolean;
  isResettingSpending: boolean;
}

export function UserCreditLimitDialog({
  open,
  onOpenChange,
  memberName,
  memberEmail,
  currentLimit,
  currentSpending,
  projectBalance,
  onSetLimit,
  onResetSpending,
  isSettingLimit,
  isResettingSpending,
}: UserCreditLimitDialogProps) {
  const [limit, setLimit] = useState<string>("");

  useEffect(() => {
    if (open) {
      setLimit(currentLimit !== null ? currentLimit.toString() : "");
    }
  }, [open, currentLimit]);

  const handleSetLimit = () => {
    const numLimit = parseFloat(limit);
    if (limit === "" || limit === "0") {
      onSetLimit(null); // No limit
    } else if (!isNaN(numLimit) && numLimit > 0) {
      onSetLimit(numLimit);
    }
  };

  const numericLimit = parseFloat(limit) || 0;
  const canSetLimit = limit === "" || (numericLimit >= 0 && numericLimit <= projectBalance);
  const usagePercentage = currentLimit && currentLimit > 0 ? Math.min((currentSpending / currentLimit) * 100, 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface-1 border-subtle p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-subtle/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-primary">
                Manage User Credits
              </DialogTitle>
              <DialogDescription className="text-sm text-tertiary mt-0.5">
                Set credit limit for this user
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* User Info Card */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-subtle bg-surface-2">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/20 to-accent-primary/20 flex items-center justify-center">
              <User className="h-6 w-6 text-accent-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary truncate">{memberName}</p>
              <p className="text-xs text-tertiary truncate">{memberEmail}</p>
            </div>
          </div>

          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-subtle bg-surface-2">
              <p className="text-xs text-tertiary mb-1.5">Current Spending</p>
              <p className="text-xl font-bold text-primary tracking-tight">
                ${currentSpending.toFixed(2)}
              </p>
              {currentLimit && currentLimit > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        usagePercentage >= 90 ? "bg-rose-400" : usagePercentage >= 70 ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-tertiary mt-1">{usagePercentage.toFixed(0)}% used</p>
                </div>
              )}
            </div>
            <div className="p-4 rounded-xl border border-subtle bg-surface-2">
              <p className="text-xs text-tertiary mb-1.5">Current Limit</p>
              <p className="text-xl font-bold text-primary tracking-tight">
                {currentLimit !== null ? `$${currentLimit.toFixed(2)}` : "No limit"}
              </p>
              {currentLimit === null && (
                <p className="text-[10px] text-tertiary mt-2">Unlimited access</p>
              )}
            </div>
          </div>

          {/* Project Balance Info */}
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <WarningCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" weight="fill" />
            <div>
              <p className="text-xs font-medium text-amber-400">Project Wallet Balance</p>
              <p className="text-sm font-bold text-primary mt-0.5">
                ${projectBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-tertiary mt-1">
                User limit cannot exceed this amount
              </p>
            </div>
          </div>

          {/* Set Limit Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">New Credit Limit ($)</Label>
            <div className="relative">
              <CurrencyDollar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
              <Input
                type="number"
                placeholder="Leave empty for no limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="pl-9 h-11 bg-surface-2 border-subtle text-primary text-lg font-medium"
                min="0"
                step="0.01"
              />
            </div>
            {numericLimit > projectBalance && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-rose-400" />
                Limit cannot exceed project wallet balance (${projectBalance.toFixed(2)})
              </p>
            )}
          </div>

          {/* Reset Spending */}
          {currentSpending > 0 && (
            <div className="pt-4 border-t border-subtle/50">
              <Button
                variant="outline"
                onClick={onResetSpending}
                disabled={isResettingSpending}
                className="w-full h-10 bg-surface-2 border-subtle text-secondary hover:text-primary hover:bg-surface-3 flex items-center justify-center gap-2"
              >
                {isResettingSpending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current/30 border-t-current animate-spin rounded-full" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <ArrowCounterClockwise className="h-4 w-4" />
                    Reset Spending to $0.00
                  </>
                )}
              </Button>
            </div>
          )}
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
            onClick={handleSetLimit}
            disabled={!canSetLimit || isSettingLimit}
            className="h-10 px-5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium shadow-sm shadow-accent-primary/20"
          >
            {isSettingLimit ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                Saving...
              </div>
            ) : (
              "Save Limit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
