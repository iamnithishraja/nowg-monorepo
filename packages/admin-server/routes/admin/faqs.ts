import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getFaqs,
  getPublicFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} from "../../controllers/admin/faqController";

const router = Router();

// Public route (requires auth but not admin) — returns published FAQs for web users
router.get("/public", getPublicFaqs);

// All routes below require admin authentication
router.use(requireAdmin);

// GET /api/admin/faqs - List all FAQs
router.get("/", getFaqs);

// POST /api/admin/faqs - Create a new FAQ
router.post("/", createFaq);

// PUT /api/admin/faqs/:faqId - Update a FAQ
router.put("/:faqId", updateFaq);

// DELETE /api/admin/faqs/:faqId - Delete a FAQ
router.delete("/:faqId", deleteFaq);

export default router;
