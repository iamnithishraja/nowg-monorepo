import type { LoaderFunctionArgs } from "react-router";
import SupabaseIntegration from "~/models/supabaseIntegrationModel";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import { SupabaseOAuthManager } from "../lib/supabase-oauth-manager";

/**
 * API Route: Supabase OAuth Callback
 * GET /api/supabase/callback
 *
 * Handles OAuth callback from Supabase and stores integration
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    const errorDescription = url.searchParams.get("error_description");
    console.error("❌ [Supabase OAuth Callback] Error from Supabase:", {
      error,
      errorDescription,
      fullUrl: request.url,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?supabase_error=${encodeURIComponent(error)}${
          errorDescription
            ? `&error_desc=${encodeURIComponent(errorDescription)}`
            : ""
        }`,
      },
    });
  }

  // Validate required parameters
  if (!code || !state) {
    console.error("Missing code or state parameter");
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?supabase_error=missing_parameters",
      },
    });
  }

  try {
    // Verify state
    const cookies = request.headers.get("Cookie");
    const stateCookie = cookies
      ?.split(";")
      .find((c) => c.trim().startsWith("supabase_oauth_state="))
      ?.split("=")[1]
      ?.trim();

    if (!stateCookie || stateCookie !== state) {
      console.error("Invalid state parameter");
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?supabase_error=invalid_state",
        },
      });
    }

    // Check authentication
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/?supabase_error=authentication_required",
        },
      });
    }

    const userId = session.user.id;

    // Ensure MongoDB connection and env vars are loaded from database
    await connectToDatabase();

    // Get the origin from the request to construct the redirect URI dynamically
    const origin = url.origin;
    const redirectUri = `${origin}/api/supabase/callback`;

    const supabaseManager = new SupabaseOAuthManager(redirectUri);

    // Exchange code for access token
    const token = await supabaseManager.exchangeCodeForToken(code);

    // Get user info
    const user = await supabaseManager.getUserInfo(token.access_token);

    // Store or update integration
    await SupabaseIntegration.findOneAndUpdate(
      { userId },
      {
        userId,
        supabaseUserId: user.id,
        supabaseEmail: user.email,
        accessToken: token.access_token,
        organizationId: user.id,
        organizationName: user.name || undefined,
        lastUsedAt: new Date(),
        $setOnInsert: { connectedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    // Clear state cookie
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/home?supabase_connected=true",
        "Set-Cookie":
          "supabase_oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
      },
    });
  } catch (error) {
    console.error("❌ [Supabase OAuth Callback] Error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?supabase_error=${encodeURIComponent(
          error instanceof Error ? error.message : "oauth_callback_failed"
        )}`,
      },
    });
  }
}
