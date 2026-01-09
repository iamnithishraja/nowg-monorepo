import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import Project from "~/models/projectModel";
import OrgProjectWallet from "~/models/orgProjectWalletModel";
import Organization from "~/models/organizationModel";
import { isProjectAdmin } from "~/lib/projectRoles";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { hasAdminAccess } from "~/lib/types/roles";
import { ObjectId } from "mongodb";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await connectToDatabase();
    const user = await requireAdmin(request);
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
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
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (user?.id) {
      const hasAccess = await isProjectAdmin(user.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(user.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access wallets for projects where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find existing wallet or create new one
    let wallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    });

    if (!wallet) {
      // Create new wallet for the project
      wallet = new OrgProjectWallet({
        projectId: projectId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(`✅ Created new wallet for project: ${project.name}`);
    }

    const organization = await Organization.findById(project.organizationId);

    return new Response(
      JSON.stringify({
        wallet: {
          id: wallet._id.toString(),
          projectId: wallet.projectId.toString(),
          projectName: project.name,
          organizationId: project.organizationId.toString(),
          organizationName: organization?.name || "",
          balance: wallet.balance,
          transactionCount: wallet.transactions?.length || 0,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error getting/creating project wallet:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get project wallet",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

