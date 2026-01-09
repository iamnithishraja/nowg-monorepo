import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin":
    getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Check for hardcoded admin session first
    const cookies = request.headers.get("cookie") || "";
    if (cookies.includes("admin-session=hardcoded-admin")) {
      return new Response(
        JSON.stringify({
          id: "admin",
          email: "tech@nowgai",
          name: "Admin",
          role: "admin",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Otherwise, use Better Auth
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ user: null }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify(session.user), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return new Response(JSON.stringify({ user: null }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
