import type { ActionFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";

/**
 * POST /api/check-user
 * Check if a user exists by email
 * This is used to provide helpful error messages during sign-in
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { usersCollection } = await getUsersCollection();

    // Check if user exists (case-insensitive, trimmed)
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    return new Response(
      JSON.stringify({
        exists: !!user,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error checking user:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check user",
        message: error.message || "An error occurred",
        exists: false, // Default to false on error
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
