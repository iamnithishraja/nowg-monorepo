import { Organization, OrganizationMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { ActionFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { sendEnterpriseRequestApprovedEmail } from "~/lib/email";
import { ObjectId } from "mongodb";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await connectToDatabase();
    const adminUser = await requireAdmin(request);

    // Only allow system admins (ADMIN or TECH_SUPPORT) to approve organizations
    if (!hasAdminAccess(adminUser.role)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Only system admins can approve organizations." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { organizationId } = params;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Find the organization
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

    // Check if organization is pending approval
    if (organization.approvalStatus !== "pending") {
      return new Response(
        JSON.stringify({ 
          error: "Organization is not pending approval",
          currentStatus: organization.approvalStatus,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Update organization status
    organization.approvalStatus = "approved";
    organization.status = "active";
    organization.approvalReviewedBy = adminUser.id;
    organization.approvalReviewedAt = new Date();
    organization.updatedAt = new Date();

    await organization.save();

    // Update organization member status to active
    await OrganizationMember.updateMany(
      { organizationId: organization._id, status: "pending" },
      { $set: { status: "active" } }
    );

    // Get org admin details for email
    let orgAdminEmail = "";
    let orgAdminName = "";
    
    if (organization.orgAdminId) {
      try {
        const { usersCollection } = await getUsersCollection();
        const orgAdmin = await usersCollection.findOne({
          _id: new ObjectId(organization.orgAdminId),
        });
        
        if (orgAdmin) {
          orgAdminEmail = orgAdmin.email;
          orgAdminName = orgAdmin.name || orgAdmin.email;
        }
      } catch (error) {
        console.error("Error fetching org admin for email:", error);
      }
    }

    // Send approval email
    if (orgAdminEmail) {
      try {
        await sendEnterpriseRequestApprovedEmail({
          to: orgAdminEmail,
          userName: orgAdminName,
          organizationName: organization.name,
        });
      } catch (emailError) {
        console.error("Error sending approval email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Organization approved successfully",
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          approvalStatus: organization.approvalStatus,
          status: organization.status,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error approving organization:", error);
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to approve organization",
        message: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
