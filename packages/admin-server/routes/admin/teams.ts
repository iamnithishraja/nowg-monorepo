import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import { getTeams } from "../../controllers/admin/teamsController";

const router = Router();

router.get("/", requireAdmin, getTeams);

export default router;
