import { OrganizationMember, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess, OrganizationRole } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import Organization from "~/models/organizationModel";
import OrgUserInvitation from "~/models/orgUserInvitationModel";
import Project from "~/models/projectModel";
import type { Route } from "./+types/api.admin.organizations.$organizationId.users.$userId";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * DELETE /api/admin/organizations/:organizationId/users/:userId
 * Remove a user from an organization
 */
export async function action({ request, params }: Route.ActionArgs) {
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

    if (!userId || !ObjectId.isValid(userId)) {
      return new Response(JSON.stringify({ error: "Invalid user ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

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

    // If user has org admin role, check if they are admin for this organization
    if (adminUser?.id) {
      const hasAccess = await isOrganizationAdmin(
        adminUser.id,
        organizationId
      );
      if (!hasAccess && !hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only remove users from organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get user
    const { usersCollection, mongoClient } = await getUsersCollection();
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user is a member of this organization using OrganizationMember
    const orgMember = await OrganizationMember.findOne({
      organizationId: organizationId,
      userId: userId,
      status: "active",
    });

    if (!orgMember) {
      return new Response(
        JSON.stringify({
          error: "User is not a member of this organization",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prevent removing the org admin
    if (orgMember.role === OrganizationRole.ORG_ADMIN) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot remove organization admin. Please assign a new admin first.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Clean up any accepted invitations for this user in this organization
    // This prevents issues when re-inviting the user later
    await OrgUserInvitation.updateMany(
      {
        organizationId: organizationId,
        userId: userId,
        status: "accepted",
      },
      {
        $set: {
          status: "expired", // Mark as expired so it doesn't interfere with future invitations
        },
      }
    );

    // Suspend all project memberships for this user in projects from this organization
    await ProjectMember.updateMany(
      {
        userId: userId,
        organizationId: organizationId,
        status: "active",
      },
      {
        $set: {
          status: "suspended", // Suspend instead of delete to maintain history
        },
      }
    );

    // If user is a project admin, clear them from the project
    const projectsWhereAdmin = await Project.find({
      organizationId: organizationId,
      projectAdminId: userId,
    });

    if (projectsWhereAdmin.length > 0) {
      await Project.updateMany(
        {
          organizationId: organizationId,
          projectAdminId: userId,
        },
        {
          $set: {
            projectAdminId: null,
            invitationStatus: null,
            invitationToken: null,
            invitedAt: null,
            invitedBy: null,
          },
        }
      );
    }

    // Delete OrganizationMember entry (this removes user from organization)
    await OrganizationMember.deleteOne({
      organizationId: organizationId,
      userId: userId,
    });

    // Check if user has other organizations - if not, clear organizationId from user
    const otherOrgs = await OrganizationMember.findOne({
      userId: userId,
      status: "active",
    });

    if (!otherOrgs) {
      // User has no other organizations, clear organizationId
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            organizationId: null,
          },
        }
      );
    }
    // Don't update user.role or user.projectId - roles are stored in OrganizationMember/ProjectMember

    await mongoClient.close();

    console.log(
      `✅ Removed user ${userId} from organization ${organizationId}. Cleared projectId and suspended ${projectsWhereAdmin.length} project admin assignments.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "User removed from organization successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error removing user from organization:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to remove user from organization",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

