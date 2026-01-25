import { Conversation, TeamMember } from "@nowgai/shared/models";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { getBillingSummary } from "~/lib/neonBillingService";

/**
 * API Route: Get Neon Billing Status for a Conversation
 * GET /api/neon/billing/:conversationId
 *
 * Returns billing summary and recent usage for a specific conversation's Neon project
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { conversationId } = params;
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectToDatabase();

    // Verify user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check access: user must own the conversation or be a team member
    const userId = session.user.id;
    let hasAccess = conversation.userId === userId;

    if (!hasAccess && conversation.teamId) {
      const membership = await TeamMember.findOne({
        teamId: conversation.teamId,
        userId: userId,
        status: "active",
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this conversation" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if Neon is enabled for this conversation
    if (!conversation.neon?.enabled || !conversation.neon?.projectId) {
      return new Response(
        JSON.stringify({
          error: "Neon not enabled for this conversation",
          neonEnabled: false,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get billing summary
    const result = await getBillingSummary(conversationId);

    if (!result.success) {
      // If no billing record exists yet, return basic info
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            conversationId,
            neonProjectId: conversation.neon.projectId,
            neonEnabled: true,
            status: "pending",
            totalBilledAmount: 0,
            carryForwardCost: 0,
            lastBilledAt: null,
            totalUsageRecords: 0,
            recentUsage: [],
            message: "No billing data yet - billing will start on next hourly run",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...result.data,
          neonEnabled: true,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[NeonBilling] Error getting billing status:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get billing status",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

