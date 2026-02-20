import { Organization, OrganizationMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { ActionFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { sendEnterpriseRequestRejectedEmail } from "~/lib/email";
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

    // Only allow system admins (ADMIN or TECH_SUPPORT) to reject organizations
    if (!hasAdminAccess(adminUser.role)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Only system admins can reject organizations." }),
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

    // Get rejection reason from body
    let reason = "";
    try {
      const body = await request.json();
      reason = body.reason || "";
    } catch {
      // No body or invalid JSON, proceed without reason
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
    organization.approvalStatus = "rejected";
    organization.status = "suspended";
    organization.approvalReviewedBy = adminUser.id;
    organization.approvalReviewedAt = new Date();
    organization.approvalNotes = reason || null;
    organization.updatedAt = new Date();

    await organization.save();

    // Update organization member status to rejected
    await OrganizationMember.updateMany(
      { organizationId: organization._id, status: "pending" },
      { $set: { status: "rejected" } }
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

    // Send rejection email
    if (orgAdminEmail) {
      try {
        await sendEnterpriseRequestRejectedEmail({
          to: orgAdminEmail,
          userName: orgAdminName,
          organizationName: organization.name,
          reason: reason || undefined,
        });
      } catch (emailError) {
        console.error("Error sending rejection email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Organization rejected successfully",
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
    console.error("Error rejecting organization:", error);
    if (error instanceof Response) {
      throw error;
    }
    return new Response(
      JSON.stringify({
        error: "Failed to reject organization",
        message: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
