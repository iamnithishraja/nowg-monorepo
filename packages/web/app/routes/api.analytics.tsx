import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Profile from "~/models/profileModel";
import Conversation from "~/models/conversationModel";
import Messages from "~/models/messageModel";
import Deployment from "~/models/deploymentModel";
import NeonUsageBilling from "~/models/neonUsageBillingModel";
import { ProfileService } from "~/lib/profileService";

// Model pricing per 1M tokens (in USD) - OpenRouter pricing + 20% profit margin
const MODEL_PRICING = {
  "anthropic/claude-3.5-sonnet": { input: 3.6, output: 18 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
  "anthropic/claude-4.5-sonnet": { input: 3.6, output: 18 }, // $3/M + 20% = $3.6/M, $15/M + 20% = $18/M
  "openai/gpt-5-nano": { input: 0.06, output: 0.48 }, // $0.05/M + 20% = $0.06/M, $0.40/M + 20% = $0.48/M
  "google/gemini-2.5-flash": { input: 0.36, output: 3 }, // $0.30/M + 20% = $0.36/M, $2.50/M + 20% = $3/M
  default: { input: 3.6, output: 18 }, // Default to Claude pricing
};

// Calculate cost based on model and tokens
function calculateMessageCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.default;
  const cost =
    (inputTokens / 1000000) * pricing.input +
    (outputTokens / 1000000) * pricing.output;
  return cost;
}

