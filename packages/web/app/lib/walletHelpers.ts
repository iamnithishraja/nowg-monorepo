/**
 * Re-export wallet helper utilities from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
  calculateTotalReceived,
  calculateTotalReceivedFromOrg,
  calculateTotalCreditedBack,
  calculateMaxCreditBack,
  validateCreditBackAmount,
  createTransaction,
  getLastTransactionId,
  type Transaction,
  type TransactionType,
  type TransactionSource,
  type Wallet,
  type CreditBackValidationResult,
} from "@nowgai/shared/utils";
  }
) {
  return {
    type,
    amount,
    balanceBefore,
    balanceAfter,
    description: description.trim(),
    performedBy,
    source: options?.source || "direct",
    isCreditBack: options?.isCreditBack || false,
    relatedProjectWalletTransactionId:
      options?.relatedProjectWalletTransactionId || null,
    relatedOrgWalletTransactionId:
      options?.relatedOrgWalletTransactionId || null,
    fromAddress: options?.fromAddress || null,
    toAddress: options?.toAddress || null,
    createdAt: new Date(),
  };
}

/**
 * Get transaction ID from the last transaction in a wallet
 */
export function getLastTransactionId(wallet: any): string | null {
  if (!wallet.transactions || wallet.transactions.length === 0) {
    return null;
  }
  const lastTx = wallet.transactions[wallet.transactions.length - 1];
  return lastTx._id?.toString() || null;
}

