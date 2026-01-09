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
import { DollarSign, ArrowRight } from "lucide-react";
import { WalletData } from "./types";
import { formatCurrency } from "./utils";

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletData | undefined;
  orgBalance: number | undefined;
  amount: string;
  description: string;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
}

export function RequestDialog({
  open,
  onOpenChange,
  wallet,
  orgBalance,
  amount,
  description,
  onAmountChange,
  onDescriptionChange,
  isLoading,
  onSubmit,
}: RequestDialogProps) {
  const hasInsufficientFunds =
    orgBalance !== undefined &&
    amount &&
    parseFloat(amount) > orgBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Request Funds from Organization
          </DialogTitle>
          <DialogDescription>
            Request funds from the organization wallet. Your request will be
            reviewed by the organization admin.
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
            <Label htmlFor="request-amount">Amount (Credits)</Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="request-amount"
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
              Organization balance:{" "}
              {orgBalance !== undefined
                ? formatCurrency(orgBalance)
                : "Loading..."}
            </p>
            {hasInsufficientFunds && (
              <p className="text-xs text-destructive mt-1">
                Organization wallet does not have sufficient funds
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="request-description">
              Description (Optional)
            </Label>
            <Textarea
              id="request-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g., Monthly allocation, project expenses..."
              rows={3}
              className="mt-2"
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
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !amount || hasInsufficientFunds}
          >
            {isLoading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

