/**
 * Helper functions for wallet operations
 */

/**
 * Calculate total amount received from a specific source
 */
export function calculateTotalReceived(
  transactions: any[],
  source: "project_wallet" | "org_wallet" | "direct"
): number {
  return transactions
    .filter((t) => t.type === "credit" && t.source === source)
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate total amount received from org wallet (for project wallets)
 */
export function calculateTotalReceivedFromOrg(transactions: any[]): number {
  return transactions
    .filter(
      (t) => t.type === "credit" && t.relatedOrgWalletTransactionId !== null
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate total amount already credited back
 */
export function calculateTotalCreditedBack(
  transactions: any[],
  source?: "project_wallet" | "org_wallet"
): number {
  return transactions
    .filter((t) => {
      const isCreditBack = t.type === "debit" && t.isCreditBack === true;
      if (source) {
        return isCreditBack && t.source === source;
      }
      return isCreditBack;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate maximum allowed credit-back amount
 */
export function calculateMaxCreditBack(
  currentBalance: number,
  totalReceived: number,
  totalCreditedBack: number
): number {
  return Math.min(currentBalance, totalReceived - totalCreditedBack);
}

/**
 * Validate credit-back amount
 */
export function validateCreditBackAmount(
  amount: number,
  maxAllowed: number,
  currentBalance: number,
  totalReceived: number,
  totalCreditedBack: number
): { valid: boolean; error?: string; details?: any } {
  if (amount > maxAllowed) {
    return {
      valid: false,
      error: `Cannot credit back $${amount.toFixed(
        2
      )}. Maximum allowed: $${maxAllowed.toFixed(2)}.`,
      details: {
        maxAllowed,
        currentBalance,
        totalReceived,
        alreadyCreditedBack: totalCreditedBack,
      },
    };
  }
  return { valid: true };
}

/**
 * Create a transaction object
 */
export function createTransaction(
  type: "credit" | "debit",
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  description: string,
  performedBy: string,
  options?: {
    source?: "project_wallet" | "org_wallet" | "direct" | "usage_deduction";
    isCreditBack?: boolean;
    relatedProjectWalletTransactionId?: string | null;
    relatedOrgWalletTransactionId?: string | null;
    fromAddress?: string | null;
    toAddress?: string | null;
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
