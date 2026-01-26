import { Organization, OrganizationMember } from "@nowgai/shared/models";
import { hasAdminAccess, OrganizationRole } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { organizationId, userId } = params;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "PUT" && request.method !== "PATCH") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    const body = await request.json();
    const { role } = body;

    if (!role || typeof role !== "string") {
      return new Response(JSON.stringify({ error: "Role is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate role
    if (role !== OrganizationRole.ORG_ADMIN && role !== OrganizationRole.ORG_USER) {
      return new Response(
        JSON.stringify({
          error: "Invalid role",
          message: "Role must be either 'org_admin' or 'org_user'",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get organization
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

    // Check permissions
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(adminUser.id, organizationId);
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only update users in organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Find organization member
    const orgMember = await OrganizationMember.findOne({
      organizationId: organizationId,
      userId: userId,
      status: "active",
    });

    if (!orgMember) {
      return new Response(
        JSON.stringify({
          error: "User is not an active member of this organization",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prevent removing the last org admin
    if (orgMember.role === OrganizationRole.ORG_ADMIN && role === OrganizationRole.ORG_USER) {
      // Check if there are other org admins
      const otherAdmins = await OrganizationMember.countDocuments({
        organizationId: organizationId,
        role: OrganizationRole.ORG_ADMIN,
        status: "active",
        userId: { $ne: userId },
      });

      if (otherAdmins === 0) {
        return new Response(
          JSON.stringify({
            error: "Cannot remove last organization admin",
            message:
              "You cannot remove the last organization admin. Please assign a new admin first.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Update role
    orgMember.role = role;
    orgMember.updatedAt = new Date();
    await orgMember.save();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Organization role updated successfully",
        member: {
          id: orgMember._id.toString(),
          userId: orgMember.userId,
          role: orgMember.role,
          status: orgMember.status,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error updating organization member role:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update organization member role",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

