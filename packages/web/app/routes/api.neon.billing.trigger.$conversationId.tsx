import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { processBillingForConversation } from "~/lib/neonBillingService";
import Conversation from "~/models/conversationModel";
import TeamMember from "~/models/teamMemberModel";

/**
 * API Route: Manually Trigger Billing for a Conversation
 * POST /api/neon/billing/trigger/:conversationId
 *
 * Allows manual triggering of billing for a specific conversation.
 * Useful for testing or forcing immediate billing.
 * 
 * Only the conversation owner or team member can trigger this.
 */
export async function action({ request, params }: ActionFunctionArgs) {
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

    // Check access
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

    // Check if Neon is enabled
    if (!conversation.neon?.enabled || !conversation.neon?.projectId) {
      return new Response(
        JSON.stringify({ error: "Neon not enabled for this conversation" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get Neon API key
    const neonApiKey = getEnvWithDefault("NEON_API_KEY", "");
    if (!neonApiKey) {
      return new Response(
        JSON.stringify({ error: "NEON_API_KEY not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Process billing
    console.log(
      `[NeonBilling] Manual billing trigger for conversation: ${conversationId}`
    );
    const result = await processBillingForConversation(
      conversationId,
      neonApiKey
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        result: {
          conversationId: result.conversationId,
          neonProjectId: result.neonProjectId,
          periodsProcessed: result.periodsProcessed,
          totalComputeCost: result.totalComputeCost,
          totalStorageCost: result.totalStorageCost,
          totalCost: result.totalCost,
          amountBilled: result.amountBilled,
          carryForwardCost: result.carryForwardCost,
          walletDeducted: result.walletDeducted,
          walletType: result.walletType,
          error: result.error,
        },
      }),
      {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[NeonBilling] Error triggering billing:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to trigger billing",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

