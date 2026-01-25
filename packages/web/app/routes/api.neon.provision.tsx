import { TeamMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import Conversation from "~/models/conversationModel";

// DataDock API base URL for managed Neon projects (from database)
function getDatadockApiUrl(): string {
  return getEnvWithDefault("DATADOCK_URL", "");
}

/**
 * API Route: Provision Neon for a conversation
 * POST /api/neon/provision
 *
 * Creates or enables a managed Neon database project via DataDock API
 */
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
    }

    if (enable === false) {
      // Disable Neon for this conversation
      convo.neon = { ...convo.neon, enabled: false };
      convo.dbProvider = null;
      await convo.save();
      return new Response(JSON.stringify({ success: true, neon: convo.neon }), {
        status: 200,
      });
    }

    // Get DataDock API URL from database
    const datadockApiUrl = getDatadockApiUrl();
    if (!datadockApiUrl) {
      return new Response(
        JSON.stringify({
          error: "DATADOCK_NOT_CONFIGURED",
          message: "DataDock API URL is not configured on the server.",
        }),
        { status: 500 }
      );
    }

    // Check if already provisioned
    if (convo.neon?.projectId && convo.neon?.apiKey) {
      // Already provisioned, just enable
      convo.neon.enabled = true;
      convo.dbProvider = "neon";
      await convo.save();
      return new Response(JSON.stringify({ success: true, neon: convo.neon }), {
        status: 200,
      });
    }

    // Create a new project via DataDock API
    const projectName = `nowgai-${conversationId.slice(-8)}`;

    const createResponse = await fetch(`${datadockApiUrl}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": datadockApiUrl,
      },
      body: JSON.stringify({
        name: projectName,
        metadata: {
          conversationId,
          userId: session.user.id,
          createdBy: "nowgai",
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("DataDock project creation failed:", errorText);
      return new Response(
        JSON.stringify({
          error: "PROVISION_FAILED",
          message: "Failed to create Neon project via DataDock API",
          details: errorText,
        }),
        { status: 500 }
      );
    }

    const projectData = await createResponse.json();

    // Store the project credentials
    convo.neon = {
      enabled: true,
      projectId: projectData.id || projectData.projectId,
      endpoint: projectData.endpoint || datadockApiUrl,
      apiKey: projectData.apiKey || datadockApiUrl,
      createdAt: new Date(),
    };
    convo.dbProvider = "neon";
    await convo.save();

    console.log("✅ Neon project provisioned via DataDock:", {
      conversationId,
      projectId: convo.neon.projectId,
    });

    return new Response(JSON.stringify({ success: true, neon: convo.neon }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error provisioning Neon:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to provision Neon",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 }
    );
  }
}
