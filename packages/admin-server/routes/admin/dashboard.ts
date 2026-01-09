import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getDashboardStats } from "../../controllers/admin/dashboardController";

const router = Router();

router.get("/stats", requireAdmin, getDashboardStats);

export default router;
