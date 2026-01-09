import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import Profile from "../../models/profileModel";
import OrganizationMember from "../../models/organizationMemberModel";
import { UserRole } from "../../types/roles";
import { getUserOrganizations } from "../../lib/organizationRoles";

export async function getTransactions(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Build user query - if user has org admin role, only get users from their organizations
    let userQuery: any = {};
    if (user?.id) {
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        const orgMembers = await OrganizationMember.find({
          organizationId: { $in: orgIds },
          status: "active",
        }).lean();
        const orgUserIds = orgMembers.map((m: any) => m.userId);
        if (orgUserIds.length > 0) {
          userQuery._id = {
            $in: orgUserIds.map((id: string) => new ObjectId(id)),
          };
        } else {
          // No members, return empty
          return res.json([]);
        }
      }
    }

    // Get all users with their profiles
    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find(userQuery)
      .project({ email: 1, name: 1 })
      .toArray();

    // Get user IDs for filtering profiles
    const userIds = users.map((u: any) => u._id.toString());
    const profiles =
      userIds.length > 0
        ? await Profile.find({ userId: { $in: userIds } })
        : await Profile.find({});

    // Create a map of userId to user info
    const userMap = new Map();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        email: user.email,
        firstName: user.name?.split(" ")[0] || "",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
      });
    });

    // Collect only Stripe recharge transactions
    const rechargeTransactions: any[] = [];

    profiles.forEach((profile) => {
      const userInfo = userMap.get(profile.userId) || {};
      const userBalance = profile.balance || 0;

      // Only include recharge transactions with Stripe payment ID
      profile.transactions.forEach((txn: any) => {
        if (txn.type === "recharge" && txn.stripePaymentId) {
          rechargeTransactions.push({
            id: txn._id.toString(),
            userId: profile.userId,
            userEmail: userInfo.email || "Unknown",
            userName:
              `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim() ||
              "Unknown",
            type: "token_purchase",
            amount: txn.amount.toFixed(2),
            currency: "USD",
            status: "completed",
            gatewayId: null,
            gatewayTransactionId: txn.stripePaymentId,
            description: txn.description || "Stripe recharge",
            metadata: {
              currentBalance: userBalance,
              balanceAfter: txn.balanceAfter,
            },
            createdAt: txn.createdAt,
          });
        }
      });
    });

    // Sort by date (newest first)
    rechargeTransactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Limit to 100 most recent
    const limitedTransactions = rechargeTransactions.slice(0, 100);

    return res.json(limitedTransactions);
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
