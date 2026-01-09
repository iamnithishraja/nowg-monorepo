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
import { CreditCard } from "lucide-react";

interface AddFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
}

export function AddFundsDialog({
  open,
  onOpenChange,
  amount,
  onAmountChange,
  isLoading,
  onSubmit,
}: AddFundsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds to Project Wallet</DialogTitle>
          <DialogDescription>
            Add credits to your project wallet. Payment method will be selected based on your location. Funds will
            first be added to your organization wallet, then automatically
            transferred to this project wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="creditAmount">Amount (USD)</Label>
            <Input
              id="creditAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="10.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter the amount you want to add to your project wallet
            </p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">Payment Flow:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Payment is processed securely</li>
              <li>Funds are added to organization wallet</li>
              <li>Funds are automatically transferred to project wallet</li>
            </ol>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onAmountChange("");
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
          >
            {isLoading ? (
              <>Processing...</>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
