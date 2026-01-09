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

interface TransferDialogProps {
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

export function TransferDialog({
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
}: TransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Transfer Credits from Organization
          </DialogTitle>
          <DialogDescription>
            Transfer credits from the organization wallet to this project
            wallet. This is an atomic transaction.
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
            <Label htmlFor="transfer-amount">Amount (Credits)</Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="transfer-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={orgBalance}
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
          </div>
          <div>
            <Label htmlFor="transfer-description">Description (Optional)</Label>
            <Textarea
              id="transfer-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g., Initial project funding, Monthly allocation..."
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
          <Button onClick={onSubmit} disabled={isLoading || !amount}>
            {isLoading ? "Transferring..." : "Transfer Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
