import { Router } from "express";
import {
  requireAdmin,
  requireFullAdmin,
} from "../../middleware/betterAuthMiddleware";
import {
  getUsers,
  updateUserRole,
} from "../../controllers/admin/usersController";

const router = Router();

router.get("/", requireAdmin, getUsers);
router.post("/", requireFullAdmin, updateUserRole); // Only full admins can update roles globally

export default router;
