import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getUsersCollection } from "~/lib/adminHelpers";
import { connectToDatabase } from "~/lib/mongo";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * GET /api/admin/organizations/search-user
 * Search for a user by email
 * Same functionality as nowgai-admin's searchUserByEmail
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { usersCollection, mongoClient } = await getUsersCollection();

    // Search for user by email (case-insensitive, trimmed)
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });


    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return user info matching nowgai-admin format
    return new Response(
      JSON.stringify({
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name || "",
          role: user.role || "user",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error searching user:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to search user",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
