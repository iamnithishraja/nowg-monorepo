import type { ActionFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import SupabaseIntegration from "../models/supabaseIntegrationModel";

/**
 * API Route: Disconnect Supabase Integration
 * POST /api/supabase/disconnect
 *
 * Removes the user's Supabase integration
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

    await connectToDatabase();

    await SupabaseIntegration.findOneAndDelete({
      userId: session.user.id,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error disconnecting Supabase account:", error);
    return new Response(
      JSON.stringify({ error: "Failed to disconnect Supabase account" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
