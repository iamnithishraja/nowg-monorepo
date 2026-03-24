import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { getSupportTicketModel } from "~/models/supportTicketModel";

// Only ADMIN / TECH_SUPPORT can access these endpoints
const ADMIN_ROLES = new Set(["admin", "tech_support"]);

async function requireFullAdmin(request: Request) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });
  if (!session?.user) return null;
  const role = (session.user as any).role as string | undefined;
  if (!role || !ADMIN_ROLES.has(role)) return null;
  return session.user;
}

// GET /api/admin/support-tickets  →  list all tickets (with optional ?status= filter)
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireFullAdmin(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status"); // "open" | "resolved" | null

    await connectToDatabase();
    const SupportTicket = getSupportTicketModel();

    const query: any = {};
    if (statusFilter === "open" || statusFilter === "resolved") {
      query.status = statusFilter;
    }

    const tickets = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return new Response(JSON.stringify({ tickets }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching admin support tickets:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch support tickets" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST /api/admin/support-tickets
// body: { action: "resolve", ticketId, adminNotes? }
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user = await requireFullAdmin(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { action, ticketId, adminNotes } = body;

    if (action !== "resolve") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();
    const SupportTicket = getSupportTicketModel();

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: user.email,
        adminNotes: adminNotes?.trim() || "",
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, ticket }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update support ticket" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
