import type { ActionFunctionArgs } from "react-router";
import { MongoClient, ObjectId } from "mongodb";
import { getEnvWithDefault } from "~/lib/env";

// Helper to check if user is admin
async function requireAdmin(request: Request) {
  // Check for hardcoded admin session cookie
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("admin-session=hardcoded-admin")) {
    return { role: "admin" };
  }

  throw new Response("Unauthorized", { status: 401 });
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin":
    getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
};

// Handle OPTIONS preflight for CORS
export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return new Response("Method not allowed", { status: 405 });
}

// POST /api/admin/update-role - Update user role
export async function action({ request }: ActionFunctionArgs) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: "userId and role are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!["user", "admin"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be 'user' or 'admin'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error("MONGODB_URI not set");
    }

    const mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    const db = mongoClient.db(dbName);

    // Convert string to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(userId);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid user ID format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = await db
      .collection("user")
      .updateOne({ _id: objectId }, { $set: { role } });

    await mongoClient.close();

    if (result.matchedCount === 0) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User role updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error updating user role:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
