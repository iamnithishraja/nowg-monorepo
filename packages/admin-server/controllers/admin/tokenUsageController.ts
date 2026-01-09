import type { Request, Response } from "express";
import Profile from "../../models/profileModel";
import { getUsersCollection } from "../../config/db";
import OrganizationMember from "../../models/organizationMemberModel";
import { UserRole } from "../../types/roles";
import { getUserOrganizations } from "../../lib/organizationRoles";

export async function getTokenUsage(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // If user has org admin role, get user IDs from their organizations
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
      }
    }

    // Get total cost and tokens from all deduction transactions
    const totalsResult = await Profile.aggregate([
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
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
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "recharge" } },
      { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
    ]);
    const totalRecharges = rechargesResult[0]?.total || 0;

    // Profit is 20% of recharges
    const profit = totalRecharges * 0.2;
    const actualCreditsGiven = totalRecharges * 0.8;

    // Model usage breakdown
    const modelUsage = await Profile.aggregate([
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
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

    // Daily usage for last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const dailyUsage = await Profile.aggregate([
      ...(profileUserIds.length > 0
        ? [{ $match: { userId: { $in: profileUserIds } } }]
        : []),
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

    // Format daily usage
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

    return res.json({
      totalCost: totalCost.toFixed(2),
      totalTokens,
      totalRecharges: totalRecharges.toFixed(2),
      profit: profit.toFixed(2),
      actualCreditsGiven: actualCreditsGiven.toFixed(2),
      profitPercentage: 20,
      modelUsage: modelUsageWithPercentage,
      dailyUsage: dailyUsageFormatted,
    });
  } catch (error: any) {
    console.error("Error fetching token usage:", error);
    return res.status(500).json({ error: "Failed to fetch token usage" });
  }
}
