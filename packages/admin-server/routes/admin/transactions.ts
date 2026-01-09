import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getTransactions } from "../../controllers/admin/transactionsController";

const router = Router();

router.get("/", requireAdmin, getTransactions);

export default router;
