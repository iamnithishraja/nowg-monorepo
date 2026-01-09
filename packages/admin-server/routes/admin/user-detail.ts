import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getUserDetail } from "../../controllers/admin/userDetailController";

const router = Router();

router.get("/", requireAdmin, getUserDetail);

export default router;
