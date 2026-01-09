import { Router } from "express";
import { getCurrentUser, checkUserAccess } from "../../controllers/admin/meController";
import { requireAuth } from "../../middleware/betterAuthMiddleware";

const router = Router();

// Get current user with org admin flags
router.get("/", requireAuth, getCurrentUser);

// Check if user has access to admin panel
router.get("/check-access", requireAuth, checkUserAccess);

export default router;
