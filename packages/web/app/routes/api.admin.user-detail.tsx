import { Profile } from "@nowgai/shared/models";
import { MongoClient, ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";

async function requireAdmin(request: Request) {
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("admin-session=hardcoded-admin")) {
    return { role: "admin" };
  }
  throw new Response("Unauthorized", { status: 401 });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await requireAdmin(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get user from BetterAuth
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) throw new Error("MONGODB_URI not set");

    const mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    const db = mongoClient.db(dbName);

    const user = await db
      .collection("user")
      .findOne({ _id: new ObjectId(userId) });
    // Note: Do NOT close mongoClient - it's a shared singleton managed by getMongoClient()

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get profile data
    const profile = await Profile.findOne({ userId });

    // Format response
    const userDetail = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      firstName: user.name?.split(" ")[0] || "",
      lastName: user.name?.split(" ").slice(1).join(" ") || "",
      role: user.role || "customer",
      isActive: !user.banned,
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      image: user.image,

      // Profile data
      balance: profile?.balance || 0,
      isWhitelisted: profile?.isWhitelisted || false,
      totalMessages: profile?.totalMessages || 0,
      totalTokens: profile?.totalTokens || 0,
      totalConversations: profile?.totalConversations || 0,
      totalProjects: profile?.totalProjects || 0,
      totalCost: profile?.totalCost || 0,

      // Deployment stats
      deploymentStats: profile?.deploymentStats || {
        total: 0,
        successful: 0,
        failed: 0,
        inProgress: 0,
      },

      // Model usage (top 5)
      modelUsage: (profile?.modelUsage || [])
        .sort((a: any, b: any) => b.tokens - a.tokens)
        .slice(0, 5)
        .map((m: any) => ({
          model: m.model,
          tokens: m.tokens,
          messages: m.messages,
          cost: m.cost,
        })),

      // Recent transactions (last 10)
      recentTransactions: (profile?.transactions || [])
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10)
        .map((t: any) => ({
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          description: t.description,
          createdAt: t.createdAt,
          model: t.model,
          inputTokens: t.inputTokens,
          outputTokens: t.outputTokens,
        })),
    };

    return new Response(JSON.stringify(userDetail), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching user detail:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user detail" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
