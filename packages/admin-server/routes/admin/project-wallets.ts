import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getOrCreateProjectWallet,
  transferFundsToProject,
  addCreditsToProject,
  getProjectWalletTransactions,
  createProjectStripeCheckout,
  verifyProjectStripePayment,
  creditBackFromProjectToOrg,
} from "../../controllers/admin/projectWalletController";
import { getProjectWalletLedger } from "../../controllers/admin/projectWalletLedgerController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/project-wallets/:projectId - Get or create wallet for a project
router.get("/:projectId", getOrCreateProjectWallet);

// POST /api/admin/project-wallets/:projectId/transfer-from-org - Transfer funds from org to project wallet
router.post("/:projectId/transfer-from-org", transferFundsToProject);

// POST /api/admin/project-wallets/:projectId/credit-back-to-org - Credit back from project wallet to org wallet
router.post("/:projectId/credit-back-to-org", creditBackFromProjectToOrg);

// POST /api/admin/project-wallets/:projectId/add-credits - Add credits directly to project wallet (admin only)
router.post("/:projectId/add-credits", addCreditsToProject);

// GET /api/admin/project-wallets/:projectId/transactions - Get project wallet transactions
router.get("/:projectId/transactions", getProjectWalletTransactions);

// GET /api/admin/project-wallets/:projectId/ledger - Get ledger (all credits) for project wallet
router.get("/:projectId/ledger", getProjectWalletLedger);

// POST /api/admin/project-wallets/:projectId/stripe-checkout - Create Stripe checkout for project wallet
router.post("/:projectId/stripe-checkout", createProjectStripeCheckout);

// POST /api/admin/project-wallets/:projectId/stripe-verify - Verify Stripe payment and transfer to project wallet
router.post("/:projectId/stripe-verify", verifyProjectStripePayment);

export default router;
