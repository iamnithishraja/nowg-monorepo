import { Organization, OrgProjectWallet, Project, ProjectMember } from "@nowgai/shared/models";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Conversation from "~/models/conversationModel";
import Deployment from "~/models/deploymentModel";
import type { Route } from "./+types/api.admin.analytics.project.$projectId";

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    await requireAdmin(request);
    const projectId = params.projectId;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    // Check if project exists
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get project members
    const projectMembers = await ProjectMember.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      status: "active",
    }).lean();

    const userIds = projectMembers.map((m: any) => m.userId);

    // Get project wallet data
    const wallet = await OrgProjectWallet.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean() as any;

    // Get conversations for this project
    const conversationCount = await Conversation.countDocuments({
      adminProjectId: new mongoose.Types.ObjectId(projectId),
    });

    // Aggregate analytics from OrgProjectWallet transactions (primary source for org/project conversations)
    // Query debit transactions that have analytics data (model, tokens, conversationId)
    // These fields are directly set when credits are deducted for chat messages
    // Include all debit transactions with conversationId, even if other analytics fields are missing
    const totalsResult = await OrgProjectWallet.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          // Match transactions that have conversationId OR analytics fields
          $or: [
            {
              "transactions.conversationId": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
          ],
        },
      },
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
          totalMessages: { $sum: 1 },
        },
      },
    ]);

    const totalCost = totalsResult[0]?.totalCost || 0;
    const totalTokens = totalsResult[0]?.totalTokens || 0;
    const totalMessages = totalsResult[0]?.totalMessages || 0;

    // Model usage breakdown from OrgProjectWallet - use model field directly
    const modelUsage = await OrgProjectWallet.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          "transactions.model": {
            $exists: true,
            $ne: null,
            $nin: [null, ""],
          },
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

    const modelUsageWithPercentage = modelUsage.map((model: any) => ({
      model: model._id,
      tokens: model.tokens,
      cost: model.cost,
      count: model.count,
      percentage:
        totalTokens > 0 ? ((model.tokens / totalTokens) * 100).toFixed(2) : 0,
    }));

    // Daily usage for last 30 days from OrgProjectWallet
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyUsage = await OrgProjectWallet.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          "transactions.createdAt": { $gte: thirtyDaysAgo },
          // Match transactions that have conversationId OR analytics fields
          $or: [
            {
              "transactions.conversationId": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
          ],
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

    // User breakdown from OrgProjectWallet - include all debit transactions with analytics data
    const userBreakdown = await OrgProjectWallet.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          $and: [
            {
              // Match transactions that have conversationId OR analytics fields
              $or: [
                {
                  "transactions.conversationId": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
                {
                  "transactions.model": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
                { "transactions.inputTokens": { $exists: true, $ne: null } },
                { "transactions.outputTokens": { $exists: true, $ne: null } },
              ],
            },
            {
              // Must have userId or performedBy
              $or: [
                {
                  "transactions.userId": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
                {
                  "transactions.performedBy": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        // Use userId if available, otherwise use performedBy
        $addFields: {
          effectiveUserId: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$transactions.userId", null] },
                  { $ne: ["$transactions.userId", ""] },
                ],
              },
              then: "$transactions.userId",
              else: "$transactions.performedBy",
            },
          },
        },
      },
      {
        $match: {
          effectiveUserId: { $ne: null, $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: "$effectiveUserId",
          tokens: {
            $sum: {
              $add: [
                { $ifNull: ["$transactions.inputTokens", 0] },
                { $ifNull: ["$transactions.outputTokens", 0] },
              ],
            },
          },
          cost: { $sum: "$transactions.amount" },
          messages: { $sum: 1 },
          conversations: { $addToSet: "$transactions.conversationId" },
        },
      },
      {
        $project: {
          userId: "$_id",
          tokens: 1,
          cost: 1,
          messages: 1,
          conversationCount: { $size: "$conversations" },
        },
      },
      { $sort: { tokens: -1 } },
      { $limit: 20 },
    ]);

    // Get deployment analytics
    const projectConversations = await Conversation.find({
      adminProjectId: new mongoose.Types.ObjectId(projectId),
    })
      .select("_id")
      .lean();

    const conversationIds = projectConversations.map((c: any) => c._id);

    const deploymentStats = await Deployment.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const deploymentByPlatform = await Deployment.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
        },
      },
      {
        $group: {
          _id: "$platform",
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
    ]);

    const deploymentByUser = await Deployment.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          userId: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$userId",
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    const totalDeployments = deploymentStats.reduce(
      (sum: number, stat: any) => sum + stat.count,
      0
    );
    const successfulDeployments =
      deploymentStats.find((s: any) => s._id === "success")?.count || 0;
    const failedDeployments =
      deploymentStats.find((s: any) => s._id === "failed")?.count || 0;
    const pendingDeployments =
      deploymentStats.find((s: any) => s._id === "pending")?.count || 0;

    // Fetch user names for userBreakdown and deploymentByUser
    const { usersCollection } = await getUsersCollection();

    // Get organization to fetch org admin later
    const organization = await Organization.findById((project as any).organizationId).lean();

    const userBreakdownUserIds = userBreakdown
      .map((u: any) => u.userId || u._id)
      .filter(Boolean);
    const deploymentUserIds = deploymentByUser
      .map((u: any) => u._id)
      .filter(Boolean);

    // Also include all project member user IDs
    const projectMemberUserIds = projectMembers
      .map((m: any) => m.userId)
      .filter(Boolean);

    // Include org admin ID
    const orgAdminId = organization && (organization as any).orgAdminId ? [(organization as any).orgAdminId.toString()] : [];

    const uniqueUserIds = [
      ...new Set([...userBreakdownUserIds, ...deploymentUserIds, ...projectMemberUserIds, ...orgAdminId]),
    ].filter((id) => id && mongoose.Types.ObjectId.isValid(id.toString()));

    const users =
      uniqueUserIds.length > 0
        ? await usersCollection
            .find({
              _id: {
                $in: uniqueUserIds.map(
                  (id: any) => new ObjectId(id.toString())
                ),
              },
            })
            .toArray()
        : [];

    const userMap = new Map<string, { name: string; email: string; image: string }>();
    users.forEach((u: any) => {
      const userId = u._id.toString();
      userMap.set(userId, { name: u.name || "", email: u.email || "", image: u.image || "" });
    });

    // Create a map of user roles from project members
    const userRoleMap = new Map<string, string>();
    projectMembers.forEach((m: any) => {
      userRoleMap.set(m.userId.toString(), m.role || "member");
    });

    // Create a map of users with activity
    const userBreakdownMap = new Map<string, any>();
    userBreakdown.forEach((u: any) => {
      userBreakdownMap.set(u.userId || u._id, u);
    });

    // Include all project members, with 0 values for those without activity
    const completeUserBreakdown = projectMembers.map((member: any) => {
      const userId = member.userId.toString();
      const activity = userBreakdownMap.get(userId);
      const userInfo = userMap.get(userId) || { name: "", email: "", image: "" };
      const role = userRoleMap.get(userId) || "member";

      return {
        userId: userId,
        name: userInfo.name || userInfo.email || "Unknown User",
        email: userInfo.email || "",
        avatar: userInfo.image || "",
        role: role,
        tokens: activity?.tokens || 0,
        cost: activity ? activity.cost.toFixed(2) : "0.00",
        messages: activity?.messages || 0,
        conversations: activity?.conversationCount || 0,
      };
    });

    // Add organization admin if not already in project members
    if (organization && (organization as any).orgAdminId) {
      const orgAdminId = (organization as any).orgAdminId.toString();
      const isAlreadyIncluded = completeUserBreakdown.some(
        (u: any) => u.userId === orgAdminId
      );

      if (!isAlreadyIncluded) {
        const orgAdminInfo = userMap.get(orgAdminId) || { name: "", email: "", image: "" };
        const activity = userBreakdownMap.get(orgAdminId);

        completeUserBreakdown.push({
          userId: orgAdminId,
          name: orgAdminInfo.name || orgAdminInfo.email || "Unknown User",
          email: orgAdminInfo.email || "",
          avatar: orgAdminInfo.image || "",
          role: "org_admin",
          tokens: activity?.tokens || 0,
          cost: activity ? activity.cost.toFixed(2) : "0.00",
          messages: activity?.messages || 0,
          conversations: activity?.conversationCount || 0,
        });
      }
    }

    return new Response(
      JSON.stringify({
        projectId,
        projectName: (project as any).name || "Project",
        totalCost: totalCost.toFixed(2),
        totalTokens,
        totalMessages,
        totalConversations: conversationCount,
        totalUsers: userIds.length,
        wallet: {
          creditLimit: wallet?.creditLimit || 0,
          balance: wallet?.balance || 0,
        },
        modelUsage: modelUsageWithPercentage,
        dailyUsage: dailyUsageFormatted,
        userBreakdown: completeUserBreakdown,
        deployments: {
          total: totalDeployments,
          successful: successfulDeployments,
          failed: failedDeployments,
          pending: pendingDeployments,
          byPlatform: deploymentByPlatform.map((p: any) => ({
            platform: p._id,
            total: p.total,
            successful: p.successful,
            failed: p.failed,
            pending: p.pending,
          })),
          byUser: deploymentByUser.map((u: any) => {
            const userId = u._id.toString();
            const userInfo = userMap.get(userId) || { name: "", email: "" };
            return {
              userId: userId,
              name: userInfo.name || userInfo.email || "Unknown User",
              email: userInfo.email || "",
              total: u.total,
              successful: u.successful,
              failed: u.failed,
            };
          }),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching project analytics:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
