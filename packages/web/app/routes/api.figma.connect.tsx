import type { LoaderFunctionArgs } from "react-router";
import { FigmaOAuthManager } from "../lib/figma-oauth-manager";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";

/**
 * API Route: Initiate Figma OAuth Connection
 * GET /api/figma/connect
 *
 * Redirects user to Figma OAuth authorization page
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

    // Ensure MongoDB connection
    await connectToDatabase();

    // Get the origin from the request to construct the redirect URI dynamically
    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/figma/callback`;

    const figmaManager = new FigmaOAuthManager(redirectUri);
    const state = figmaManager.generateState();

    // Generate OAuth URL
    const authUrl = figmaManager.generateOAuthUrl(state);

    console.log("[Figma OAuth] Redirecting to:", authUrl);

    // Redirect to Figma OAuth
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": `figma_oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`,
      },
    });
  } catch (error) {
    console.error("Error initiating Figma OAuth:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to initiate Figma connection",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



