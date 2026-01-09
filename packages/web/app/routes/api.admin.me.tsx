import type { LoaderFunctionArgs } from "react-router";
import { getEnvWithDefault } from "~/lib/env";
import { getAdminSession } from "~/lib/adminMiddleware";

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": getEnvWithDefault(
      "ADMIN_FRONTEND_URL",
      "http://localhost:5174"
    ),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
  };

  // Handle preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { user } = await getAdminSession(request);

    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Please login to continue",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Return user with org admin and project admin flags
    return new Response(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organizationId: user.organizationId,
        projectId: user.projectId,
        hasOrgAdminAccess: user.hasOrgAdminAccess || false,
        hasProjectAdminAccess: user.hasProjectAdminAccess || false,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Get current user error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get user",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}

