import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getSupportTickets,
  resolveTicket,
} from "../../controllers/admin/supportTicketsController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/support-tickets - List all support tickets
router.get("/", getSupportTickets);

// POST /api/admin/support-tickets/:ticketId/resolve - Resolve a ticket
router.post("/:ticketId/resolve", resolveTicket);

export default router;
