import { OrganizationMember, OrgProjectWallet, OrgWallet, Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { getUsersCollection } from "../../config/db";
import {
  isOrganizationAdmin
} from "../../lib/organizationRoles";
import { isProjectAdmin } from "../../lib/projectRoles";
import Conversation from "../../models/conversationModel";
import Deployment from "../../models/deploymentModel";
import Profile from "../../models/profileModel";

/**
 * GET /api/admin/analytics/user/:userId
 * Get analytics for a specific user
 * Permissions: User can see their own analytics, admins can see any user's analytics
 */
export async function getUserAnalytics(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { userId } = req.params;

    // Check permissions
    const isFullAdmin = hasAdminAccess(user?.role);
    const isOwnProfile = user?.id === userId;

    if (!isFullAdmin && !isOwnProfile) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only view your own analytics",
      });
    }

    // Get user profile
    const profile = await Profile.findOne({ userId }).lean();
    if (!profile) {
      return res.status(404).json({
        error: "Not Found",
        message: "User profile not found",
      });
    }

    // Calculate analytics from transactions
    const totalsResult = await Profile.aggregate([
      { $match: { userId } },
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
          totalMessages: { $sum: 1 },
        },
      },
    ]);

    const totalCost = totalsResult[0]?.totalCost || 0;
    const totalTokens = totalsResult[0]?.totalTokens || 0;
    const totalMessages = totalsResult[0]?.totalMessages || 0;

    // Get conversation count
    const conversationCount = await Conversation.countDocuments({ userId });

    // Model usage breakdown
    const modelUsage = await Profile.aggregate([
      { $match: { userId } },
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

    const modelUsageWithPercentage = modelUsage.map((model: any) => ({
      model: model._id,
      tokens: model.tokens,
      cost: model.cost,
      count: model.count,
      percentage:
        totalTokens > 0 ? ((model.tokens / totalTokens) * 100).toFixed(2) : 0,
    }));

    // Daily usage for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyUsage = await Profile.aggregate([
      { $match: { userId } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "deduction",
          "transactions.createdAt": { $gte: thirtyDaysAgo },
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

    return res.json({
      userId,
      totalCost: totalCost.toFixed(2),
      totalTokens,
      totalMessages,
      totalConversations: conversationCount,
      modelUsage: modelUsageWithPercentage,
      dailyUsage: dailyUsageFormatted,
      balance: profile.balance || 0,
    });
  } catch (error: any) {
    console.error("Error fetching user analytics:", error);
    return res.status(500).json({ error: "Failed to fetch user analytics" });
  }
}

/**
 * GET /api/admin/analytics/project/:projectId
 * Get analytics for a specific project
 * Permissions: Project admins can see their project's analytics, org admins can see projects in their org, full admins can see all
 */
export async function getProjectAnalytics(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { projectId } = req.params;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Project ID is required",
      });
    }

    // Check if project exists
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({
        error: "Not Found",
        message: "Project not found",
      });
    }

    // Check permissions
    const isFullAdmin = hasAdminAccess(user.role);
    const userId = user.id;
    const isProjectAdminUser =
      userId && projectId ? await isProjectAdmin(userId, projectId) : false;
    const isOrgAdminUser = userId
      ? await isOrganizationAdmin(userId, project.organizationId.toString())
      : false;

    if (!isFullAdmin && !isProjectAdminUser && !isOrgAdminUser) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You don't have permission to view this project's analytics",
      });
    }

    // Get all users in this project
    const projectMembers = await ProjectMember.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      status: "active",
    }).lean();

    const userIds = projectMembers.map((m: any) => m.userId);

    if (userIds.length === 0) {
      return res.json({
        projectId,
        projectName: project.name,
        totalCost: "0.00",
        totalTokens: 0,
        totalMessages: 0,
        totalConversations: 0,
        totalUsers: 0,
        modelUsage: [],
        dailyUsage: [],
        userBreakdown: [],
      });
    }

    // Get conversations for this project
    const conversationCount = await Conversation.countDocuments({
      adminProjectId: new mongoose.Types.ObjectId(projectId),
    });

    // OrgProjectWallet is already imported at the top

    // Aggregate analytics from OrgProjectWallet transactions (primary source for org/project conversations)
    // Query debit transactions that have analytics data (model, tokens, conversationId)
    // These fields are directly set when credits are deducted for chat messages
    const totalsResult = await OrgProjectWallet.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          // Match transactions that have analytics fields (model, tokens, or conversationId)
          $or: [
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
            { "transactions.conversationId": { $exists: true, $ne: null } },
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
          // Match transactions that have analytics fields
          $or: [
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
            { "transactions.conversationId": { $exists: true, $ne: null } },
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
              // Match transactions that have analytics fields
              $or: [
                {
                  "transactions.model": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
                { "transactions.inputTokens": { $exists: true, $ne: null } },
                { "transactions.outputTokens": { $exists: true, $ne: null } },
                { "transactions.conversationId": { $exists: true, $ne: null } },
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

    // Get deployment analytics for this project
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
    const usersCollection = getUsersCollection();
    const userBreakdownUserIds = userBreakdown
      .map((u: any) => u.userId || u._id)
      .filter(Boolean);
    const deploymentUserIds = deploymentByUser
      .map((u: any) => u._id)
      .filter(Boolean);

    const uniqueUserIds = [
      ...new Set([...userBreakdownUserIds, ...deploymentUserIds]),
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

    const userMap = new Map<string, { name: string; email: string }>();
    users.forEach((u: any) => {
      const userId = u._id.toString();
      userMap.set(userId, { name: u.name || "", email: u.email || "" });
    });

    const mappedUserBreakdown = userBreakdown.map((u: any) => {
      const userId = (u.userId || u._id).toString();
      const userInfo = userMap.get(userId) || { name: "", email: "" };
      return {
        userId: userId,
        name: userInfo.name || userInfo.email || "Unknown User",
        email: userInfo.email || "",
        tokens: u.tokens,
        cost: u.cost.toFixed(2),
        messages: u.messages,
        conversations: u.conversationCount,
      };
    });

    const responseData = {
      projectId,
      projectName: project.name,
      totalCost: totalCost.toFixed(2),
      totalTokens,
      totalMessages,
      totalConversations: conversationCount,
      totalUsers: userIds.length,
      modelUsage: modelUsageWithPercentage,
      dailyUsage: dailyUsageFormatted,
      userBreakdown: mappedUserBreakdown,
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
    };

    return res.json(responseData);
  } catch (error: any) {
    console.error("Error fetching project analytics:", error);
    return res.status(500).json({ error: "Failed to fetch project analytics" });
  }
}

/**
 * GET /api/admin/analytics/organization/:organizationId
 * Get analytics for a specific organization
 * Permissions: Org admins can see their org's analytics, full admins can see all
 */
export async function getOrganizationAnalytics(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { organizationId } = req.params;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Organization ID is required",
      });
    }

    // Check permissions
    const isFullAdmin = hasAdminAccess(user.role);
    const userId = user.id;
    const isOrgAdminUser =
      userId && organizationId
        ? await isOrganizationAdmin(userId, organizationId)
        : false;

    if (!isFullAdmin && !isOrgAdminUser) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You don't have permission to view this organization's analytics",
      });
    }

    // Get all users in this organization
    const orgMembers = await OrganizationMember.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "active",
    }).lean();

    const userIds = orgMembers.map((m: any) => m.userId);

    if (userIds.length === 0) {
      return res.json({
        organizationId,
        totalCost: "0.00",
        totalTokens: 0,
        totalMessages: 0,
        totalConversations: 0,
        totalUsers: 0,
        totalProjects: 0,
        modelUsage: [],
        dailyUsage: [],
        projectBreakdown: [],
        userBreakdown: [],
      });
    }

    // Get all projects in this organization
    const projects = await Project.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "active",
    }).lean();

    const projectIds = projects.map((p: any) => p._id);

    // Get conversations for this organization's projects
    const conversationCount = await Conversation.countDocuments({
      adminProjectId: { $in: projectIds },
    });

    // Get conversation counts per project for all projects
    const conversationCountsByProject = await Conversation.aggregate([
      {
        $match: {
          adminProjectId: { $in: projectIds },
        },
      },
      {
        $group: {
          _id: "$adminProjectId",
          count: { $sum: 1 },
        },
      },
    ]);

    const conversationMap = new Map();
    conversationCountsByProject.forEach((c: any) => {
      conversationMap.set(c._id.toString(), c.count);
    });

    // Aggregate analytics from OrgProjectWallet transactions for all projects in this organization
    // Query debit transactions that have analytics data (model, tokens, conversationId)
    const totalsResult = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          // Match transactions that have analytics fields
          $or: [
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
            { "transactions.conversationId": { $exists: true, $ne: null } },
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

    // Model usage breakdown from OrgProjectWallet
    const modelUsage = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
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
      { $match: { projectId: { $in: projectIds } } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          "transactions.createdAt": { $gte: thirtyDaysAgo },
          // Match transactions that have analytics fields
          $or: [
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
            { "transactions.conversationId": { $exists: true, $ne: null } },
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

    // Project breakdown from OrgProjectWallet
    const projectBreakdown = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          // Match transactions that have analytics fields
          $or: [
            {
              "transactions.model": {
                $exists: true,
                $ne: null,
                $nin: [null, ""],
              },
            },
            { "transactions.inputTokens": { $exists: true, $ne: null } },
            { "transactions.outputTokens": { $exists: true, $ne: null } },
            { "transactions.conversationId": { $exists: true, $ne: null } },
          ],
        },
      },
      {
        $group: {
          _id: "$projectId",
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
          users: { $addToSet: "$transactions.userId" },
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      {
        $unwind: "$project",
      },
      {
        $project: {
          projectId: "$_id",
          projectName: "$project.name",
          tokens: 1,
          cost: 1,
          messages: 1,
          conversationCount: { $size: "$conversations" },
          userCount: { $size: "$users" },
        },
      },
      { $sort: { tokens: -1 } },
      { $limit: 20 },
    ]);

    // Get team sizes (active members) for all projects
    // Count all active members regardless of their role (project_admin, member, developer, contributor, etc.)
    // Ensure projectIds are properly converted to ObjectIds for matching
    const projectIdsAsObjectIds = projectIds.map((id: any) => {
      if (id instanceof mongoose.Types.ObjectId) {
        return id;
      }
      if (mongoose.Types.ObjectId.isValid(id)) {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });

    const teamSizesByProject = await ProjectMember.aggregate([
      {
        $match: {
          projectId: { $in: projectIdsAsObjectIds },
          status: "active",
        },
      },
      {
        $group: {
          _id: "$projectId",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map for quick lookup
    const teamSizeMap = new Map();
    teamSizesByProject.forEach((t: any) => {
      teamSizeMap.set(t._id.toString(), t.count);
    });

    // Merge all projects with their activity data (or zeros if no activity)
    // This ensures projects without transactions but with team members are included
    const allProjectsMap = new Map();
    projects.forEach((project: any) => {
      const projectIdStr = project._id.toString();
      allProjectsMap.set(projectIdStr, {
        projectId: projectIdStr,
        projectName: project.name || "Unnamed Project",
        tokens: 0,
        cost: 0,
        messages: 0,
        conversations: conversationMap.get(projectIdStr) || 0,
        users: teamSizeMap.get(projectIdStr) || 0,
      });
    });

    // Update with activity data from projectBreakdown
    projectBreakdown.forEach((p: any) => {
      const projectIdStr = p.projectId.toString();
      if (allProjectsMap.has(projectIdStr)) {
        const existing = allProjectsMap.get(projectIdStr);
        existing.tokens = p.tokens;
        existing.cost = p.cost;
        existing.messages = p.messages;
        // Use conversation count from Conversation collection, not from transactions
        // (already set from conversationMap, but update if transaction count is higher)
        existing.conversations = Math.max(
          existing.conversations || 0,
          p.conversationCount || 0
        );
        // Keep the team size from ProjectMember, not from transactions
        existing.users = teamSizeMap.get(projectIdStr) || 0;
      }
    });

    const finalProjectBreakdown = Array.from(allProjectsMap.values()).sort(
      (a: any, b: any) => {
        if (b.tokens !== a.tokens) {
          return b.tokens - a.tokens;
        }
        return a.projectName.localeCompare(b.projectName);
      }
    );

    // Get deployment analytics for organization projects
    const orgDeploymentStats = await Deployment.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      { $unwind: "$conversation" },
      {
        $match: {
          "conversation.adminProjectId": { $in: projectIds },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const deploymentByProject = await Deployment.aggregate([
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "conversation",
        },
      },
      { $unwind: "$conversation" },
      {
        $match: {
          "conversation.adminProjectId": { $in: projectIds },
        },
      },
      {
        $group: {
          _id: "$conversation.adminProjectId",
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          projectId: "$_id",
          projectName: "$project.name",
          total: 1,
          successful: 1,
          failed: 1,
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    const totalOrgDeployments = orgDeploymentStats.reduce(
      (sum: number, stat: any) => sum + stat.count,
      0
    );
    const successfulOrgDeployments =
      orgDeploymentStats.find((s: any) => s._id === "success")?.count || 0;
    const failedOrgDeployments =
      orgDeploymentStats.find((s: any) => s._id === "failed")?.count || 0;

    // User breakdown from OrgProjectWallet
    const userBreakdown = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          $and: [
            {
              // Match transactions that have analytics fields
              $or: [
                {
                  "transactions.model": {
                    $exists: true,
                    $ne: null,
                    $nin: [null, ""],
                  },
                },
                { "transactions.inputTokens": { $exists: true, $ne: null } },
                { "transactions.outputTokens": { $exists: true, $ne: null } },
                { "transactions.conversationId": { $exists: true, $ne: null } },
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
          count: { $sum: 1 },
        },
      },
      { $sort: { tokens: -1 } },
      { $limit: 10 },
    ]);

    // Fetch user names for userBreakdown
    const usersCollection = getUsersCollection();
    const uniqueUserIds = [
      ...new Set(userBreakdown.map((u: any) => u._id).filter(Boolean)),
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

    const userMap = new Map<string, { name: string; email: string }>();
    users.forEach((u: any) => {
      const userId = u._id.toString();
      userMap.set(userId, { name: u.name || "", email: u.email || "" });
    });

    return res.json({
      organizationId,
      totalCost: totalCost.toFixed(2),
      totalTokens,
      totalMessages,
      totalConversations: conversationCount,
      totalUsers: userIds.length,
      totalProjects: projects.length,
      modelUsage: modelUsageWithPercentage,
      dailyUsage: dailyUsageFormatted,
      projectBreakdown: finalProjectBreakdown.map((p: any) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        tokens: p.tokens,
        cost: typeof p.cost === "number" ? p.cost.toFixed(2) : p.cost,
        messages: p.messages,
        conversations: p.conversations,
        users: p.users, // Team size from ProjectMember
      })),
      userBreakdown: userBreakdown.map((u: any) => {
        const userId = u._id.toString();
        const userInfo = userMap.get(userId) || { name: "", email: "" };
        return {
          userId: userId,
          name: userInfo.name || userInfo.email || "Unknown User",
          email: userInfo.email || "",
          tokens: u.tokens,
          cost: u.cost.toFixed(2),
          count: u.count,
        };
      }),
      deployments: {
        total: totalOrgDeployments,
        successful: successfulOrgDeployments,
        failed: failedOrgDeployments,
        byProject: deploymentByProject.map((p: any) => ({
          projectId: p.projectId.toString(),
          projectName: p.projectName,
          total: p.total,
          successful: p.successful,
          failed: p.failed,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error fetching organization analytics:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch organization analytics" });
  }
}

/**
 * GET /api/admin/analytics/wallet/organization/:organizationId
 * Get wallet transaction analytics for an organization
 * Permissions: Org admins can see their org's wallet analytics, full admins can see all
 */
export async function getOrganizationWalletAnalytics(
  req: Request,
  res: Response
) {
  try {
    const user = (req as any).user;
    const { organizationId } = req.params;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Organization ID is required",
      });
    }

    // Check permissions
    const isFullAdmin = hasAdminAccess(user.role);
    const userId = user.id;
    const isOrgAdminUser =
      userId && organizationId
        ? await isOrganizationAdmin(userId, organizationId)
        : false;

    if (!isFullAdmin && !isOrgAdminUser) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You don't have permission to view this organization's wallet analytics",
      });
    }

    // Get org wallet
    const wallet = await OrgWallet.findOne({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      type: "org_wallet",
    }).lean();

    if (!wallet) {
      return res.json({
        organizationId,
        totalCredits: 0,
        totalDebits: 0,
        totalCreditBacks: 0,
        netAmount: 0,
        transactionCount: 0,
        dailyUsage: [],
        transactionBreakdown: {
          credits: [],
          debits: [],
          creditBacks: [],
        },
      });
    }

    const transactions = wallet.transactions || [];

    // Calculate totals
    const totalCredits = transactions
      .filter((t: any) => t.type === "credit" && !t.isCreditBack)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter((t: any) => t.type === "debit")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalCreditBacks = transactions
      .filter((t: any) => t.isCreditBack)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const netAmount = totalCredits - totalDebits + totalCreditBacks;

    // Daily usage for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyTransactions = transactions.filter(
      (t: any) => new Date(t.createdAt) >= thirtyDaysAgo
    );

    const dailyUsageMap = new Map<
      string,
      {
        date: string;
        credits: number;
        debits: number;
        creditBacks: number;
      }
    >();

    dailyTransactions.forEach((t: any) => {
      if (!t.createdAt) return;
      const date = new Date(t.createdAt).toISOString().split("T")[0];
      if (!date) return;
      if (!dailyUsageMap.has(date)) {
        dailyUsageMap.set(date, {
          date,
          credits: 0,
          debits: 0,
          creditBacks: 0,
        });
      }
      const dayData = dailyUsageMap.get(date);
      if (!dayData) return;
      if (t.isCreditBack) {
        dayData.creditBacks += t.amount;
      } else if (t.type === "credit") {
        dayData.credits += t.amount;
      } else if (t.type === "debit") {
        dayData.debits += t.amount;
      }
    });

    const dailyUsage = Array.from(dailyUsageMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        label: new Date(day.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        credits: day.credits,
        debits: day.debits,
        creditBacks: day.creditBacks,
      }));

    // Transaction breakdown
    const credits = transactions
      .filter((t: any) => t.type === "credit" && !t.isCreditBack)
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `credit-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        stripePaymentId: t.stripePaymentId || null,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const debits = transactions
      .filter((t: any) => t.type === "debit")
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `debit-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const creditBacks = transactions
      .filter((t: any) => t.isCreditBack)
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `creditback-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // Fetch user names for performedBy fields in all transactions
    const usersCollection = getUsersCollection();
    const allPerformedByIds = [
      ...new Set([
        ...credits.map((t: any) => t.performedBy),
        ...debits.map((t: any) => t.performedBy),
        ...creditBacks.map((t: any) => t.performedBy),
      ]),
    ]
      .filter((id: any) => {
        if (!id) return false;
        try {
          const idStr = typeof id === "string" ? id : id.toString();
          return mongoose.Types.ObjectId.isValid(idStr);
        } catch {
          return false;
        }
      })
      .map((id: any) => {
        const idStr = typeof id === "string" ? id : id.toString();
        return new ObjectId(idStr);
      });

    const users =
      allPerformedByIds.length > 0
        ? await usersCollection
            .find({
              _id: { $in: allPerformedByIds },
            })
            .toArray()
        : [];

    const userMap = new Map<string, { name: string; email: string }>();
    users.forEach((u: any) => {
      const userId = u._id.toString();
      userMap.set(userId, { name: u.name || "", email: u.email || "" });
    });

    return res.json({
      organizationId,
      totalCredits: totalCredits.toFixed(2),
      totalDebits: totalDebits.toFixed(2),
      totalCreditBacks: totalCreditBacks.toFixed(2),
      netAmount: netAmount.toFixed(2),
      currentBalance: wallet.balance || 0,
      transactionCount: transactions.length,
      dailyUsage,
      transactionBreakdown: {
        credits: credits.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
        debits: debits.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
        creditBacks: creditBacks.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
      },
    });
  } catch (error: any) {
    console.error("Error fetching organization wallet analytics:", error);
    return res.status(500).json({
      error: "Failed to fetch organization wallet analytics",
    });
  }
}

/**
 * GET /api/admin/analytics/wallet/project/:projectId
 * Get wallet transaction analytics for a project
 * Permissions: Project admins can see their project's wallet analytics, org admins can see projects in their org, full admins can see all
 */
export async function getProjectWalletAnalytics(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { projectId } = req.params;

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Project ID is required",
      });
    }

    // Check if project exists
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({
        error: "Not Found",
        message: "Project not found",
      });
    }

    // Check permissions
    const isFullAdmin = hasAdminAccess(user.role);
    const userId = user.id;
    const isProjectAdminUser =
      userId && projectId ? await isProjectAdmin(userId, projectId) : false;
    const isOrgAdminUser = userId
      ? await isOrganizationAdmin(userId, project.organizationId.toString())
      : false;

    if (!isFullAdmin && !isProjectAdminUser && !isOrgAdminUser) {
      return res.status(403).json({
        error: "Forbidden",
        message:
          "You don't have permission to view this project's wallet analytics",
      });
    }

    // Get project wallet
    const wallet = await OrgProjectWallet.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
    }).lean();

    if (!wallet) {
      return res.json({
        projectId,
        totalCredits: 0,
        totalDebits: 0,
        totalCreditBacks: 0,
        netAmount: 0,
        transactionCount: 0,
        dailyUsage: [],
        transactionBreakdown: {
          credits: [],
          debits: [],
          creditBacks: [],
        },
      });
    }

    const transactions = wallet.transactions || [];

    // Calculate totals
    const totalCredits = transactions
      .filter((t: any) => t.type === "credit" && !t.isCreditBack)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter((t: any) => t.type === "debit")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalCreditBacks = transactions
      .filter((t: any) => t.isCreditBack)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const netAmount = totalCredits - totalDebits + totalCreditBacks;

    // Daily usage for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyTransactions = transactions.filter(
      (t: any) => new Date(t.createdAt) >= thirtyDaysAgo
    );

    const dailyUsageMap = new Map<
      string,
      {
        date: string;
        credits: number;
        debits: number;
        creditBacks: number;
      }
    >();

    dailyTransactions.forEach((t: any) => {
      if (!t.createdAt) return;
      const date = new Date(t.createdAt).toISOString().split("T")[0];
      if (!date) return;
      if (!dailyUsageMap.has(date)) {
        dailyUsageMap.set(date, {
          date,
          credits: 0,
          debits: 0,
          creditBacks: 0,
        });
      }
      const dayData = dailyUsageMap.get(date);
      if (!dayData) return;
      if (t.isCreditBack) {
        dayData.creditBacks += t.amount;
      } else if (t.type === "credit") {
        dayData.credits += t.amount;
      } else if (t.type === "debit") {
        dayData.debits += t.amount;
      }
    });

    const dailyUsage = Array.from(dailyUsageMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        label: new Date(day.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        credits: day.credits,
        debits: day.debits,
        creditBacks: day.creditBacks,
      }));

    // Transaction breakdown
    const credits = transactions
      .filter((t: any) => t.type === "credit" && !t.isCreditBack)
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `credit-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const debits = transactions
      .filter((t: any) => t.type === "debit")
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `debit-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const creditBacks = transactions
      .filter((t: any) => t.isCreditBack)
      .map((t: any, index: number) => ({
        id: t._id?.toString() || `creditback-${index}`,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description || "",
        performedBy: t.performedBy,
        createdAt: t.createdAt,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // Fetch user names for performedBy fields in all transactions
    const usersCollection = getUsersCollection();
    const allPerformedByIds = [
      ...new Set([
        ...credits.map((t: any) => t.performedBy),
        ...debits.map((t: any) => t.performedBy),
        ...creditBacks.map((t: any) => t.performedBy),
      ]),
    ]
      .filter((id: any) => {
        if (!id) return false;
        try {
          const idStr = typeof id === "string" ? id : id.toString();
          return mongoose.Types.ObjectId.isValid(idStr);
        } catch {
          return false;
        }
      })
      .map((id: any) => {
        const idStr = typeof id === "string" ? id : id.toString();
        return new ObjectId(idStr);
      });

    const users =
      allPerformedByIds.length > 0
        ? await usersCollection
            .find({
              _id: { $in: allPerformedByIds },
            })
            .toArray()
        : [];

    const userMap = new Map<string, { name: string; email: string }>();
    users.forEach((u: any) => {
      const userId = u._id.toString();
      userMap.set(userId, { name: u.name || "", email: u.email || "" });
    });

    return res.json({
      projectId,
      projectName: project.name,
      totalCredits: totalCredits.toFixed(2),
      totalDebits: totalDebits.toFixed(2),
      totalCreditBacks: totalCreditBacks.toFixed(2),
      netAmount: netAmount.toFixed(2),
      currentBalance: wallet.balance || 0,
      transactionCount: transactions.length,
      dailyUsage,
      transactionBreakdown: {
        credits: credits.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
        debits: debits.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
        creditBacks: creditBacks.slice(0, 50).map((t: any) => {
          const userId = t.performedBy
            ? typeof t.performedBy === "string"
              ? t.performedBy
              : t.performedBy.toString()
            : null;
          const userInfo = userId ? userMap.get(userId) : null;
          return {
            ...t,
            performedBy:
              userInfo?.name ||
              userInfo?.email ||
              t.performedBy ||
              "Unknown User",
            performedByEmail: userInfo?.email || "",
          };
        }),
      },
    });
  } catch (error: any) {
    console.error("Error fetching project wallet analytics:", error);
    return res.status(500).json({
      error: "Failed to fetch project wallet analytics",
    });
  }
}
