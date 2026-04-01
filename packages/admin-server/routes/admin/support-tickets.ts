import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getSupportTickets,
  resolveTicket,
  getCallRequests,
  resolveCallRequest,
} from "../../controllers/admin/supportTicketsController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/support-tickets - List all support tickets
router.get("/", getSupportTickets);

// POST /api/admin/support-tickets/:ticketId/resolve - Resolve a ticket
router.post("/:ticketId/resolve", resolveTicket);

// GET /api/admin/support-tickets/calls - List all call requests
router.get("/calls", getCallRequests);

// POST /api/admin/support-tickets/calls/:callId/resolve - Resolve a call request
router.post("/calls/:callId/resolve", resolveCallRequest);

export default router;
