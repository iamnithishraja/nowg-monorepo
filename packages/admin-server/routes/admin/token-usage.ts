import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getTokenUsage } from "../../controllers/admin/tokenUsageController";

const router = Router();

router.get("/", requireAdmin, getTokenUsage);

export default router;
