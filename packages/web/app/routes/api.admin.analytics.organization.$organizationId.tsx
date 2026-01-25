import { OrganizationMember, OrgProjectWallet, Project, ProjectMember } from "@nowgai/shared/models";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Conversation from "~/models/conversationModel";
import Deployment from "~/models/deploymentModel";
import type { Route } from "./+types/api.admin.analytics.organization.$organizationId";

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    await requireAdmin(request);
    const organizationId = params.organizationId;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectToDatabase();

    // Get all users in this organization
    const orgMembers = await OrganizationMember.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "active",
    }).lean();

    const userIds = orgMembers.map((m: any) => m.userId);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({
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
          deployments: {
            total: 0,
            successful: 0,
            failed: 0,
            byProject: [],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
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

    // Aggregate analytics from OrgProjectWallet transactions for all projects in this organization
    // Include all debit transactions with conversationId, even if other analytics fields are missing
    const totalsResult = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
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
        totalTokens > 0 ? ((model.tokens / totalTokens) * 100).toFixed(2) : "0",
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

    // Project breakdown from OrgProjectWallet - get projects with activity
    const projectBreakdownWithActivity = await OrgProjectWallet.aggregate([
      { $match: { projectId: { $in: projectIds } } },
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
        $project: {
          projectId: "$_id",
          tokens: 1,
          cost: 1,
          messages: 1,
          conversationCount: { $size: "$conversations" },
          userCount: { $size: "$users" },
        },
      },
    ]);

    // Get conversation counts for all projects
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
          members: {
            $push: {
              id: { $toString: "$userId" },
            },
          },
        },
      },
    ]);

    // Get wallet info for credits usage (current balance vs max credit limit)
    const walletsByProject = await OrgProjectWallet.find({
      projectId: { $in: projectIds },
    })
      .select("projectId balance creditLimit")
      .lean();

    // Get the first conversation for each project (for redirecting to workspace)
    const conversationsByProject = await Conversation.aggregate([
      {
        $match: {
          adminProjectId: { $in: projectIds },
        },
      },
      {
        $sort: { updatedAt: -1 },
      },
      {
        $group: {
          _id: "$adminProjectId",
          conversationId: { $first: { $toString: "$_id" } },
          lastUpdated: { $first: "$updatedAt" },
        },
      },
    ]);

    // Create maps for quick lookup
    const activityMap = new Map();
    projectBreakdownWithActivity.forEach((p: any) => {
      activityMap.set(p.projectId.toString(), p);
    });

    const conversationMap = new Map();
    conversationCountsByProject.forEach((c: any) => {
      conversationMap.set(c._id.toString(), c.count);
    });

    const teamSizeMap = new Map();
    const teamMembersMap = new Map();
    teamSizesByProject.forEach((t: any) => {
      teamSizeMap.set(t._id.toString(), t.count);
      teamMembersMap.set(t._id.toString(), t.members || []);
    });

    // Collect all unique user IDs from team members to fetch their details
    const allTeamMemberIds = new Set<string>();
    teamSizesByProject.forEach((t: any) => {
      (t.members || []).forEach((m: any) => {
        if (m.id) allTeamMemberIds.add(m.id);
      });
    });

    // Fetch user details for team members
    const { usersCollection } = await getUsersCollection();
    const teamMemberUserIds = Array.from(allTeamMemberIds).filter(
      (id) => id && mongoose.Types.ObjectId.isValid(id)
    );
    
    const teamMemberUsers = teamMemberUserIds.length > 0
      ? await usersCollection
          .find({
            _id: { $in: teamMemberUserIds.map((id) => new ObjectId(id)) },
          })
          .toArray()
      : [];

    const teamMemberUserMap = new Map<string, { name: string; avatar: string }>();
    teamMemberUsers.forEach((u: any) => {
      const odId = u._id.toString();
      teamMemberUserMap.set(odId, {
        name: u.name || u.email || "User",
        avatar: u.image || "",
      });
    });

    const walletMap = new Map();
    walletsByProject.forEach((w: any) => {
      walletMap.set(w.projectId.toString(), {
        balance: w.balance || 0,
        creditLimit: w.creditLimit || 1000,
      });
    });

    const conversationIdMap = new Map();
    const lastUpdatedMap = new Map();
    conversationsByProject.forEach((c: any) => {
      conversationIdMap.set(c._id.toString(), c.conversationId);
      lastUpdatedMap.set(c._id.toString(), c.lastUpdated);
    });

    // Merge all projects with their activity data (or zeros if no activity)
    const projectBreakdown = projects.map((project: any) => {
      const projectIdStr = project._id.toString();
      const activity = activityMap.get(projectIdStr);
      const teamSize = teamSizeMap.get(projectIdStr) || 0;
      const teamMembers = teamMembersMap.get(projectIdStr) || [];
      const wallet = walletMap.get(projectIdStr) || { balance: 0, creditLimit: 1000 };
      const conversationId = conversationIdMap.get(projectIdStr) || null;
      const lastUpdated = lastUpdatedMap.get(projectIdStr) || project.updatedAt || project.createdAt;

      // Enrich team members with user details (name, avatar)
      const enrichedTeamMembers = teamMembers.slice(0, 5).map((m: any) => {
        const userDetails = teamMemberUserMap.get(m.id) || { name: "User", avatar: "" };
        return {
          id: m.id,
          name: userDetails.name,
          avatar: userDetails.avatar,
        };
      });

      return {
        projectId: projectIdStr,
        projectName: project.name || "Unnamed Project",
        tokens: activity?.tokens || 0,
        cost: activity?.cost || 0,
        messages: activity?.messages || 0,
        conversations: conversationMap.get(projectIdStr) || 0,
        users: teamSize,
        status: project.status || "active",
        createdAt: project.createdAt?.toISOString?.() || new Date().toISOString(),
        lastUpdated: lastUpdated?.toISOString?.() || lastUpdated || new Date().toISOString(),
        creditsUsage: {
          current: wallet.creditLimit - wallet.balance,
          max: wallet.creditLimit,
        },
        team: enrichedTeamMembers,
        conversationId,
      };
    });

    // Sort by tokens (descending), then by project name
    projectBreakdown.sort((a: any, b: any) => {
      if (b.tokens !== a.tokens) {
        return b.tokens - a.tokens;
      }
      return a.projectName.localeCompare(b.projectName);
    });

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
    const { usersCollection: usersColl } = await getUsersCollection();
    const uniqueUserIds = [
      ...new Set(userBreakdown.map((u: any) => u._id)),
    ].filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    const users =
      uniqueUserIds.length > 0
        ? await usersColl
            .find({
              _id: {
                $in: uniqueUserIds.map((id: string) => new ObjectId(id)),
              },
            })
            .toArray()
        : [];

    const userMap = new Map<string, { name: string; email: string }>(
      users.map((u: any) => [
        u._id.toString(),
        { name: u.name || "", email: u.email || "" },
      ])
    );

    return new Response(
      JSON.stringify({
        organizationId,
        totalCost: totalCost.toFixed(2),
        totalTokens,
        totalMessages,
        totalConversations: conversationCount,
        totalUsers: userIds.length,
        totalProjects: projects.length,
        modelUsage: modelUsageWithPercentage,
        dailyUsage: dailyUsageFormatted,
        projectBreakdown: projectBreakdown.map((p: any) => ({
          projectId: p.projectId.toString(),
          projectName: p.projectName,
          tokens: p.tokens,
          cost: typeof p.cost === "number" ? p.cost.toFixed(2) : p.cost,
          messages: p.messages,
          conversations: p.conversations,
          users: p.users,
          status: p.status,
          createdAt: p.createdAt,
          lastUpdated: p.lastUpdated,
          creditsUsage: p.creditsUsage,
          team: p.team,
          conversationId: p.conversationId,
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error fetching organization analytics:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
