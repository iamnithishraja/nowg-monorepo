import type { LoaderFunctionArgs } from "react-router";
import Deployment from "~/models/deploymentModel";
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

    // Get all Vercel deployments for stats
    const vercelDeployments = await Deployment.find({ platform: "vercel" });

    // Calculate stats
    const totalDeployments = vercelDeployments.length;
    const successfulDeployments = vercelDeployments.filter(
      (d) => d.status === "success"
    ).length;
    const failedDeployments = vercelDeployments.filter(
      (d) => d.status === "failed"
    ).length;
    const pendingDeployments = vercelDeployments.filter(
      (d) => d.status === "pending"
    ).length;

    // Unique users who have used Vercel
    const uniqueUsers = new Set(vercelDeployments.map((d) => d.userId)).size;

    // Recent deployments with pagination
    const recentDeploymentsQuery = await Deployment.find({ platform: "vercel" })
      .sort({ deployedAt: -1 })
      .skip(skip)
      .limit(limit);

    const recentDeployments = recentDeploymentsQuery.map((d) => ({
      id: d._id,
      userId: d.userId,
      deploymentUrl: d.deploymentUrl,
      status: d.status,
      deployedAt: d.deployedAt,
      vercelProjectId: d.vercelProjectId,
    }));

    const totalPages = Math.ceil(totalDeployments / limit);

    // Deployments per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyDeployments = await Deployment.aggregate([
      {
        $match: {
          platform: "vercel",
          deployedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$deployedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedDailyDeployments = dailyDeployments.map((d: any) => ({
      date: d._id,
      count: d.count,
      label: new Date(d._id).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));

    return new Response(
      JSON.stringify({
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        pendingDeployments,
        uniqueUsers,
        successRate:
          totalDeployments > 0
            ? ((successfulDeployments / totalDeployments) * 100).toFixed(1)
            : "0",
        recentDeployments,
        dailyDeployments: formattedDailyDeployments,
        pagination: {
          page,
          limit,
          total: totalDeployments,
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
    console.error("Error fetching Vercel stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch Vercel stats" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
