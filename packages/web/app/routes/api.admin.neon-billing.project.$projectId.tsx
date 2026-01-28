import { Conversation, Project } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import NeonUsageBilling from "~/models/neonUsageBillingModel";

/**
 * API Route: Get Neon Billing Summary for an Admin Project
 * GET /api/admin/neon-billing/project/:projectId
 *
 * Returns aggregated billing summary for all conversations within a project
 * Requires project admin, org admin, or system admin access
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: "Invalid project ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check permissions
    if (user?.id) {
      const hasProjectAccess = await isProjectAdmin(user.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasProjectAccess && !hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "You don't have access to this project's billing data",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get URL params for pagination and filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const includeUsageRecords = url.searchParams.get("includeUsage") === "true";

    // Find all billing records for conversations in this project
    const billingRecords = await NeonUsageBilling.find({
      adminProjectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ lastBilledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalRecords = await NeonUsageBilling.countDocuments({
      adminProjectId: new mongoose.Types.ObjectId(projectId),
    });

    // Get conversation details for each billing record
    const conversationIds = billingRecords.map((r: any) => r.conversationId);
    const conversations = await Conversation.find({
      _id: { $in: conversationIds },
    })
      .select("_id title neon.projectId")
      .lean();

    const conversationMap = new Map(
      conversations.map((c: any) => [c._id.toString(), c])
    );

    // Calculate aggregate stats
    let totalBilledAmount = 0;
    let totalCarryForward = 0;
    let totalUsageRecordsCount = 0;
    let activeConversations = 0;
    let errorConversations = 0;

    const formattedRecords = billingRecords.map((record: any) => {
      totalBilledAmount += record.totalBilledAmount || 0;
      totalCarryForward += record.carryForwardCost || 0;
      totalUsageRecordsCount += record.totalUsageRecords || 0;

      if (record.status === "active") activeConversations++;
      if (record.status === "error") errorConversations++;

      const conversation = conversationMap.get(record.conversationId.toString());

      const result: any = {
        id: record._id.toString(),
        conversationId: record.conversationId.toString(),
        conversationTitle: (conversation as any)?.title || "Unknown",
        neonProjectId: record.neonProjectId,
        status: record.status,
        totalBilledAmount: record.totalBilledAmount || 0,
        carryForwardCost: record.carryForwardCost || 0,
        lastBilledAt: record.lastBilledAt,
        totalUsageRecords: record.totalUsageRecords || 0,
        lastError: record.lastError,
        lastErrorAt: record.lastErrorAt,
        createdAt: record.createdAt,
      };

      // Include recent usage records if requested
      if (includeUsageRecords && record.usageRecords?.length > 0) {
        result.recentUsage = record.usageRecords
          .slice(-24)
          .map((u: any) => ({
            periodStart: u.periodStart,
            periodEnd: u.periodEnd,
            computeTimeSeconds: u.computeTimeSeconds,
            logicalSizeBytesHour: u.logicalSizeBytesHour,
            computeCost: u.computeCost,
            storageCost: u.storageCost,
            totalCost: u.totalCost,
            billed: u.billed,
          }));
      }

      return result;
    });

    // Get total billing across ALL records in this project (not just paginated)
    const allBillingStats = await NeonUsageBilling.aggregate([
      {
        $match: {
          adminProjectId: new mongoose.Types.ObjectId(projectId),
        },
      },
      {
        $group: {
          _id: null,
          totalBilledAmount: { $sum: "$totalBilledAmount" },
          totalCarryForward: { $sum: "$carryForwardCost" },
          totalUsageRecords: { $sum: "$totalUsageRecords" },
        },
      },
    ]);

    const aggregateStats =
      allBillingStats.length > 0
        ? {
            totalBilledAmount: allBillingStats[0].totalBilledAmount || 0,
            totalCarryForward: allBillingStats[0].totalCarryForward || 0,
            totalUsageRecords: allBillingStats[0].totalUsageRecords || 0,
          }
        : {
            totalBilledAmount: 0,
            totalCarryForward: 0,
            totalUsageRecords: 0,
          };

    return new Response(
      JSON.stringify({
        success: true,
        project: {
          id: project._id.toString(),
          name: project.name,
          organizationId: project.organizationId.toString(),
        },
        summary: {
          totalConversations: totalRecords,
          activeConversations,
          errorConversations,
          ...aggregateStats,
        },
        billingRecords: formattedRecords,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[NeonBilling] Error getting project billing:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get project billing data",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

