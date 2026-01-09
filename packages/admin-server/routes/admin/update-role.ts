import { Router } from "express";
import { requireFullAdmin } from "../../middleware/betterAuthMiddleware";
import { updateRole } from "../../controllers/admin/updateRoleController";

const router = Router();

router.post("/", requireFullAdmin, updateRole);

export default router;
