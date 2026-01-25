import { OrganizationMember, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess, OrganizationRole, ProjectRole, UserRole } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";
import { isProjectAdmin } from "~/lib/projectRoles";
import Organization from "~/models/organizationModel";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);
    const { organizationId } = params;

    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid organization ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await connectToDatabase();

    // Get query parameters first to check project-specific permissions
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const forAdmin = url.searchParams.get("forAdmin") === "true";
    const currentUserId = adminUser?.id || null;

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

    // Check permissions - must be either:
    // 1. Super admin (hasAdminAccess)
    // 2. Organization admin for this organization
    // 3. Project admin for the specific project (if projectId is provided)
    // 4. Project admin for any project in this organization (if no projectId)
    if (adminUser?.id) {
      const hasOrgAdminAccess = (adminUser as any)?.hasOrgAdminAccess || false;
      const hasProjectAdminAccess =
        (adminUser as any)?.hasProjectAdminAccess || false;

      // Check if user is org admin for this organization
      const isOrgAdminByRole =
        adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccess;
      const hasOrgAccess = isOrgAdminByRole
        ? await isOrganizationAdmin(adminUser.id, organizationId)
        : false;

      // Check project admin access
      const isProjectAdminByRole =
        adminUser?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;
      let hasProjectAccess = false;
      
      if (isProjectAdminByRole) {
        if (projectId && ObjectId.isValid(projectId)) {
          // If projectId is provided, check if user is project admin for THIS specific project
          const isProjectAdminForThisProject = await isProjectAdmin(adminUser.id, projectId);
          hasProjectAccess = isProjectAdminForThisProject;
        } else {
          // If no projectId, check if user is project admin for any project in this organization
          const projectAdminMemberships = await ProjectMember.find({
            userId: adminUser.id,
            organizationId: organizationId,
            role: ProjectRole.PROJECT_ADMIN,
            status: "active",
          }).lean();
          hasProjectAccess = projectAdminMemberships.length > 0;
        }
      }

      const hasAccess = hasAdminAccess(adminUser.role) || hasOrgAccess || hasProjectAccess;

      if (!hasAccess) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only access organizations where you are an admin or project admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get organization members
    let orgMembersQuery: any = {
      organizationId: organizationId,
      status: "active",
    };

    // If not for admin assignment, only get org_user role members
    if (!forAdmin) {
      orgMembersQuery.role = OrganizationRole.ORG_USER;
    }

    const orgMembers = await OrganizationMember.find(orgMembersQuery).lean();
    const userIds = orgMembers.map((m: any) => m.userId?.toString()).filter(Boolean);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({
          users: [],
          organization: {
            id: organization._id.toString(),
            name: organization.name,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get user details - convert userIds to ObjectIds, filtering out invalid ones
    // Ensure database connection is fully established
    let usersCollection, mongoClient;
    try {
      const result = await getUsersCollection();
      if (!result || !result.usersCollection || !result.mongoClient) {
        throw new Error("Failed to get users collection: client is null");
      }
      usersCollection = result.usersCollection;
      mongoClient = result.mongoClient;
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: "Database connection error",
          message: error.message || "Failed to connect to database",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const validObjectIds = userIds
      .filter((id: string) => id && ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));

    const orgUsers = await usersCollection
      .find({
        _id: { $in: validObjectIds },
      })
      .toArray();

    // If projectId is provided, filter out users already assigned to this project
    let assignedUserIds: string[] = [];
    if (projectId && ObjectId.isValid(projectId)) {
      const existingMembers = await ProjectMember.find({
        projectId: projectId,
        status: "active",
      }).lean();
      assignedUserIds = existingMembers.map((m: any) => m.userId?.toString()).filter(Boolean);
    }

    // Check if current user is org admin (to prevent self-assignment)
    let isCurrentUserOrgAdmin = false;
    if (currentUserId) {
      isCurrentUserOrgAdmin = await isOrganizationAdmin(
        currentUserId,
        organizationId
      );
    }

    // Format response
    const availableUsers = orgUsers
      .filter((u: any) => {
        const userId = u._id.toString();
        // Exclude users already assigned to this project
        if (assignedUserIds.includes(userId)) {
          return false;
        }
        // Exclude current user if they are org_admin (prevent self-assignment)
        if (
          currentUserId &&
          userId === currentUserId &&
          isCurrentUserOrgAdmin
        ) {
          return false;
        }
        return true;
      })
      .map((u: any) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name || "",
        role: u.role,
      }));

    // Note: Do NOT close mongoClient - it's a shared singleton
    // The MongoDB driver manages connection pooling automatically

    return new Response(
      JSON.stringify({
        users: availableUsers,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    return new Response(
      JSON.stringify({
        error: "Failed to fetch available users",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