// Legacy calculation for messages without input/output split (assumes 80% input, 20% output)
function calculateMessageCostLegacy(
  model: string,
  totalTokens: number
): number {
  const pricing =
    MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.default;
  const inputTokens = totalTokens * 0.8;
  const outputTokens = totalTokens * 0.2;
  const cost =
    (inputTokens / 1000000) * pricing.input +
    (outputTokens / 1000000) * pricing.output;
  return cost;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("range") || "30d";

    await connectToDatabase();

    // Get or create user profile
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      const profileService = new ProfileService();
      profile = await profileService.getProfile(userId);
      if (!profile) {
        profile = new Profile({ userId });
        await profile.save();
      }
    }

    // Calculate date ranges
    const now = new Date();
    const ranges = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    const days = ranges[timeRange as keyof typeof ranges] || 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get conversations over time
    const conversationsOverTime = await Conversation.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%b %d",
              date: "$createdAt",
            },
          },
          conversations: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get messages over time
    const messagesOverTime = await Messages.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $match: {
          "conversation.userId": userId,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%b %d",
              date: "$timestamp",
            },
          },
          messages: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get tokens over time with input/output breakdown
    const tokensOverTime = await Messages.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $match: {
          "conversation.userId": userId,
          role: "assistant",
          timestamp: { $gte: startDate },
        },
      },
      {
        $addFields: {
          // Calculate tokens with proper fallback logic
          inputTokensCalc: {
            $cond: {
              if: { $ifNull: ["$inputTokens", false] },
              then: "$inputTokens",
              else: {
                $cond: {
                  if: { $ifNull: ["$tokensUsed", false] },
                  then: { $multiply: ["$tokensUsed", 0.8] }, // 80% estimate for input
                  else: 0,
                },
              },
            },
          },
          outputTokensCalc: {
            $cond: {
              if: { $ifNull: ["$outputTokens", false] },
              then: "$outputTokens",
              else: {
                $cond: {
                  if: { $ifNull: ["$tokensUsed", false] },
                  then: { $multiply: ["$tokensUsed", 0.2] }, // 20% estimate for output
                  else: 0,
                },
              },
            },
          },
          totalTokensCalc: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ["$inputTokens", false] },
                  { $ifNull: ["$outputTokens", false] },
                ],
              },
              then: { $add: ["$inputTokens", "$outputTokens"] },
              else: { $ifNull: ["$tokensUsed", 0] },
            },
          },
        },
      },
      {
        $match: {
          totalTokensCalc: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%b %d",
              date: "$timestamp",
            },
          },
          inputTokens: { $sum: "$inputTokensCalc" },
          outputTokens: { $sum: "$outputTokensCalc" },
          totalTokens: { $sum: "$totalTokensCalc" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get model usage (sum both input and output tokens)
    const modelUsage = await Messages.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $match: {
          "conversation.userId": userId,
          role: "assistant",
          model: { $exists: true },
          timestamp: { $gte: startDate },
        },
      },
      {
        $addFields: {
          // Calculate total tokens: if inputTokens and outputTokens exist, sum them; otherwise use tokensUsed
          totalTokensCalc: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ["$inputTokens", false] },
                  { $ifNull: ["$outputTokens", false] },
                ],
              },
              then: { $add: ["$inputTokens", "$outputTokens"] },
              else: { $ifNull: ["$tokensUsed", 0] },
            },
          },
        },
      },
      {
        $group: {
          _id: "$model",
          tokens: { $sum: "$totalTokensCalc" },
          messages: { $sum: 1 },
        },
      },
      {
        $project: {
          name: "$_id",
          value: "$tokens",
          messages: "$messages",
          color: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$_id", "anthropic/claude-3.5-sonnet"] },
                  then: "#22c55e",
                },
                {
                  case: { $eq: ["$_id", "anthropic/claude-4.5-sonnet"] },
                  then: "#10b981",
                },
                {
                  case: { $eq: ["$_id", "openai/gpt-5-nano"] },
                  then: "#3b82f6",
                },
                {
                  case: { $eq: ["$_id", "google/gemini-2.5-flash"] },
                  then: "#f59e0b",
                },
                { case: { $eq: ["$_id", "openai/gpt-4"] }, then: "#3b82f6" },
                {
                  case: { $eq: ["$_id", "anthropic/claude-3-opus"] },
                  then: "#a855f7",
                },
                {
                  case: { $eq: ["$_id", "openai/gpt-3.5-turbo"] },
                  then: "#f59e0b",
                },
              ],
              default: "#6b7280",
            },
          },
        },
      },
    ]);

    // Get deployment stats
    const deploymentStats = await Deployment.aggregate([
      {
        $match: { userId },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get additional tokens over time from reverted messages
    const additionalTokensOverTime = await Conversation.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          additionalTokensUsed: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%b %d",
              date: "$createdAt",
            },
          },
          additionalTokens: { $sum: "$additionalTokensUsed" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get cost over time with accurate per-model pricing
    const costOverTime = await Messages.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      {
        $match: {
          "conversation.userId": userId,
          role: "assistant",
          timestamp: { $gte: startDate },
          model: { $exists: true },
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%b %d",
              date: "$timestamp",
            },
          },
          model: 1,
          inputTokens: 1,
          outputTokens: 1,
          tokensUsed: 1,
        },
      },
    ]);

    // Calculate costs per message and group by date
    const costsByDate = new Map<string, number>();
    for (const msg of costOverTime) {
      const date = msg.date;
      let cost = 0;

      // Use actual input/output tokens if available, otherwise fall back to legacy calculation
      if (msg.inputTokens !== undefined && msg.outputTokens !== undefined) {
        cost = calculateMessageCost(
          msg.model,
          msg.inputTokens,
          msg.outputTokens
        );
      } else if (msg.tokensUsed) {
        cost = calculateMessageCostLegacy(msg.model, msg.tokensUsed);
      }

      costsByDate.set(date, (costsByDate.get(date) || 0) + cost);
    }

    // Combine data for time series
    const timeSeriesData = [];
    const allDates = new Set([
      ...conversationsOverTime.map((item) => item._id),
      ...messagesOverTime.map((item) => item._id),
      ...tokensOverTime.map((item) => item._id),
      ...additionalTokensOverTime.map((item) => item._id),
    ]);

    // Always create time series for the full range, filling in missing dates with 0
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      // Use the same date format as the aggregation: "Oct 03" format
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit", // This ensures leading zeros like "03" instead of "3"
      });

      // Find data for this specific date
      const conversations =
        conversationsOverTime.find((item) => item._id === dateStr)
          ?.conversations || 0;
      const messages =
        messagesOverTime.find((item) => item._id === dateStr)?.messages || 0;

      // Get token breakdown from tokensOverTime
      const tokenData = tokensOverTime.find((item) => item._id === dateStr);
      const inputTokens = tokenData?.inputTokens || 0;
      const outputTokens = tokenData?.outputTokens || 0;
      const tokens = tokenData?.totalTokens || 0;

      const additionalTokens =
        additionalTokensOverTime.find((item) => item._id === dateStr)
          ?.additionalTokens || 0;
      const totalTokens = tokens + additionalTokens;
      const cost = costsByDate.get(dateStr) || 0; // Use actual per-model costs

      timeSeriesData.push({
        date: dateStr,
        conversations,
        messages,
        inputTokens,
        outputTokens,
        tokens: totalTokens,
        cost,
      });
    }

    // Format deployment stats
    const formattedDeploymentStats = [
      {
        status: "Successful",
        count:
          deploymentStats.find((item) => item._id === "success")?.count || 0,
        color: "#22c55e",
      },
      {
        status: "Failed",
        count:
          deploymentStats.find((item) => item._id === "failed")?.count || 0,
        color: "#ef4444",
      },
      {
        status: "In Progress",
        count:
          deploymentStats.find((item) => item._id === "pending")?.count || 0,
        color: "#f59e0b",
      },
    ];

    // Get additional tokens from reverted messages
    const additionalTokensResult = await Conversation.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          additionalTokensUsed: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalAdditionalTokens: { $sum: "$additionalTokensUsed" },
        },
      },
    ]);

    const additionalTokens =
      additionalTokensResult[0]?.totalAdditionalTokens || 0;

    // Calculate summary stats from the actual filtered data
    const totalConversations = conversationsOverTime.reduce(
      (sum, item) => sum + item.conversations,
      0
    );
    const totalMessages = messagesOverTime.reduce(
      (sum, item) => sum + item.messages,
      0
    );

    // Calculate total input/output/total tokens
    const totalInputTokens = tokensOverTime.reduce(
      (sum, item) => sum + item.inputTokens,
      0
    );
    const totalOutputTokens = tokensOverTime.reduce(
      (sum, item) => sum + item.outputTokens,
      0
    );
    const totalTokens =
      tokensOverTime.reduce((sum, item) => sum + item.totalTokens, 0) +
      additionalTokens;

    // Calculate total cost from actual per-model costs
    const totalCost = Array.from(costsByDate.values()).reduce(
      (sum, cost) => sum + cost,
      0
    );

    // Get managed_db (Neon) billing data
    const managedDbBillingRecords = await NeonUsageBilling.find({
      userId: userId,
      status: "active",
    }).lean();

    // Aggregate managed_db usage over time
    const managedDbUsageOverTime: any[] = [];
    const managedDbCostsByDate = new Map<string, number>();
    let totalManagedDbCost = 0;
    let totalManagedDbComputeCost = 0;
    let totalManagedDbStorageCost = 0;
    let totalManagedDbUsageRecords = 0;

    // Process all usage records from all billing records
    for (const billingRecord of managedDbBillingRecords) {
      totalManagedDbUsageRecords += billingRecord.totalUsageRecords || 0;
      
      if (billingRecord.usageRecords && billingRecord.usageRecords.length > 0) {
        for (const usageRecord of billingRecord.usageRecords) {
          const recordDate = new Date(usageRecord.periodStart);
          // Use the same date format as other analytics
          const dateStr = recordDate.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          });

          // Only include records within the time range
          if (recordDate >= startDate) {
            const existingCost = managedDbCostsByDate.get(dateStr) || 0;
            managedDbCostsByDate.set(
              dateStr,
              existingCost + (usageRecord.totalCost || 0)
            );
            totalManagedDbCost += usageRecord.totalCost || 0;
            totalManagedDbComputeCost += usageRecord.computeCost || 0;
            totalManagedDbStorageCost += usageRecord.storageCost || 0;
          }
        }
      }
    }

    // Create time series data for managed_db
    const managedDbTimeSeriesData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
      });

      managedDbTimeSeriesData.push({
        date: dateStr,
        cost: managedDbCostsByDate.get(dateStr) || 0,
      });
    }

    // If no data found, return empty structure instead of null
    if (totalConversations === 0 && totalMessages === 0 && totalTokens === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            conversationsOverTime: timeSeriesData.map((item) => ({
              date: item.date,
              conversations: 0,
              messages: 0,
            })),
            tokensUsed: timeSeriesData.map((item) => ({
              date: item.date,
              tokens: 0,
            })),
            costOverTime: timeSeriesData.map((item) => ({
              date: item.date,
              cost: 0,
            })),
            modelUsage: [],
            deploymentStats: [
              { status: "Successful", count: 0, color: "#22c55e" },
              { status: "Failed", count: 0, color: "#ef4444" },
              { status: "In Progress", count: 0, color: "#f59e0b" },
            ],
            summary: {
              totalConversations: 0,
              totalMessages: 0,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalTokens: 0,
              totalCost: 0,
            },
            managedDb: {
              costOverTime: managedDbTimeSeriesData,
              totalCost: 0,
              totalComputeCost: 0,
              totalStorageCost: 0,
              totalUsageRecords: 0,
              hasData: false,
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Debug: Check what we're sending in the response
    const responseTokensUsed = timeSeriesData.map((item) => ({
      date: item.date,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      tokens: item.tokens,
    }));
    const responseCostOverTime = timeSeriesData.map((item) => ({
      date: item.date,
      cost: item.cost,
    }));

    const nonZeroResponseTokens = responseTokensUsed.filter(
      (item) => item.tokens > 0
    );
    const nonZeroResponseCosts = responseCostOverTime.filter(
      (item) => item.cost > 0
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          // Time series data
          conversationsOverTime: timeSeriesData.map((item) => ({
            date: item.date,
            conversations: item.conversations,
            messages: item.messages,
          })),
          tokensUsed: responseTokensUsed,
          costOverTime: responseCostOverTime,

          // Charts data
          modelUsage,
          deploymentStats: formattedDeploymentStats,

          // Weekly projects data (mock for now)
          projectsCreated: Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
              day: date.toLocaleDateString("en-US", { weekday: "short" }),
              projects: Math.floor(Math.random() * 5) + 1,
            };
          }),

          // Summary stats
          summary: {
            totalConversations,
            totalMessages,
            totalInputTokens,
            totalOutputTokens,
            totalTokens,
            totalCost,
          },
          // Managed DB (Neon) analytics
          managedDb: {
            costOverTime: managedDbTimeSeriesData,
            totalCost: totalManagedDbCost,
            totalComputeCost: totalManagedDbComputeCost,
            totalStorageCost: totalManagedDbStorageCost,
            totalUsageRecords: totalManagedDbUsageRecords,
            hasData: totalManagedDbCost > 0 || totalManagedDbUsageRecords > 0,
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Analytics API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
