import type { ActionFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import FigmaIntegration from "../models/figmaIntegrationModel";

/**
 * API Route: Disconnect Figma Account
 * POST /api/figma/disconnect
 *
 * Removes Figma integration for the current user
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Check authentication
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = session.user.id;

    // Ensure MongoDB connection
    await connectToDatabase();

    // Delete the integration
    await FigmaIntegration.findOneAndDelete({ userId });

    console.log("✅ [Figma] Disconnected for user:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Figma account disconnected successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error disconnecting Figma:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to disconnect Figma",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



