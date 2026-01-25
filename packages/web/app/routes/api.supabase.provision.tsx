import { TeamMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { provisionSupabaseForConversation } from "~/lib/supabaseManager";
import Conversation from "~/models/conversationModel";
import SupabaseIntegration from "~/models/supabaseIntegrationModel";
export async function action({ request }: ActionFunctionArgs) {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      );
    }

    const { conversationId, enable } = await request.json();
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required" }),
        { status: 400 }
      );
    }

    await connectToDatabase();
    const convo = await Conversation.findById(conversationId);
    if (!convo) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
      });
    }

    // For team projects, verify user is a team member
    // For personal projects, verify user owns the conversation
    if (convo.teamId && convo.projectType === "team") {

      const membership = await TeamMember.findOne({
        teamId: convo.teamId,
        userId: session.user.id,
        status: "active",
      });

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Not a member of this team" }),
          { status: 403 }
        );
      }
    } else {
      // Personal project - must be owner
      if (convo.userId !== session.user.id) {
        return new Response(
          JSON.stringify({
            error: "Not authorized to access this conversation",
          }),
          { status: 403 }
        );
      }
    }

    if (enable === false) {
      // Disable Supabase for this conversation without deleting the project (safe default)
      convo.supabase = { ...convo.supabase, enabled: false };
      convo.dbProvider = null;
      await convo.save();
      return new Response(
        JSON.stringify({ success: true, supabase: convo.supabase }),
        { status: 200 }
      );
    }

    // Check if user has connected their Supabase account
    const integration = await SupabaseIntegration.findOne({
      userId: session.user.id,
    });
    if (!integration) {
      return new Response(
        JSON.stringify({
          error: "SUPABASE_NOT_CONNECTED",
          message:
            "Please connect your Supabase account first before enabling the database feature.",
        }),
        { status: 400 }
      );
    }

    // Provision only if credentials are missing (idempotent per conversation)
    if (
      !convo.supabase?.supabaseUrl ||
      !convo.supabase?.anonKey ||
      !convo.supabase?.ref ||
      !convo.supabase?.projectId
    ) {
      try {
        const result = await provisionSupabaseForConversation(
          conversationId,
          session.user.id
        );
        convo.supabase = {
          enabled: true,
          ref: result.ref,
          projectId: result.projectId,
          supabaseUrl: result.supabaseUrl,
          anonKey: result.anonKey, // Anon key automatically fetched and saved
          createdAt: new Date(),
        } as any;
        convo.dbProvider = "supabase";
        await convo.save();
        console.log(
          "✅ Supabase project provisioned successfully with auto-generated credentials:",
          {
            conversationId,
            ref: result.ref,
            projectId: result.projectId,
            supabaseUrl: result.supabaseUrl,
            hasAnonKey: !!result.anonKey,
            anonKeyLength: result.anonKey?.length || 0,
          }
        );
        return new Response(
          JSON.stringify({ success: true, supabase: convo.supabase }),
          { status: 200 }
        );
      } catch (e: any) {
        const code = e?.code || e?.name;
        const message = e?.message || "Failed to provision Supabase project";
        console.error("❌ Supabase provision error:", {
          code,
          message,
          error: e,
        });

        // Bubble up a specific error if org has reached its project limit
        if (code === "PROJECT_LIMIT_REACHED") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "PROJECT_LIMIT_REACHED",
              message,
            }),
            { status: 402 }
          );
        }

        // Check if it's an authentication/authorization error
        if (
          message.includes("SUPABASE_ACCESS_TOKEN") ||
          message.includes("not set") ||
          message.includes("401") ||
          message.includes("403")
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "SUPABASE_AUTH_ERROR",
              message:
                "Failed to authenticate with Supabase. Please reconnect your Supabase account.",
            }),
            { status: 401 }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "PROVISION_FAILED",
            message,
          }),
          { status: 500 }
        );
      }
    }

    // Already provisioned; just ensure enabled
    convo.supabase.enabled = true;
    convo.dbProvider = "supabase";
    await convo.save();
    return new Response(
      JSON.stringify({ success: true, supabase: convo.supabase }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Supabase provision API error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
