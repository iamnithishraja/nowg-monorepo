import {
  CreditCard as CreditCardIcon,
  CurrencyDollar,
  Plus,
} from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
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

interface AddCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
}

export function AddCreditsDialog({
  open,
  onOpenChange,
  amount,
  onAmountChange,
  isLoading,
  onSubmit,
}: AddCreditsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onAmountChange("");
        }
      }}
    >
      <DialogContent className="max-w-md bg-surface-1 border-subtle">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Plus className="h-5 w-5 text-[#7b4cff]" weight="bold" />
            Add Credits
          </DialogTitle>
          <DialogDescription className="text-secondary">
            Add credits to your organization's wallet. Payment method will be
            selected based on your location. 1 credit = $1 (1:1 ratio)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount" className="text-primary">
              Amount (USD)
            </Label>
            <div className="relative mt-2">
              <CurrencyDollar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-10 bg-surface-2 border-subtle text-primary placeholder:text-tertiary"
              />
            </div>
            <p className="text-xs text-tertiary mt-1">
              Enter the amount you want to pay. You'll receive the same amount
              in credits (1:1 ratio).
            </p>
          </div>

          {/* Payment Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-surface-2 rounded-[12px] border border-subtle space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <CreditCardIcon
                  className="h-5 w-5 text-[#7b4cff]"
                  weight="fill"
                />
                <span className="font-medium text-primary">Secure Payment</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Amount to Pay:</span>
                <span className="font-medium text-primary">
                  ${parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">Credits You'll Receive:</span>
                <span className="font-medium text-[#22c55e]">
                  ${parseFloat(amount).toFixed(2)} credits
                </span>
              </div>
              <div className="pt-2 border-t border-subtle">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-primary">Total:</span>
                  <span className="text-primary">
                    ${parseFloat(amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onAmountChange("");
            }}
            className="w-full sm:w-auto bg-surface-2 border-subtle text-primary hover:bg-subtle"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !amount}
            className="w-full sm:w-auto accent-primary hover:bg-[#8c63f2] text-white"
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                <CreditCardIcon className="h-4 w-4 mr-2" weight="fill" />
                Proceed to Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
