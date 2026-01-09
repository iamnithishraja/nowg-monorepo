import { ArrowRight, CurrencyDollar } from "@phosphor-icons/react";
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
import { Textarea } from "~/components/ui/textarea";
import type { ProjectType } from "./index";

interface TransferFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectType | null;
  amount: string;
  description: string;
  orgBalance: number | undefined;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export function TransferFundsDialog({
  open,
  onOpenChange,
  project,
  amount,
  description,
  orgBalance,
  onAmountChange,
  onDescriptionChange,
  onSubmit,
  onReset,
  isLoading,
}: TransferFundsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onReset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" weight="bold" />
            Transfer Credits to Project
          </DialogTitle>
          <DialogDescription>
            Transfer credits from organization wallet to this project wallet.
            This is an atomic transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-primary">Project</Label>
            <div className="mt-2 p-3 border border-subtle rounded-md bg-surface-2">
              <p className="font-medium text-primary">
                {project?.name || "No project selected"}
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="transfer-amount" className="text-primary">Amount (Credits)</Label>
            <div className="relative mt-2">
              <CurrencyDollar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
              <Input
                id="transfer-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={orgBalance}
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-10 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff]"
              />
            </div>
            <p className="text-xs text-tertiary mt-1">
              Available balance:{" "}
              {orgBalance !== undefined ? `$${orgBalance.toFixed(2)}` : "$0.00"}
            </p>
          </div>
          <div>
            <Label htmlFor="transfer-description" className="text-primary">Description (Optional)</Label>
            <Textarea
              id="transfer-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g., Initial project funding, Monthly allocation..."
              rows={3}
              className="mt-2 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#7b4cff]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !amount || !project}
          >
            {isLoading ? "Transferring..." : "Transfer Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

