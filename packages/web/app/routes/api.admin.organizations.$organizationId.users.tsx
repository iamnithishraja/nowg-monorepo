import { Organization, OrganizationMember, Project, ProjectMember, UserProjectWallet } from "@nowgai/shared/models";
import { hasAdminAccess, UserRole } from "@nowgai/shared/types";
import { ObjectId } from "mongodb";
import type { LoaderFunctionArgs } from "react-router";
import { getUsersCollection } from "~/lib/adminHelpers";
import { requireAdmin } from "~/lib/adminMiddleware";
import { connectToDatabase } from "~/lib/mongo";
import { isOrganizationAdmin } from "~/lib/organizationRoles";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * GET /api/admin/organizations/:organizationId/users
 * Get all users in an organization with their projects, roles, and credits
 */
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

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If user has org admin role, check if they are admin for this organization
    // Check both hasOrgAdminAccess flag and role
    const hasOrgAdminAccessFlag = adminUser?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccessFlag;

    if (adminUser?.id) {
      if (isOrgAdminByRole) {
        const hasAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId
        );
        if (!hasAccess && !hasAdminAccess(adminUser.role)) {
          return new Response(
            JSON.stringify({
              error: "Forbidden",
              message:
                "You can only view users from organizations where you are an admin",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "You can only view users from organizations where you are an admin",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get all organization members (users in this organization)
    const orgMembers = await OrganizationMember.find({
      organizationId: organizationId,
      status: "active", // Only get active members
    }).lean();

    // Extract user IDs from organization members
    const userIds = orgMembers.map((member: any) => member.userId?.toString());

    // Also include the organization admin if they exist and aren't already in the list
    // Convert orgAdminId to string for comparison
    const orgAdminIdStr = organization.orgAdminId?.toString();

    if (orgAdminIdStr && !userIds.includes(orgAdminIdStr)) {
      userIds.push(orgAdminIdStr);
    }

    // Get all users in this organization from the users collection
    const { usersCollection, mongoClient } = await getUsersCollection();

    // Convert userIds to ObjectIds (userId is stored as string in OrganizationMember)
    const userObjectIds = userIds
      .filter((id) => id && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (userObjectIds.length === 0) {
      await mongoClient.close();
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

    const users = await usersCollection
      .find({
        _id: { $in: userObjectIds },
      })
      .toArray();

    await mongoClient.close();

    // Create a map of userId -> organization role for quick lookup
    const memberRoleMap = new Map();
    const memberJoinedDateMap = new Map();
    orgMembers.forEach((member: any) => {
      const memberUserIdStr = member.userId?.toString();
      if (memberUserIdStr) {
        memberRoleMap.set(memberUserIdStr, member.role);
        memberJoinedDateMap.set(memberUserIdStr, member.createdAt);
      }
    });

    // Ensure org admin is marked as org_admin if they're the organization admin
    if (orgAdminIdStr) {
      memberRoleMap.set(orgAdminIdStr, "org_admin");
    }

    // Get all projects for this organization
    const orgProjects = await Project.find({
      organizationId: new ObjectId(organizationId),
      status: { $in: ["active", "archived"] },
    }).lean();

    const projectMap = new Map();
    orgProjects.forEach((project: any) => {
      projectMap.set(project._id.toString(), {
        id: project._id.toString(),
        name: project.name,
        projectAdminId: project.projectAdminId,
        status: project.status || "active",
      });
    });

    // Get all project memberships for users in this organization
    const projectMemberships = await ProjectMember.find({
      userId: { $in: userIds },
      organizationId: new ObjectId(organizationId),
      status: "active",
    }).lean();

    // Create a map of userId -> array of projects with roles
    const userProjectsMap = new Map<string, Array<{ id: string; name: string; role: string }>>();
    projectMemberships.forEach((membership: any) => {
      const userId = membership.userId?.toString();
      const projectId = membership.projectId?.toString();
      const project = projectMap.get(projectId);
      
      if (userId && project) {
        if (!userProjectsMap.has(userId)) {
          userProjectsMap.set(userId, []);
        }
        userProjectsMap.get(userId)!.push({
          id: project.id,
          name: project.name,
          role: membership.role,
          status: project.status || "active",
        });
      }
    });

    // Also check for project admin assignments (users who are projectAdminId on projects)
    orgProjects.forEach((project: any) => {
      const projectAdminId = project.projectAdminId?.toString();
      if (projectAdminId && userIds.includes(projectAdminId)) {
        const existingProjects = userProjectsMap.get(projectAdminId) || [];
        const projectExists = existingProjects.some(p => p.id === project._id.toString());
        
        if (!projectExists) {
          if (!userProjectsMap.has(projectAdminId)) {
            userProjectsMap.set(projectAdminId, []);
          }
          userProjectsMap.get(projectAdminId)!.push({
            id: project._id.toString(),
            name: project.name,
            role: "project_admin",
            status: project.status || "active",
          });
        } else {
          // Update role to project_admin if they are the projectAdminId
          const proj = existingProjects.find(p => p.id === project._id.toString());
          if (proj) {
            proj.role = "project_admin";
          }
        }
      }
    });

    // Get all user project wallets for calculating credits used
    const projectIds = orgProjects.map((p: any) => p._id);
    const userWallets = await UserProjectWallet.find({
      userId: { $in: userIds },
      projectId: { $in: projectIds },
    }).lean();

    // Create a map of userId -> total credits info
    const userCreditsMap = new Map<string, { creditsUsed: number; limit: number | null }>();
    userWallets.forEach((wallet: any) => {
      const userId = wallet.userId?.toString();
      if (userId) {
        if (!userCreditsMap.has(userId)) {
          userCreditsMap.set(userId, { creditsUsed: 0, limit: null });
        }
        const current = userCreditsMap.get(userId)!;
        current.creditsUsed += wallet.currentSpending || 0;
        // Sum up limits if set
        if (wallet.limit !== null) {
          current.limit = (current.limit || 0) + wallet.limit;
        }
      }
    });

    // Format response with all data
    const formattedUsers = users.map((u: any) => {
      const userId = u._id.toString();
      const orgRole = memberRoleMap.get(userId) || "org_user";
      const joinedAt = memberJoinedDateMap.get(userId) || u.createdAt;
      const userProjects = userProjectsMap.get(userId) || [];
      const credits = userCreditsMap.get(userId) || { creditsUsed: 0, limit: null };
      
      // Check if user is project_admin of at least one project
      const isProjectAdmin = userProjects.some(p => p.role === "project_admin");
      
      // Determine display role: org_admin > project_admin > user
      let displayRole = orgRole;
      if (orgRole !== "org_admin" && isProjectAdmin) {
        displayRole = "project_admin";
      } else if (orgRole !== "org_admin" && !isProjectAdmin) {
        displayRole = "org_user";
      }
      
      return {
        id: userId,
        email: u.email,
        name: u.name || "",
        role: displayRole,
        image: u.image || null,
        createdAt: u.createdAt,
        joinedAt: joinedAt,
        projects: userProjects,
        creditsUsed: credits.creditsUsed,
        creditsAvailable: credits.limit !== null ? Math.max(0, credits.limit - credits.creditsUsed) : null,
        creditsLimit: credits.limit,
      };
    });

    return new Response(
      JSON.stringify({
        users: formattedUsers,
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
    console.error("Error fetching organization users:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch organization users",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
