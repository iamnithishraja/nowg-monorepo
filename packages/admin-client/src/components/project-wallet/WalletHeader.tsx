import {
  Wallet,
  FolderKanban,
  Building2,
  CreditCard,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletData } from "./types";

interface WalletHeaderProps {
  wallet: WalletData | undefined;
  isProjectAdmin: boolean;
  isOrgAdmin: boolean;
  canAddFunds?: boolean; // Only org admins and system admins can add funds
  onBack: () => void;
  onAddFunds: () => void;
  onTransfer: () => void;
  onCreditBack: () => void;
  onViewFundRequests?: () => void;
  projectId?: string;
}

export function WalletHeader({
  wallet,
  isProjectAdmin,
  isOrgAdmin,
  canAddFunds = false,
  onBack,
  onAddFunds,
  onTransfer,
  onCreditBack,
  onViewFundRequests,
  projectId,
}: WalletHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeftIcon className="h-5 w-5" />
      </Button>
      <div className="flex-1">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          Project Wallet
        </h1>
        {wallet && (
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              {wallet.projectName}
            </p>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {wallet.organizationName}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isProjectAdmin && !isOrgAdmin && wallet && (
          <>
            {/* Project admins request funds instead of transferring */}
            {onViewFundRequests && projectId && (
              <Button variant="outline" onClick={onViewFundRequests}>
                <DollarSign className="h-4 w-4 mr-2" />
                View Requests
              </Button>
            )}
            <Button onClick={onTransfer}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Request Funds
            </Button>
          </>
        )}
        {isOrgAdmin && wallet && (
          <>
            {canAddFunds && (
              <Button onClick={onAddFunds}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Funds
              </Button>
            )}
            <Button onClick={onTransfer}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Transfer from Org
            </Button>
            {onViewFundRequests && (
              <Button variant="outline" onClick={onViewFundRequests}>
                <DollarSign className="h-4 w-4 mr-2" />
                Fund Requests
              </Button>
            )}
            {wallet.balance > 0 && (
              <Button variant="outline" onClick={onCreditBack}>
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Credit Back to Org
              </Button>
            )}
          </>
        )}
        {/* System admins can also add funds */}
        {!isOrgAdmin && !isProjectAdmin && canAddFunds && wallet && (
          <Button onClick={onAddFunds}>
            <CreditCard className="h-4 w-4 mr-2" />
            Add Funds
          </Button>
        )}
      </div>
    </div>
  );
}
