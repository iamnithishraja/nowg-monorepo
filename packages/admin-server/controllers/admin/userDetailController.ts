import { Profile } from "@nowgai/shared/models";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";

export async function getUserDetail(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
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

    return res.json(userDetail);
  } catch (error: any) {
    console.error("Error fetching user detail:", error);
    return res.status(500).json({ error: "Failed to fetch user detail" });
  }
}

