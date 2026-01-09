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
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, ArrowLeft as ArrowLeftIcon } from "lucide-react";
import { WalletData } from "./types";
import { formatCurrency } from "./utils";

interface CreditBackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletData | undefined;
  amount: string;
  description: string;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
}

export function CreditBackDialog({
  open,
  onOpenChange,
  wallet,
  amount,
  description,
  onAmountChange,
  onDescriptionChange,
  isLoading,
  onSubmit,
}: CreditBackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftIcon className="h-5 w-5" />
            Credit Back to Organization Wallet
          </DialogTitle>
          <DialogDescription>
            Credit back unused funds from this project wallet to the
            organization wallet. Only funds received from the organization can
            be credited back.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Project</Label>
            <div className="mt-2 p-3 border rounded-md bg-muted/50">
              <p className="font-medium">
                {wallet?.projectName || "Loading..."}
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="credit-back-amount">Amount (Credits)</Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="credit-back-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={wallet?.balance}
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {wallet && (
              <p className="text-xs text-muted-foreground mt-1">
                Current balance: {formatCurrency(wallet.balance)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="credit-back-description">
              Description (Optional)
            </Label>
            <Textarea
              id="credit-back-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Reason for credit back..."
              className="mt-2"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onAmountChange("");
              onDescriptionChange("");
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
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Credit Back
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
