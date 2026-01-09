import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  createFundRequest,
  getFundRequests,
  approveFundRequest,
  rejectFundRequest,
} from "../../controllers/admin/fundRequestController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// POST /api/admin/fund-requests - Create a fund request (project admin)
router.post("/", createFundRequest);

// GET /api/admin/fund-requests - Get fund requests (filtered by role)
router.get("/", getFundRequests);

// POST /api/admin/fund-requests/:requestId/approve - Approve a fund request (org admin)
router.post("/:requestId/approve", approveFundRequest);

// POST /api/admin/fund-requests/:requestId/reject - Reject a fund request (org admin)
router.post("/:requestId/reject", rejectFundRequest);

export default router;
