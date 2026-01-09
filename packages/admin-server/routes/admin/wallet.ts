import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getWalletTransactions } from "../../controllers/admin/walletController";

const router = Router();

router.get("/", requireAdmin, getWalletTransactions);

export default router;
