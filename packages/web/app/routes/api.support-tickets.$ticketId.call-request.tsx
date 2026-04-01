import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { getCallRequestModel, getSupportTicketModel } from "@nowgai/shared/models";
import { sendUserCallRequestConfirmationEmail, sendAdminCallRequestNotificationEmail } from "~/lib/email";
import mongoose from "mongoose";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { ticketId } = params;
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Ticket ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();
    const SupportTicket = getSupportTicketModel();
    const CallRequest = getCallRequestModel();

    const ticket = await SupportTicket.findOne({
      requestId: ticketId,
      userId: session.user.id,
    });

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ticket.phone) {
      return new Response(JSON.stringify({ error: "A phone number is required to request a call" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existingRequest = await CallRequest.findOne({
      ticketId: ticket.requestId,
      status: "open",
    });

    if (existingRequest) {
      return new Response(JSON.stringify({ error: "You already have an open call request for this ticket" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const callRequestId = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

    const callRequest = await CallRequest.create({
      requestId: callRequestId,
      ticketId: ticket.requestId,
      userId: session.user.id,
      userEmail: session.user.email,
      phone: ticket.phone,
      countryCode: ticket.countryCode,
      status: "open",
    });

    // Send emails
    await sendUserCallRequestConfirmationEmail({
      to: session.user.email,
      userName: session.user.name || session.user.email,
      ticketId: ticket.requestId,
    });

    const db = mongoose.connection.db;
    if (db) {
      const admins = await db.collection("user").find({ role: { $in: ["admin", "tech_support"] } }).toArray();
      for (const admin of admins) {
        if (admin.email) {
          await sendAdminCallRequestNotificationEmail({
            to: admin.email,
            userName: session.user.name || session.user.email,
            userEmail: session.user.email,
            userPhone: `${ticket.countryCode} ${ticket.phone}`,
            ticketId: ticket.requestId,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, callRequest }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating call request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create call request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
