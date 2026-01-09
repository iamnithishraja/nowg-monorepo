import { Router } from "express";
import {
  getPaymentSettings,
  updatePaymentSettings,
  deletePaymentSettings,
  getDefaultPaymentSettings,
  updateDefaultPaymentSettings,
} from "../controllers/admin/paymentSettingsController";
import { requireAdmin } from "../middleware/betterAuthMiddleware";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/payment-settings - Get all payment settings
router.get("/", getPaymentSettings);

// GET /api/admin/payment-settings/default - Get default payment provider
router.get("/default", getDefaultPaymentSettings);

// PUT /api/admin/payment-settings/default - Update default payment provider
router.put("/default", updateDefaultPaymentSettings);

// POST /api/admin/payment-settings - Create or update payment settings
router.post("/", updatePaymentSettings);

// DELETE /api/admin/payment-settings/:region - Delete payment settings
router.delete("/:region", deletePaymentSettings);

export default router;
