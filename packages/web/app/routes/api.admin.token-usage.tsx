import type { LoaderFunctionArgs } from "react-router";
import Profile from "~/models/profileModel";
import { connectToDatabase } from "~/lib/mongo";
import { getEnvWithDefault } from "~/lib/env";

async function requireAdmin(request: Request) {
  // Check for hardcoded admin session cookie
  const cookies = request.headers.get("cookie");
  if (cookies?.includes("admin-session=hardcoded-admin")) {
    return { role: "admin" };
  }

  throw new Response("Unauthorized", { status: 401 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      getEnvWithDefault("ADMIN_FRONTEND_URL", "http://localhost:5174"),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
  };

  // Handle preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    await requireAdmin(request);
    await connectToDatabase();

    // Get total cost and tokens from all deduction transactions
    const totalsResult = await Profile.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "deduction" } },
      {
        $group: {
          _id: null,
          totalCost: { $sum: "$transactions.amount" },
          totalTokens: {
            $sum: {
              $add: [
                { $ifNull: ["$transactions.inputTokens", 0] },
                { $ifNull: ["$transactions.outputTokens", 0] },
              ],
            },
          },
        },
      },
    ]);
    const totalCost = totalsResult[0]?.totalCost || 0;
    const totalTokens = totalsResult[0]?.totalTokens || 0;

    // Calculate total recharges for profit calculation
    const rechargesResult = await Profile.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "recharge" } },
      { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
    ]);
    const totalRecharges = rechargesResult[0]?.total || 0;

    // Profit is 20% of recharges (users pay $10, get $8 credit, $2 is profit)
    const profit = totalRecharges * 0.2;
    const actualCreditsGiven = totalRecharges * 0.8;

    // Model usage breakdown for pie chart
    const modelUsage = await Profile.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "deduction",
          "transactions.model": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$transactions.model",
          tokens: {
            $sum: {
              $add: [
                { $ifNull: ["$transactions.inputTokens", 0] },
                { $ifNull: ["$transactions.outputTokens", 0] },
              ],
            },
          },
          cost: { $sum: "$transactions.amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { tokens: -1 } },
    ]);

    // Calculate percentages for model usage
    const modelUsageWithPercentage = modelUsage.map((model: any) => ({
      model: model._id,
      tokens: model.tokens,
      cost: model.cost,
      count: model.count,
      percentage:
        totalTokens > 0 ? ((model.tokens / totalTokens) * 100).toFixed(2) : 0,
    }));

    // Daily usage for last 14 days for bar chart
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const dailyUsage = await Profile.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "deduction",
          "transactions.createdAt": { $gte: fourteenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$transactions.createdAt",
            },
          },
          tokens: {
            $sum: {
              $add: [
                { $ifNull: ["$transactions.inputTokens", 0] },
                { $ifNull: ["$transactions.outputTokens", 0] },
              ],
            },
          },
          cost: { $sum: "$transactions.amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Format daily usage with full date labels
    const dailyUsageFormatted = dailyUsage.map((day: any) => ({
      date: day._id,
      label: new Date(day._id).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      tokens: day.tokens,
      cost: day.cost,
      count: day.count,
    }));

    return new Response(
      JSON.stringify({
        totalCost: totalCost.toFixed(2),
        totalTokens,
        totalRecharges: totalRecharges.toFixed(2),
        profit: profit.toFixed(2),
        actualCreditsGiven: actualCreditsGiven.toFixed(2),
        profitPercentage: 20,
        modelUsage: modelUsageWithPercentage,
        dailyUsage: dailyUsageFormatted,
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
    console.error("Error fetching token usage:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch token usage" }),
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
