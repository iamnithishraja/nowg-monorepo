import { OrgWallet, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess, ProjectRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import Organization from "~/models/organizationModel";
import Project from "~/models/projectModel";

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

    // Check permissions: user must be org admin, system admin, or project admin for a project in this organization
    if (user?.id) {
      const hasOrgAccess = await isOrganizationAdmin(user.id, organizationId);
      const hasSystemAccess = hasAdminAccess(user.role);
      
      // Check if user is project admin for any project in this organization
      // This can be via ProjectMember role OR via Project.projectAdminId
      let hasProjectAdminAccess = false;
      if (!hasOrgAccess && !hasSystemAccess) {
        // Check 1: ProjectMember with project_admin role
        const projectAdminMembership = await ProjectMember.findOne({
          userId: user.id,
          organizationId: new mongoose.Types.ObjectId(organizationId),
          role: ProjectRole.PROJECT_ADMIN,
          status: "active",
        }).lean();
        
        if (projectAdminMembership) {
          hasProjectAdminAccess = true;
        } else {
          // Check 2: Project.projectAdminId
          const projectAsAdmin = await Project.findOne({
            organizationId: new mongoose.Types.ObjectId(organizationId),
            projectAdminId: user.id,
          }).lean();
          
          hasProjectAdminAccess = !!projectAsAdmin;
        }
      }
      
      if (!hasOrgAccess && !hasSystemAccess && !hasProjectAdminAccess) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access wallets for organizations where you are an admin or project admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Find existing wallet or create new one
    let wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!wallet) {
      // Create new wallet for the organization
      wallet = new OrgWallet({
        organizationId: organizationId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(
        `✅ Created new wallet for organization: ${organization.name}`
      );
    }

    return new Response(
      JSON.stringify({
        wallet: {
          id: wallet._id.toString(),
          organizationId: wallet.organizationId.toString(),
          organizationName: organization.name,
          type: wallet.type,
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
    console.error("Error getting/creating org wallet:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get organization wallet",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
