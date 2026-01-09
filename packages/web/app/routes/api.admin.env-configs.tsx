import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import EnvConfig from "~/models/envConfigModel";
import { connectToDatabase } from "~/lib/mongo";
import { getEnvWithDefault } from "~/lib/env";
import { updateEnvKeysInCache } from "~/lib/env";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": getEnvWithDefault(
    "ADMIN_FRONTEND_URL",
    "http://localhost:5174"
  ),
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
};

// Helper to check if user is admin
async function requireAdmin(request: Request) {
  // Check for hardcoded admin session cookie
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("admin-session=hardcoded-admin")) {
    return { role: "admin" };
  }

  throw new Response("Unauthorized", { 
    status: 401,
    headers: corsHeaders,
  });
}

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Environment variables that should NOT be editable (break functionality if changed)
const PROTECTED_KEYS = [
  "MONGODB_URI",
  "MONGODB_URL",
  "NODE_ENV",
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "PWD",
];

/**
 * GET /api/admin/env-configs
 * Get all environment variables from database
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Handle OPTIONS preflight for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    await requireAdmin(request);
    await connectToDatabase();

    // Load all environment variables from MongoDB
    const envVars = await EnvConfig.find({}).sort({ key: 1 }).lean();

    // Filter out protected keys and format response
    const envConfigs = envVars
      .filter((env) => !PROTECTED_KEYS.includes(env.key))
      .map((env) => ({
        id: env._id.toString(),
        key: env.key,
        value: env.value,
      }));

    return new Response(JSON.stringify({ envConfigs }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching env configs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch environment variables" }),
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

/**
 * POST /api/admin/env-configs
 * Create or update environment variables
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    await requireAdmin(request);
    await connectToDatabase();

    const body = await request.json();
    const { envConfigs } = body;

    if (!Array.isArray(envConfigs)) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body. Expected envConfigs array",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    const updatedKeys: string[] = [];

    // Process each environment variable
    for (const config of envConfigs) {
      const { key, value } = config;

      // Validate key
      if (!key || typeof key !== "string") {
        results.errors.push(`Invalid key: ${key}`);
        continue;
      }

      // Skip protected keys
      if (PROTECTED_KEYS.includes(key)) {
        results.errors.push(`Cannot modify protected key: ${key}`);
        continue;
      }

      // Validate value
      if (value === undefined || value === null) {
        results.errors.push(`Invalid value for key: ${key}`);
        continue;
      }

      try {
        // Use upsert to create or update
        const result = await EnvConfig.updateOne(
          { key },
          { $set: { value: String(value) } },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          results.created++;
          updatedKeys.push(key);
        } else if (result.modifiedCount > 0) {
          results.updated++;
          updatedKeys.push(key);
        }
      } catch (error: any) {
        results.errors.push(`Error updating ${key}: ${error.message}`);
      }
    }

    // Update only the changed keys in cache (more efficient than full reload)
    if (updatedKeys.length > 0) {
      try {
        await updateEnvKeysInCache(updatedKeys);
        console.log(
          `✅ Updated ${
            updatedKeys.length
          } environment variable(s) in cache: ${updatedKeys.join(", ")}`
        );
      } catch (error) {
        console.error("⚠️  Warning: Failed to update env cache:", error);
        // Don't fail the request if cache update fails, but log it
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Environment variables updated successfully",
        results,
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
    if (error instanceof Response) throw error;
    console.error("Error updating env configs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update environment variables" }),
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
