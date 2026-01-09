import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnvWithDefault } from "~/lib/env";

const ADMIN_EMAIL = "tech@nowg.ai";
const ADMIN_PASSWORD = "urHwazDjvS";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin":
    getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
};

// Handle OPTIONS preflight
export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    // Check for hardcoded admin credentials first
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Set admin session cookie - SameSite=None and Secure required for cross-origin
      const sessionCookie = `admin-session=hardcoded-admin; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`; // 24 hours

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: "admin",
            email: ADMIN_EMAIL,
            firstName: "Admin",
            lastName: "User",
            name: "Admin",
            role: "admin",
          },
          token: "admin-token", // For compatibility with frontend localStorage
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": sessionCookie,
            ...corsHeaders,
          },
        }
      );
    }

    // Otherwise, use Better Auth for regular user login
    const authInstance = await auth;
    const response = await authInstance.handler(request);
    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({
        error: "Login failed",
        message: error.message || "An error occurred during login",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
