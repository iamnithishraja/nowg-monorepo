import { OrganizationMember, Project } from "@nowgai/shared/models";
import { hasAdminAccess, ProjectRole, UserRole } from "@nowgai/shared/types";
import mongoose from "mongoose";
import type { Request } from "react-router";
import { auth } from "./auth";
import {
    getUserOrganizations,
    hasAnyOrganizationAdminRole,
} from "./organizationRoles";
import { getUserProjects, hasAnyProjectAdminRole } from "./projectRoles";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string;
  projectId?: string;
  hasOrgAdminAccess?: boolean;
  hasProjectAdminAccess?: boolean;
}

/**
 * Get session and attach user to request context
 * Does not require authentication - just checks if user is logged in
 * Also fetches organizationId for ORG_ADMIN users
 */
export async function getAdminSession(request: Request): Promise<{
  user: AdminUser | null;
  session: any | null;
}> {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user || !session?.session) {
      return { user: null, session: null };
    }

    const user: AdminUser = {
      ...session.user,
      role: session.user.role || UserRole.USER,
    } as AdminUser;

    let hasOrgAdmin = false;

    // Check if user has organization admin role in any organization
    try {
      hasOrgAdmin = await hasAnyOrganizationAdminRole(user.id);
      if (hasOrgAdmin) {
        user.hasOrgAdminAccess = true;
        user.role = UserRole.ORG_ADMIN;

        const userOrgs = await getUserOrganizations(user.id, "org_admin");
        if (userOrgs.length > 0) {
          user.organizationId = userOrgs[0].organizationId;
        }
      } else {
        const userOrgs = await getUserOrganizations(user.id);
        if (userOrgs.length > 0) {
          user.organizationId = userOrgs[0].organizationId;
          const orgMember = await OrganizationMember.findOne({
            userId: user.id,
            organizationId: new mongoose.Types.ObjectId(userOrgs[0].organizationId),
            status: "active",
          }).lean();
          if (orgMember?.role === "org_user") {
            user.role = UserRole.ORG_USER;
          }
        }
      }
    } catch (error) {
      console.error("Error checking organization role:", error);
    }

    // Check if user has project admin role in any project
    try {
      const hasProjectAdmin = await hasAnyProjectAdminRole(user.id);
      if (hasProjectAdmin) {
        user.hasProjectAdminAccess = true;
        if (!hasOrgAdmin && !hasAdminAccess(user.role)) {
          user.role = UserRole.PROJECT_ADMIN;
        }
        const userProjects = await getUserProjects(
          user.id,
          ProjectRole.PROJECT_ADMIN
        );
        if (userProjects.length > 0) {
          user.projectId = userProjects[0].projectId;
          if (!user.organizationId) {
            const project = await Project.findById(
              userProjects[0].projectId
            ).lean();
            if (project) {
              user.organizationId = project.organizationId.toString();
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking project admin role:", error);
    }

    return { user, session: session.session };
  } catch (error) {
    console.error("Error getting admin session:", error);
    return { user: null, session: null };
  }
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(request: Request): Promise<AdminUser> {
  const { user } = await getAdminSession(request);
  if (!user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized", message: "Please login to continue" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}

/**
 * Require admin, org_admin, or project_admin role
 * Returns 403 if user is not admin, tech_support, org_admin, or project_admin
 * Users who are only org_user (without project_admin) are forbidden
 */
export async function requireAdmin(request: Request): Promise<AdminUser> {
  const { user } = await getAdminSession(request);

  if (!user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized", message: "Please login to continue" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = user.id;
  const userRole = user.role;

  // Check 1: Is user a system admin (ADMIN or TECH_SUPPORT)?
  if (hasAdminAccess(userRole)) {
    return user;
  }

  try {
    // Check 2: Does user have org_admin role in any organization?
    const hasOrgAdmin = await hasAnyOrganizationAdminRole(userId);
    if (hasOrgAdmin) {
      return user;
    }

    // Check 3: Does user have project_admin role in any project?
    const hasProjectAdmin = await hasAnyProjectAdminRole(userId);
    if (hasProjectAdmin) {
      return user;
    }

    // Check 4: If user is only org_user (and no project_admin), deny access
    const orgMemberships = await OrganizationMember.find({
      userId: userId,
      status: "active",
    }).lean();

    if (orgMemberships.length > 0) {
      // Check if all memberships are org_user (not org_admin)
      const allOrgUser = orgMemberships.every(
        (m: any) => m.role === "org_user"
      );

      if (allOrgUser && !hasProjectAdmin) {
        // User is only org_user and has no project_admin - FORBIDDEN
        throw new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "Access denied. You must be an organization admin or project admin to access the admin panel.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // User has no access
    throw new Response(
      JSON.stringify({
        error: "Forbidden",
        message:
          "Access denied. You must be an admin, organization admin, or project admin to access this platform.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Error checking user access in requireAdmin:", error);
    throw new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: "Failed to verify access permissions",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Require full admin access (ADMIN or TECH_SUPPORT only)
 * ORG_ADMIN is not allowed
 */
export async function requireFullAdmin(request: Request): Promise<AdminUser> {
  const { user } = await getAdminSession(request);

  if (!user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized", message: "Please login to continue" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!hasAdminAccess(user.role)) {
    throw new Response(
      JSON.stringify({
        error: "Forbidden",
        message:
          "Full admin access required (ORG_ADMIN not allowed for this endpoint)",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return user;
}

