import { Router } from "express";
import { requireFullAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getUniversalLedger,
  getUserBalances,
  getWalletSummary,
  getOrganizationsForFilter,
  getProjectsForFilter,
  downloadLedgerPDF,
} from "../../controllers/admin/universalLedgerController";

const router = Router();

// Universal transaction ledger - Full admin only (ADMIN, TECH_SUPPORT)
router.get("/", requireFullAdmin, getUniversalLedger);

// User balances across projects - Full admin only
router.get("/user-balances", requireFullAdmin, getUserBalances);

// Wallet summary stats - Full admin only
router.get("/summary", requireFullAdmin, getWalletSummary);

// Filter options - Full admin only
router.get("/organizations", requireFullAdmin, getOrganizationsForFilter);
router.get("/projects", requireFullAdmin, getProjectsForFilter);

// Download PDF - Full admin only
router.get("/download-pdf", requireFullAdmin, downloadLedgerPDF);

export default router;
