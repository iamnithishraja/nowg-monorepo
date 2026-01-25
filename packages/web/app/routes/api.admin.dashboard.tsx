import { OrganizationMember } from "@nowgai/shared/models";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getEnvWithDefault } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { getUserOrganizations } from "~/lib/organizationRoles";
import Profile from "~/models/profileModel";

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": getEnvWithDefault(
      "ADMIN_FRONTEND_URL",
      "http://localhost:5174"
    ),
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
    const user = await requireAdmin(request);
    await connectToDatabase();

    // Build user query - if user has org admin role, only count users from their organizations
    let userQuery: any = {};
    let profileUserIds: string[] = [];

    if (user?.id) {
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        const orgMembers = await OrganizationMember.find({
          organizationId: { $in: orgIds.map((id) => new ObjectId(id)) },
          status: "active",
        }).lean();
        profileUserIds = orgMembers.map((m: any) => m.userId);
        if (profileUserIds.length > 0) {
          userQuery._id = {
            $in: profileUserIds.map((id: string) => new ObjectId(id)),
          };
        }
      }
    }

    // Get total users from BetterAuth
    const { usersCollection, mongoClient } = await getUsersCollection();
    const totalUsers = await usersCollection.countDocuments(userQuery);

    // Calculate total revenue from recharge transactions in profiles
    const revenueMatch: any = { "transactions.type": "recharge" };
    if (profileUserIds.length > 0) {
      revenueMatch.userId = { $in: profileUserIds };
    }

    const revenueResult = await Profile.aggregate([
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
      { $unwind: "$transactions" },
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Active subscriptions = users with balance > 0
    const subscriptionQuery: any = { balance: { $gt: 0 } };
    if (profileUserIds.length > 0) {
      subscriptionQuery.userId = { $in: profileUserIds };
    }
    const activeSubscriptions = await Profile.countDocuments(subscriptionQuery);

    // Get tokens used today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tokensTodayMatch: any = {
      "transactions.type": "deduction",
      "transactions.createdAt": { $gte: todayStart },
    };

    const tokensToday = await Profile.aggregate([
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
      { $unwind: "$transactions" },
      {
        $match: tokensTodayMatch,
      },
      {
        $group: {
          _id: null,
          total: {
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
    const tokenUsageToday = tokensToday[0]?.total || 0;

    return new Response(
      JSON.stringify({
        totalUsers,
        activeSubscriptions,
        totalRevenue: totalRevenue.toFixed(2),
        tokenUsageToday,
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
    console.error("Error fetching dashboard stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch dashboard stats" }),
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
