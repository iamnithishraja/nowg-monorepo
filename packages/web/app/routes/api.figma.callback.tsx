import type { LoaderFunctionArgs } from "react-router";
import { FigmaOAuthManager } from "../lib/figma-oauth-manager";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import FigmaIntegration from "../models/figmaIntegrationModel";

/**
 * API Route: Figma OAuth Callback
 * GET /api/figma/callback
 *
 * Handles OAuth callback from Figma and stores integration
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    const errorDescription = url.searchParams.get("error_description");
    console.error("❌ [Figma OAuth Callback] Error from Figma:", {
      error,
      errorDescription,
      fullUrl: request.url,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/home?figma_error=${encodeURIComponent(error)}${
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
        Location: "/home?figma_error=missing_parameters",
      },
    });
  }

  try {
    // Verify state
    const cookies = request.headers.get("Cookie");
    const stateCookie = cookies
      ?.split(";")
      .find((c) => c.trim().startsWith("figma_oauth_state="))
      ?.split("=")[1]
      ?.trim();

    if (!stateCookie || stateCookie !== state) {
      console.error("Invalid state parameter");
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/home?figma_error=invalid_state",
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
          Location: "/home?figma_error=authentication_required",
        },
      });
    }

    const userId = session.user.id;

    // Ensure MongoDB connection
    await connectToDatabase();

    // Get the origin from the request to construct the redirect URI dynamically
    const origin = url.origin;
    const redirectUri = `${origin}/api/figma/callback`;

    const figmaManager = new FigmaOAuthManager(redirectUri);

    // Exchange code for access token
    const token = await figmaManager.exchangeCodeForToken(code);

    // Get user info
    const user = await figmaManager.getUserInfo(token.access_token);

    // Calculate expiration date
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined;

    // Store or update integration
    await FigmaIntegration.findOneAndUpdate(
      { userId },
      {
        userId,
        figmaUserId: user.id,
        figmaEmail: user.email,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        lastUsedAt: new Date(),
        $setOnInsert: { connectedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    console.log("✅ [Figma OAuth] Successfully connected for user:", userId);

    // Clear state cookie
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/home?figma_connected=true",
        "Set-Cookie":
          "figma_oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
      },
    });
  } catch (error) {
    console.error("❌ [Figma OAuth Callback] Error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/home?figma_error=${encodeURIComponent(
          error instanceof Error ? error.message : "oauth_callback_failed"
        )}`,
      },
    });
  }
}



