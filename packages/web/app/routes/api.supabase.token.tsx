import type { LoaderFunctionArgs } from "react-router";
import SupabaseIntegration from "~/models/supabaseIntegrationModel";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";

/**
 * API Route: Get Supabase Integration Token
 * GET /api/supabase/token
 *
 * Returns the user's Supabase access token if connected
 */
export async function loader({ request }: LoaderFunctionArgs) {
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

    const integration = await SupabaseIntegration.findOne({
      userId: session.user.id,
    });

    if (!integration) {
      return new Response(
        JSON.stringify({
          hasToken: false,
          token: null,
          user: null,
          organizationId: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        hasToken: true,
        token: integration.accessToken,
        user: {
          id: integration.supabaseUserId,
          email: integration.supabaseEmail,
          name: integration.organizationName,
        },
        organizationId: integration.organizationId || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Supabase token:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Supabase integration",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
