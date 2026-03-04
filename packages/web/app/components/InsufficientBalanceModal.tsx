import React from "react";
import { useNavigate } from "react-router";
import { CreditCard, AlertTriangle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorData?: {
    error?: string;
    errorType?: string;
    requiresRecharge?: boolean;
    currentSpending?: number;
    limit?: number;
    balance?: number;
  };
  /** When true, the modal cannot be dismissed - user must recharge */
  persistent?: boolean;
}

export function InsufficientBalanceModal({
  isOpen,
  onClose,
  errorData,
  persistent = false,
}: InsufficientBalanceModalProps) {
  const navigate = useNavigate();

  // Determine error type from error data
  const getErrorType = () => {
    // Use errorType from API if available
    if (errorData?.errorType) {
      return errorData.errorType;
    }
    
    // Fallback to parsing error message
    if (!errorData?.error) return "insufficient_balance";
    
    const errorMsg = errorData.error.toLowerCase();
    if (errorMsg.includes("spending limit") || errorMsg.includes("reached your") || errorMsg.includes("limit is fully used")) {
      return "user_limit_exceeded";
    }
    if (errorMsg.includes("project wallet") && (errorMsg.includes("insufficient") || errorMsg.includes("balance") || errorMsg.includes("funds"))) {
      return "project_wallet_empty";
    }
    if (errorMsg.includes("project wallet not found")) {
      return "project_wallet_not_found";
    }
    return "insufficient_balance";
  };

  const errorType = getErrorType();

  const getTitle = () => {
    switch (errorType) {
      case "user_limit_exceeded":
        return "Spending Limit Reached";
      case "project_wallet_empty":
      case "project_wallet_not_found":
        return "Project Wallet Issue";
      default:
        return "Insufficient Balance";
    }
  };

  const getDescription = () => {
    switch (errorType) {
      case "user_limit_exceeded":
        return "Your spending limit for this project has been fully used. Please ask your project admin to increase your limit to continue.";
      case "project_wallet_empty":
        return "The project wallet has insufficient balance. Please ask your organization or project admin to add funds to the project wallet.";
      case "project_wallet_not_found":
        return "The project wallet has not been created. Please ask your organization or project admin to create and add funds to the project wallet.";
      default:
        return "Your account balance is too low to continue. Please recharge your account to keep building amazing projects.";
    }
  };

  const showRechargeButton = errorType === "insufficient_balance";

  const handleRecharge = () => {
    onClose();
    navigate("/recharge");
  };

  // Handle dialog open change - prevent closing if persistent
  const handleOpenChange = (open: boolean) => {
    if (!open && persistent) {
      // Don't allow closing when persistent
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {/* Custom darker overlay with subtle blur */}
        <DialogOverlay className="bg-black/70 backdrop-blur-[2px]" />

        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md border-0 bg-background/95 backdrop-blur-xl shadow-2xl"
          onPointerDownOutside={persistent ? (e) => e.preventDefault() : undefined}
          onEscapeKeyDown={persistent ? (e) => e.preventDefault() : undefined}
        >
          {/* Close button - hidden when persistent */}
          {!persistent && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 hover:opacity-100 transition-all hover:bg-accent z-10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}

          <DialogHeader className="text-center space-y-6 pt-2">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
              <AlertTriangle className="h-12 w-12 text-orange-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-foreground">
                {getTitle()}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground px-4">
                {getDescription()}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="flex-col gap-3 sm:flex-row mt-6">
            {!persistent && (
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto border-border hover:bg-accent"
              >
                Close
              </Button>
            )}
            {showRechargeButton && (
              <Button
                onClick={handleRecharge}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Recharge Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
