import { hasAdminAccess } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import NeonUsageBilling from "~/models/neonUsageBillingModel";
import Organization from "~/models/organizationModel";
import Project from "~/models/projectModel";

/**
 * API Route: Get Neon Billing Summary for an Organization
 * GET /api/admin/neon-billing/organization/:organizationId
 *
 * Returns aggregated billing summary across all projects in an organization
 * Requires org admin or system admin access
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { organizationId } = params;

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check permissions
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      if (!hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "You don't have access to this organization's billing data",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get URL params
    const url = new URL(request.url);
    const groupBy = url.searchParams.get("groupBy") || "project"; // "project" or "conversation"

    // Get all projects in this organization
    const projects = await Project.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "active",
    })
      .select("_id name")
      .lean();

    const projectIds = projects.map((p: any) => p._id);

    // Get aggregate stats per project
    const billingByProject = await NeonUsageBilling.aggregate([
      {
        $match: {
          adminProjectId: { $in: projectIds },
        },
      },
      {
        $group: {
          _id: "$adminProjectId",
          totalBilledAmount: { $sum: "$totalBilledAmount" },
          totalCarryForward: { $sum: "$carryForwardCost" },
          totalUsageRecords: { $sum: "$totalUsageRecords" },
          conversationCount: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          errorCount: {
            $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
          },
          lastBilledAt: { $max: "$lastBilledAt" },
        },
      },
    ]);

    // Create project lookup map
    const projectMap = new Map(
      projects.map((p: any) => [p._id.toString(), p])
    );

    // Format project billing data
    const projectBilling = billingByProject.map((item: any) => {
      const project = projectMap.get(item._id?.toString());
      return {
        projectId: item._id?.toString() || "unknown",
        projectName: (project as any)?.name || "Unknown Project",
        totalBilledAmount: item.totalBilledAmount || 0,
        totalCarryForward: item.totalCarryForward || 0,
        totalUsageRecords: item.totalUsageRecords || 0,
        conversationCount: item.conversationCount || 0,
        activeConversations: item.activeCount || 0,
        errorConversations: item.errorCount || 0,
        lastBilledAt: item.lastBilledAt,
      };
    });

    // Calculate organization totals
    const orgTotals = projectBilling.reduce(
      (acc: any, proj: any) => ({
        totalBilledAmount: acc.totalBilledAmount + proj.totalBilledAmount,
        totalCarryForward: acc.totalCarryForward + proj.totalCarryForward,
        totalUsageRecords: acc.totalUsageRecords + proj.totalUsageRecords,
        totalConversations: acc.totalConversations + proj.conversationCount,
        totalActiveConversations:
          acc.totalActiveConversations + proj.activeConversations,
        totalErrorConversations:
          acc.totalErrorConversations + proj.errorConversations,
      }),
      {
        totalBilledAmount: 0,
        totalCarryForward: 0,
        totalUsageRecords: 0,
        totalConversations: 0,
        totalActiveConversations: 0,
        totalErrorConversations: 0,
      }
    );

    // Get daily billing summary for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyBilling = await NeonUsageBilling.aggregate([
      {
        $match: {
          adminProjectId: { $in: projectIds },
        },
      },
      { $unwind: "$usageRecords" },
      {
        $match: {
          "usageRecords.periodStart": { $gte: thirtyDaysAgo },
          "usageRecords.billed": true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$usageRecords.periodStart",
            },
          },
          computeCost: { $sum: "$usageRecords.computeCost" },
          storageCost: { $sum: "$usageRecords.storageCost" },
          totalCost: { $sum: "$usageRecords.totalCost" },
          periodsCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
        summary: {
          ...orgTotals,
          projectCount: projects.length,
          projectsWithBilling: projectBilling.length,
        },
        projectBilling: projectBilling.sort(
          (a, b) => b.totalBilledAmount - a.totalBilledAmount
        ),
        dailyBilling: dailyBilling.map((day: any) => ({
          date: day._id,
          computeCost: day.computeCost,
          storageCost: day.storageCost,
          totalCost: day.totalCost,
          periodsCount: day.periodsCount,
        })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[NeonBilling] Error getting organization billing:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get organization billing data",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

