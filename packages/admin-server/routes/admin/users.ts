import { Router } from "express";
import {
  requireAdmin,
  requireFullAdmin,
} from "../../middleware/betterAuthMiddleware";
import {
  getUsers,
  updateUserRole,
  sendVerificationEmailToUser,
  sendVerificationEmailsToAllUnverified,
} from "../../controllers/admin/usersController";

const router = Router();

router.get("/", requireAdmin, getUsers);
router.post("/", requireFullAdmin, updateUserRole); // Only full admins can update roles globally
router.post("/send-verification-email", requireFullAdmin, sendVerificationEmailToUser);
router.post("/send-verification-emails-all", requireFullAdmin, sendVerificationEmailsToAllUnverified);

export default router;
