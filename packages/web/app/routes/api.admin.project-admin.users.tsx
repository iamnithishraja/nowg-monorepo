import type { LoaderFunctionArgs } from "react-router";
import { ObjectId } from "mongodb";
import { requireAdmin } from "~/lib/adminMiddleware";
import { getUsersCollection } from "~/lib/adminHelpers";
import { connectToDatabase } from "~/lib/mongo";
import ProjectMember from "~/models/projectMemberModel";
import Project from "~/models/projectModel";
import UserProjectWallet from "~/models/userProjectWalletModel";
import { getUserProjects } from "~/lib/projectRoles";
import { ProjectRole } from "~/lib/types/roles";
import { hasAdminAccess } from "~/lib/types/roles";
import { UserRole } from "~/lib/types/roles";
import Organization from "~/models/organizationModel";

// Handle OPTIONS preflight for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * GET /api/admin/project-admin/users
 * Get all users across all projects where the current user is project_admin
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const adminUser = await requireAdmin(request);

    if (!adminUser?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();

    // Check if user has project admin access
    const hasProjectAdminAccess = adminUser?.hasProjectAdminAccess || false;
    const isProjectAdminByRole =
      adminUser?.role === UserRole.PROJECT_ADMIN || hasProjectAdminAccess;

    if (!isProjectAdminByRole && !hasAdminAccess(adminUser.role)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "You must be a project admin to access this endpoint",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all projects where user is project_admin
    const userProjects = await getUserProjects(
      adminUser.id,
      ProjectRole.PROJECT_ADMIN
    );

    // Also get projects where user is projectAdminId (stored as string)
    const projectsAsAdmin = await Project.find({
      projectAdminId: adminUser.id,
      status: { $in: ["active", "archived"] },
    }).lean();

    // Combine project IDs from both sources
    const projectIdsFromMembers = userProjects.map((p) => p.projectId);
    const projectIdsFromAdmin = projectsAsAdmin.map((p: any) =>
      p._id.toString()
    );
    const allProjectIds = [
      ...new Set([...projectIdsFromMembers, ...projectIdsFromAdmin]),
    ];

    if (allProjectIds.length === 0) {
      // Get organization from user's organizationId if available
      let organization = null;
      if (adminUser.organizationId) {
        const org = await Organization.findById(adminUser.organizationId).lean();
        if (org) {
          organization = {
            id: org._id.toString(),
            name: org.name,
            logoUrl: (org as any).logoUrl || null,
          };
        }
      }

      return new Response(
        JSON.stringify({
          users: [],
          organization: organization,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all project members from these projects
    const projectObjectIds = allProjectIds.map((id) => new ObjectId(id));
    const projectMembers = await ProjectMember.find({
      projectId: { $in: projectObjectIds },
      status: "active",
    }).lean();

    // Get unique user IDs from project members
    const userIds = [
      ...new Set(
        projectMembers.map((member: any) => member.userId?.toString()).filter(Boolean)
      ),
    ];

    if (userIds.length === 0) {
      // Get organization from first project
      let organization = null;
      if (projectsAsAdmin.length > 0) {
        const orgId = projectsAsAdmin[0].organizationId;
        if (orgId) {
          const org = await Organization.findById(orgId).lean();
          if (org) {
            organization = {
              id: org._id.toString(),
              name: org.name,
              logoUrl: (org as any).logoUrl || null,
            };
          }
        }
      } else if (adminUser.organizationId) {
        const org = await Organization.findById(adminUser.organizationId).lean();
        if (org) {
          organization = {
            id: org._id.toString(),
            name: org.name,
            logoUrl: (org as any).logoUrl || null,
          };
        }
      }

      return new Response(
        JSON.stringify({
          users: [],
          organization: organization,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get user details
    const { usersCollection, mongoClient } = await getUsersCollection();
    const userObjectIds = userIds
      .filter((id) => id && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const users = await usersCollection
      .find({
        _id: { $in: userObjectIds },
      })
      .toArray();

    await mongoClient.close();

    // Get all projects for these project IDs
    const allProjects = await Project.find({
      _id: { $in: projectObjectIds },
      status: { $in: ["active", "archived"] },
    }).lean();

    const projectMap = new Map();
    allProjects.forEach((project: any) => {
      projectMap.set(project._id.toString(), {
        id: project._id.toString(),
        name: project.name,
        organizationId: project.organizationId?.toString(),
        projectAdminId: project.projectAdminId?.toString(),
        status: project.status || "active",
      });
    });

    // Get organization from first project (all projects should be in same org for a project admin)
    let organization = null;
    if (allProjects.length > 0) {
      const orgId = allProjects[0].organizationId;
      if (orgId) {
        const org = await Organization.findById(orgId).lean();
        if (org) {
          organization = {
            id: org._id.toString(),
            name: org.name,
            logoUrl: (org as any).logoUrl || null,
          };
        }
      }
    } else if (adminUser.organizationId) {
      const org = await Organization.findById(adminUser.organizationId).lean();
      if (org) {
        organization = {
          id: org._id.toString(),
          name: org.name,
          logoUrl: (org as any).logoUrl || null,
        };
      }
    }

    // Create a map of userId -> array of projects with roles
    const userProjectsMap = new Map<
      string,
      Array<{ id: string; name: string; role: string; status?: string }>
    >();

    projectMembers.forEach((membership: any) => {
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
    allProjects.forEach((project: any) => {
      const projectAdminId = project.projectAdminId?.toString();
      if (projectAdminId && userIds.includes(projectAdminId)) {
        const existingProjects = userProjectsMap.get(projectAdminId) || [];
        const projectExists = existingProjects.some(
          (p) => p.id === project._id.toString()
        );

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
          const proj = existingProjects.find(
            (p) => p.id === project._id.toString()
          );
          if (proj) {
            proj.role = "project_admin";
            // Also update status if not already set
            if (!proj.status) {
              proj.status = project.status || "active";
            }
          }
        }
      }
    });

    // Get all user project wallets for calculating credits used
    const userWallets = await UserProjectWallet.find({
      userId: { $in: userIds },
      projectId: { $in: projectObjectIds },
    }).lean();

    // Create a map of userId -> total credits info (only for projects where user is admin)
    const userCreditsMap = new Map<
      string,
      { creditsUsed: number; limit: number | null }
    >();
    userWallets.forEach((wallet: any) => {
      const userId = wallet.userId?.toString();
      const projectId = wallet.projectId?.toString();
      // Only count credits for projects where current user is admin
      if (userId && projectId && allProjectIds.includes(projectId)) {
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
      const userProjects = userProjectsMap.get(userId) || [];
      const credits = userCreditsMap.get(userId) || {
        creditsUsed: 0,
        limit: null,
      };

      // Check if user is project_admin of at least one project
      const isProjectAdmin = userProjects.some(
        (p) => p.role === "project_admin"
      );

      // Determine display role: project_admin > user
      let displayRole = "member";
      if (isProjectAdmin) {
        displayRole = "project_admin";
      }

      return {
        id: userId,
        email: u.email,
        name: u.name || "",
        role: displayRole,
        image: u.image || null,
        createdAt: u.createdAt,
        joinedAt: u.createdAt, // Use createdAt as joinedAt for project members
        projects: userProjects,
        creditsUsed: credits.creditsUsed,
        creditsAvailable:
          credits.limit !== null
            ? Math.max(0, credits.limit - credits.creditsUsed)
            : null,
        creditsLimit: credits.limit,
      };
    });

    return new Response(
      JSON.stringify({
        users: formattedUsers,
        organization: organization,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching project admin users:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch project admin users",
        message: error.message || "An error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

