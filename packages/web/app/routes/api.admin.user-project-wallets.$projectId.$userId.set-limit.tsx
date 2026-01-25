import { OrgProjectWallet, Project, ProjectMember, UserProjectWallet } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { projectId, userId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return new Response(JSON.stringify({ error: "Invalid project ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    const body = await request.json();
    const { limit } = body;

    // Validate limit
    let limitValue: number | null = null;
    if (limit !== null && limit !== undefined && limit !== "") {
      limitValue = parseFloat(limit);
      if (isNaN(limitValue) || limitValue < 0) {
        return new Response(
          JSON.stringify({
            error: "Invalid limit",
            message: "Limit must be a positive number or null",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check project wallet balance if limit is being set
    if (limitValue !== null && limitValue > 0) {
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      });

      if (!projectWallet) {
        return new Response(
          JSON.stringify({
            error: "Project wallet not found",
            message:
              "Project wallet does not exist. Please create a project wallet first.",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validate that the limit doesn't exceed the project wallet balance
      if (limitValue > projectWallet.balance) {
        return new Response(
          JSON.stringify({
            error: "Limit exceeds project wallet balance",
            message: `Cannot set limit of $${limitValue.toFixed(
              2
            )}. Project wallet balance is $${projectWallet.balance.toFixed(
              2
            )}. The user limit cannot exceed the available project wallet balance.`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check if user is a member of the project
    const projectMember = await ProjectMember.findOne({
      projectId: projectId,
      userId: userId,
      status: "active",
    });

    if (!projectMember) {
      return new Response(
        JSON.stringify({
          error: "User is not an active member of this project",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions: must be project admin, org admin, or system admin
    if (adminUser?.id) {
      const hasProjectAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );

      if (
        !hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role)
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You must be a project admin or org admin to set wallet limits",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

    }

    // Find or create user project wallet
    let wallet = await UserProjectWallet.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!wallet) {
      // Create new wallet for the user in this project
      wallet = new UserProjectWallet({
        userId: userId,
        projectId: projectId,
        organizationId: project.organizationId,
        balance: 0, // Users don't have balance
        limit: limitValue,
        currentSpending: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(
        `✅ Created new wallet for user ${userId} in project: ${project.name} with limit: ${limitValue}`
      );
    } else {
      // Update limit
      wallet.limit = limitValue;
      await wallet.save();
      console.log(
        `✅ Updated wallet limit for user ${userId} in project: ${project.name} to: ${limitValue}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Wallet limit ${
          limitValue === null ? "removed" : "updated"
        } successfully`,
        wallet: {
          id: wallet._id.toString(),
          userId: wallet.userId,
          projectId: wallet.projectId.toString(),
          projectName: project.name,
          balance: wallet.balance,
          limit: wallet.limit ?? null,
          currentSpending: wallet.currentSpending || 0,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error setting user project wallet limit:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to set wallet limit",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

