import type { LoaderFunctionArgs } from "react-router";
import { SupabaseOAuthManager } from "../lib/supabase-oauth-manager";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import { getEnv } from "../lib/env";

/**
 * API Route: Initiate Supabase OAuth Connection
 * GET /api/supabase/connect
 *
 * Redirects user to Supabase OAuth authorization page
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
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Ensure MongoDB connection and env vars are loaded from database
    await connectToDatabase();

    // Get the origin from the request to construct the redirect URI dynamically
    const url = new URL(request.url);

    // Check for X-Forwarded-Proto header to determine the correct protocol
    // This is important when behind a reverse proxy that terminates SSL
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProto || url.protocol.replace(":", "");
    const host = request.headers.get("x-forwarded-host") || url.host;
    const origin = `${protocol}://${host}`;
    const redirectUri = `${origin}/api/supabase/callback`;

    const supabaseManager = new SupabaseOAuthManager(redirectUri);
    const state = supabaseManager.generateState();

    // Store state in session or return it to be stored client-side
    const authUrl = supabaseManager.generateOAuthUrl(state);

    // Debug logging
    const clientId = getEnv("SUPABASE_OAUTH_CLIENT_ID") || "";
    // Redirect to Supabase OAuth
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": `supabase_oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`,
      },
    });
  } catch (error) {
    console.error("Error initiating Supabase OAuth:", error);
    return new Response(
      JSON.stringify({ error: "Failed to initiate Supabase connection" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
