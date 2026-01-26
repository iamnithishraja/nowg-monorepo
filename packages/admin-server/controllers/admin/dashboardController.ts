import { OrganizationMember, Profile } from "@nowgai/shared/models";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import { getUserOrganizations } from "../../lib/organizationRoles";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Get total users from BetterAuth
    const usersCollection = getUsersCollection();

    // Build user query - if user has org admin role, only count users from their organizations
    let userQuery: any = {};
    let profileUserIds: string[] = [];

    if (user?.id) {
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        const orgMembers = await OrganizationMember.find({
          organizationId: { $in: orgIds },
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

    return res.json({
      totalUsers,
      activeSubscriptions,
      totalRevenue: totalRevenue.toFixed(2),
      tokenUsageToday,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
}
