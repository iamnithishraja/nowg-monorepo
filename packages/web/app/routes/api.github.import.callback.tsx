import type { LoaderFunctionArgs } from "react-router";
import { GitHubImportManager } from "../lib/github-import-manager";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error("GitHub OAuth error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?github_import_error=${encodeURIComponent(error)}`,
      },
    });
  }

  // Validate required parameters
  if (!code || !state) {
    console.error("Missing code or state parameter");
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?github_import_error=missing_parameters",
      },
    });
  }

  try {
    const importManager = new GitHubImportManager();

    console.log("🔍 [OAuth Callback] Starting token exchange...");
    
    // Exchange code for access token
    const token = await importManager.exchangeCodeForToken(code);
    console.log("✅ [OAuth Callback] Token received");

    // Get user info
    const user = await importManager.getUserInfo(token.access_token);
    console.log("✅ [OAuth Callback] User info received:", user.login);

    // Create a secure session token that can be used to retrieve the GitHub token
    const sessionData = {
      githubToken: token.access_token,
      user: user,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    };

    // Use Buffer.from().toString('base64') instead of btoa() to handle Unicode characters
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString(
      "base64"
    );

    // Check if we're on localhost (HTTP) or production (HTTPS)
    const isLocalhost = request.url.includes("localhost") || request.url.includes("127.0.0.1");
    const cookieFlags = isLocalhost
      ? "HttpOnly; SameSite=Lax" // Lax for localhost (HTTP)
      : "HttpOnly; Secure; SameSite=Lax"; // Secure only for HTTPS

    console.log("🔍 [OAuth Callback] Setting cookie with flags:", cookieFlags);
    console.log("🔍 [OAuth Callback] Redirecting to: /?github_connected=true");

    // Set cookie and redirect to home
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?github_connected=true",
        "Set-Cookie": `github_import_session=${sessionToken}; ${cookieFlags}; Max-Age=${
          8 * 60 * 60
        }; Path=/`,
      },
    });
  } catch (error) {
    console.error("❌ [OAuth Callback] Error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/?github_import_error=${encodeURIComponent(
          "oauth_callback_failed"
        )}`,
      },
    });
  }
}
