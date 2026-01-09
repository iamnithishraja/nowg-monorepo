import type { LoaderFunctionArgs } from "react-router";
import { auth } from "../lib/auth";
import { connectToDatabase } from "../lib/mongo";
import FigmaIntegration from "../models/figmaIntegrationModel";
import { FigmaOAuthManager } from "../lib/figma-oauth-manager";

/**
 * API Route: Check Figma Token Status
 * GET /api/figma/token
 *
 * Returns Figma connection status and user info
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

    const userId = session.user.id;

    // Ensure MongoDB connection
    await connectToDatabase();

    // Check if user has Figma integration
    const integration = await FigmaIntegration.findOne({ userId });

    if (!integration) {
      return new Response(
        JSON.stringify({
          connected: false,
          message: "Figma not connected",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired and needs refresh
    const now = new Date();
    let accessToken = integration.accessToken;

    if (integration.expiresAt && integration.expiresAt < now) {
      // Token expired, try to refresh
      if (integration.refreshToken) {
        try {
          const url = new URL(request.url);
          const origin = url.origin;
          const redirectUri = `${origin}/api/figma/callback`;
          
          const figmaManager = new FigmaOAuthManager(redirectUri);
          const newToken = await figmaManager.refreshAccessToken(integration.refreshToken);

          // Update stored token
          const expiresAt = newToken.expires_in
            ? new Date(Date.now() + newToken.expires_in * 1000)
            : undefined;

          await FigmaIntegration.findOneAndUpdate(
            { userId },
            {
              accessToken: newToken.access_token,
              refreshToken: newToken.refresh_token,
              expiresAt,
              lastUsedAt: new Date(),
            }
          );

          accessToken = newToken.access_token;
        } catch (refreshError) {
          console.error("Failed to refresh Figma token:", refreshError);
          // Token refresh failed, user needs to reconnect
          return new Response(
            JSON.stringify({
              connected: false,
              expired: true,
              message: "Figma token expired. Please reconnect.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            connected: false,
            expired: true,
            message: "Figma token expired. Please reconnect.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Update last used time
    await FigmaIntegration.findOneAndUpdate(
      { userId },
      { lastUsedAt: new Date() }
    );

    return new Response(
      JSON.stringify({
        connected: true,
        figmaEmail: integration.figmaEmail,
        figmaUserId: integration.figmaUserId,
        connectedAt: integration.connectedAt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking Figma token:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check Figma connection",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



