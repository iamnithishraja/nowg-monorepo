import type { LoaderFunctionArgs } from "react-router";
import Conversation from "~/models/conversationModel";
import { connectToDatabase } from "~/lib/mongo";
import { getEnvWithDefault } from "~/lib/env";

async function requireAdmin(request: Request) {
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("admin-session=hardcoded-admin")) {
    return { role: "admin" };
  }
  throw new Response("Unauthorized", { status: 401 });
}

export async function loader({ request }: LoaderFunctionArgs) {
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
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Get total count
    const totalProjects = await Conversation.countDocuments({
      "supabase.enabled": true,
    });

    // Get all projects for unique users count
    const allProjects = await Conversation.find(
      { "supabase.enabled": true },
      { userId: 1 }
    );
    const uniqueUsers = new Set(allProjects.map((p) => p.userId)).size;

    // Recent projects with pagination
    const recentProjectsQuery = await Conversation.find({
      "supabase.enabled": true,
    })
      .sort({ "supabase.createdAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const recentProjects = recentProjectsQuery.map((p) => ({
      id: p._id,
      userId: p.userId,
      title: p.title,
      projectId: p.supabase?.projectId,
      supabaseUrl: p.supabase?.supabaseUrl,
      ref: p.supabase?.ref,
      createdAt: p.supabase?.createdAt || p.createdAt,
    }));

    const totalPages = Math.ceil(totalProjects / limit);

    // Projects per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyProjects = await Conversation.aggregate([
      {
        $match: {
          "supabase.enabled": true,
          "supabase.createdAt": { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$supabase.createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedDailyProjects = dailyProjects.map((d: any) => ({
      date: d._id,
      count: d.count,
      label: new Date(d._id).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));

    return new Response(
      JSON.stringify({
        totalProjects,
        uniqueUsers,
        recentProjects,
        dailyProjects: formattedDailyProjects,
        pagination: {
          page,
          limit,
          total: totalProjects,
          totalPages,
          hasMore: page < totalPages,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching Supabase stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch Supabase stats" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
