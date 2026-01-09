import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getOrCreateUserProjectWallet,
  getUserWalletsForProject,
  getProjectWalletsForUser,
  transferFromProjectToUser,
  transferFromOrgToUser,
  addCreditsToUserWallet,
  deductCreditsFromUserWallet,
  getUserWalletTransactions,
  setUserProjectWalletLimit,
} from "../../controllers/admin/userProjectWalletController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/user-project-wallets/project/:projectId - Get all user wallets for a project
router.get("/project/:projectId", getUserWalletsForProject);

// GET /api/admin/user-project-wallets/user/:userId - Get all project wallets for a user
router.get("/user/:userId", getProjectWalletsForUser);

// GET /api/admin/user-project-wallets/:projectId/:userId - Get or create wallet for a user in a project
router.get("/:projectId/:userId", getOrCreateUserProjectWallet);

// POST /api/admin/user-project-wallets/:projectId/:userId/transfer-from-project - Transfer from project wallet to user wallet
router.post(
  "/:projectId/:userId/transfer-from-project",
  transferFromProjectToUser
);

// POST /api/admin/user-project-wallets/:projectId/:userId/transfer-from-org - Transfer from org wallet to user wallet (DISABLED - use org->project->user flow)
// router.post("/:projectId/:userId/transfer-from-org", transferFromOrgToUser);

// POST /api/admin/user-project-wallets/:projectId/:userId/credit-back-to-project - Credit back from user wallet to project wallet (DISABLED - users don't have balance)
// router.post(
//   "/:projectId/:userId/credit-back-to-project",
//   creditBackFromUserToProject
// );

// POST /api/admin/user-project-wallets/:projectId/:userId/add-credits - Add credits directly (admin only)
router.post("/:projectId/:userId/add-credits", addCreditsToUserWallet);

// POST /api/admin/user-project-wallets/:projectId/:userId/deduct-credits - Deduct credits from user wallet
router.post("/:projectId/:userId/deduct-credits", deductCreditsFromUserWallet);

// GET /api/admin/user-project-wallets/:projectId/:userId/transactions - Get user wallet transactions
router.get("/:projectId/:userId/transactions", getUserWalletTransactions);

// PUT /api/admin/user-project-wallets/:projectId/:userId/set-limit - Set wallet limit for user
router.put("/:projectId/:userId/set-limit", setUserProjectWalletLimit);

export default router;
