import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Plus, CreditCard as CreditCardIcon } from "lucide-react";

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Credits
          </DialogTitle>
          <DialogDescription>
            Add credits to your organization's wallet. Payment method will be selected based on your location. 1
            credit = $1 (1:1 ratio)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the amount you want to pay. You'll receive the same amount
              in credits (1:1 ratio).
            </p>
          </div>

          {/* Payment Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <CreditCardIcon className="h-5 w-5 text-primary" />
                <span className="font-medium">Secure Payment</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount to Pay:</span>
                <span className="font-medium">
                  ${parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Credits You'll Receive:
                </span>
                <span className="font-medium text-green-600">
                  ${parseFloat(amount).toFixed(2)} credits
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm font-medium">
                  <span>Total:</span>
                  <span>${parseFloat(amount).toFixed(2)}</span>
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
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !amount}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                <CreditCardIcon className="h-4 w-4 mr-2" />
                Proceed to Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
