import { SupportTicket } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";

/**
 * GET /api/admin/support-tickets
 * List all support tickets (full admins only). Supports ?status=open|resolved
 */
export async function getSupportTickets(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can view support tickets",
      });
    }

    const { status } = req.query;
    const query: any = {};
    if (status === "open" || status === "resolved") {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const formatted = tickets.map((t: any) => ({
      id: t._id.toString(),
      userId: t.userId,
      userEmail: t.userEmail,
      userName: t.userName,
      subject: t.subject,
      message: t.message,
      phone: t.phone,
      countryCode: t.countryCode,
      company: t.company,
      status: t.status,
      resolvedAt: t.resolvedAt,
      resolvedBy: t.resolvedBy,
      adminNotes: t.adminNotes,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.json({ tickets: formatted });
  } catch (error: any) {
    console.error("Error fetching support tickets:", error);
    return res.status(500).json({
      error: "Failed to fetch support tickets",
      message: error.message,
    });
  }
}

/**
 * POST /api/admin/support-tickets/:ticketId/resolve
 * Mark a ticket as resolved with optional admin notes
 */
export async function resolveTicket(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can resolve support tickets",
      });
    }

    const { ticketId } = req.params;
    const { adminNotes } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.status === "resolved") {
      return res.status(400).json({ error: "Ticket is already resolved" });
    }

    ticket.status = "resolved";
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = adminUser?.email || adminUser?.id || "admin";
    ticket.adminNotes = adminNotes?.trim() || "";
    ticket.updatedAt = new Date();
    await ticket.save();

    return res.json({
      success: true,
      ticket: {
        id: ticket._id.toString(),
        status: ticket.status,
        resolvedAt: ticket.resolvedAt,
        resolvedBy: ticket.resolvedBy,
        adminNotes: ticket.adminNotes,
      },
    });
  } catch (error: any) {
    console.error("Error resolving support ticket:", error);
    return res.status(500).json({
      error: "Failed to resolve support ticket",
      message: error.message,
    });
  }
}
