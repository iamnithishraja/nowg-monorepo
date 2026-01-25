/**
 * Re-export wallet helper utilities from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
  calculateMaxCreditBack, calculateTotalCreditedBack, calculateTotalReceived,
  calculateTotalReceivedFromOrg, createTransaction,
  getLastTransactionId, validateCreditBackAmount, type CreditBackValidationResult, type Transaction, type TransactionSource, type TransactionType, type Wallet
} from "@nowgai/shared/utils";

