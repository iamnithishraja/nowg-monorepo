import { Router } from "express";
import {
  getUserAnalytics,
  getProjectAnalytics,
  getOrganizationAnalytics,
  getOrganizationWalletAnalytics,
  getProjectWalletAnalytics,
} from "../../controllers/admin/analyticsController";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";

const router = Router();

// All analytics routes require admin access (checked in controller for specific permissions)
router.get("/user/:userId", requireAdmin, getUserAnalytics);
router.get("/project/:projectId", requireAdmin, getProjectAnalytics);
router.get(
  "/organization/:organizationId",
  requireAdmin,
  getOrganizationAnalytics
);
router.get(
  "/wallet/organization/:organizationId",
  requireAdmin,
  getOrganizationWalletAnalytics
);
router.get(
  "/wallet/project/:projectId",
  requireAdmin,
  getProjectWalletAnalytics
);

export default router;


