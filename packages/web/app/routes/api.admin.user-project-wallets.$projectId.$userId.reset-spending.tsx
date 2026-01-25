import { Project } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import UserProjectWallet from "~/models/userProjectWalletModel";

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

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
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
              "You must be a project admin or org admin to reset spending",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Prevent project admin from resetting their own spending
      // Only block if they are ONLY a project admin (not org admin or system admin)
      if (
        hasProjectAccess &&
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role) &&
        adminUser.id === userId
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You cannot reset spending for yourself. Please contact an organization admin or system admin.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find user project wallet
    const wallet = await UserProjectWallet.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!wallet) {
      return new Response(
        JSON.stringify({
          error: "User wallet not found",
          message: "No wallet found for this user in this project.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Reset spending to 0
    const previousSpending = wallet.currentSpending || 0;
    wallet.currentSpending = 0;
    await wallet.save();

    console.log(
      `✅ Reset spending for user ${userId} in project: ${project.name} from $${previousSpending.toFixed(2)} to $0`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Spending reset successfully",
        wallet: {
          id: wallet._id.toString(),
          userId: wallet.userId,
          projectId: wallet.projectId.toString(),
          projectName: project.name,
          balance: wallet.balance,
          limit: wallet.limit ?? null,
          currentSpending: wallet.currentSpending,
          previousSpending,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error resetting user project wallet spending:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to reset spending",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

