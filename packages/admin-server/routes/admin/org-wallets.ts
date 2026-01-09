import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getOrCreateOrgWallet,
  addCredits,
  getOrgWalletTransactions,
  getAllOrgWallets,
} from "../../controllers/admin/orgWalletController";
import {
  createStripeCheckout,
  verifyStripePayment,
} from "../../controllers/admin/orgWalletStripeController";
import { getOrgWalletLedger } from "../../controllers/admin/orgWalletLedgerController";

const router = Router();

// Get all organization wallets
router.get("/", requireAdmin, getAllOrgWallets);

// Get or create wallet for a specific organization
router.get("/:organizationId", requireAdmin, getOrCreateOrgWallet);

// Get wallet transactions for a specific organization
router.get(
  "/:organizationId/transactions",
  requireAdmin,
  getOrgWalletTransactions
);

// Get ledger (all credits) for a specific organization
router.get(
  "/:organizationId/ledger",
  requireAdmin,
  getOrgWalletLedger
);

// Add credits to an organization wallet
router.post("/:organizationId/add-credits", requireAdmin, addCredits);

// Stripe checkout for adding credits
router.post(
  "/:organizationId/stripe-checkout",
  requireAdmin,
  createStripeCheckout
);

// Verify Stripe payment and add credits
router.post(
  "/:organizationId/stripe-verify",
  requireAdmin,
  verifyStripePayment
);

export default router;
