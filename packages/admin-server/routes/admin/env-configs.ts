import { Router } from "express";
import { requireFullAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getEnvConfigs,
  updateEnvConfigs,
} from "../../controllers/admin/envConfigsController";

const router = Router();

router.get("/", requireFullAdmin, getEnvConfigs);
router.post("/", requireFullAdmin, updateEnvConfigs);

export default router;
