import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { getSupportTicketModel } from "~/models/supportTicketModel";

// GET /api/support-tickets - list the current user's own tickets
export async function loader({ request }: LoaderFunctionArgs) {
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

    await connectToDatabase();
    const SupportTicket = getSupportTicketModel();

    const tickets = await SupportTicket.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return new Response(JSON.stringify({ tickets }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch support tickets" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST /api/support-tickets - create a new support ticket
export async function action({ request }: ActionFunctionArgs) {
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

    const body = await request.json();
    const { subject, message, phone, countryCode, company } = body;

    if (!subject?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectToDatabase();
    const SupportTicket = getSupportTicketModel();

    const ticket = await SupportTicket.create({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name || "",
      subject: subject.trim(),
      message: message.trim(),
      phone: phone?.trim() || "",
      countryCode: countryCode?.trim() || "",
      company: company?.trim() || "",
      status: "open",
    });

    return new Response(JSON.stringify({ success: true, ticket }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create support ticket" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
