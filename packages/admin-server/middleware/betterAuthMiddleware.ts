import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { auth } from "../lib/auth";
import { UserRole, hasAdminAccess, ProjectRole } from "../types/roles";
import { getUsersCollection } from "../config/db";
import { hasAnyProjectAdminRole, getUserProjects } from "../lib/projectRoles";
import {
  hasAnyOrganizationAdminRole,
  getUserOrganizations,
} from "../lib/organizationRoles";
import OrganizationMember from "../models/organizationMemberModel";
import ProjectMember from "../models/projectMemberModel";
import Organization from "../models/organizationModel";
import Project from "../models/projectModel";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
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
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string;
        userAgent?: string;
      };
    }
  }
}

/**
 * Middleware to get current session and attach user to request
 * Does not require authentication - just checks if user is logged in
 * Also fetches organizationId for ORG_ADMIN users
 */
export async function getSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (session?.user && session?.session) {
      req.user = session.user as any;
      req.session = session.session as any;

      // Type guard: req.user is guaranteed to be defined here
      if (!req.user) {
        return next();
      }

      const user = req.user;
      let hasOrgAdmin = false;

      // Check if user has organization admin role in any organization
      // This allows users with org_admin role in OrganizationMember to access admin endpoints
      try {
        hasOrgAdmin = await hasAnyOrganizationAdminRole(user.id);
        if (hasOrgAdmin) {
          // Mark user as having org admin access
          (user as any).hasOrgAdminAccess = true;
          // Also set role to org_admin for backward compatibility with frontend checks
          user.role = UserRole.ORG_ADMIN;

          // Get user's organizations and set the first one as organizationId (for backward compatibility)
          const userOrgs = await getUserOrganizations(user.id, "org_admin");
          if (userOrgs.length > 0 && userOrgs[0]) {
            user.organizationId = userOrgs[0].organizationId;
          }
        } else {
          // Check if user is an org_user (member) in any organization
          const userOrgs = await getUserOrganizations(user.id);
          if (userOrgs.length > 0 && userOrgs[0]) {
            const firstOrg = userOrgs[0];
            // Set the first organization as organizationId
            user.organizationId = firstOrg.organizationId;
            // Check if user is org_user (not admin) and set role accordingly
            const orgMember = await OrganizationMember.findOne({
              userId: user.id,
              organizationId: new mongoose.Types.ObjectId(
                firstOrg.organizationId
              ),
              status: "active",
            }).lean();
            if (orgMember?.role === "org_user") {
              user.role = UserRole.ORG_USER;
            }
          }
        }
      } catch (error) {
        console.error("Error checking organization role:", error);
        // Continue without organization access
      }

      // Check if user has project admin role in any project
      // This allows users with project_admin role in ProjectMember to access admin endpoints
      try {
        const hasProjectAdmin = await hasAnyProjectAdminRole(user.id);
        if (hasProjectAdmin) {
          // Mark user as having project admin access
          (user as any).hasProjectAdminAccess = true;
          // Also set role to project_admin if not already org_admin or admin
          if (!hasOrgAdmin && !hasAdminAccess(user.role)) {
            user.role = UserRole.PROJECT_ADMIN;
          }
          // Get user's projects and set the first one as projectId (for backward compatibility)
          const userProjects = await getUserProjects(
            user.id,
            ProjectRole.PROJECT_ADMIN
          );
          if (userProjects.length > 0 && userProjects[0]) {
            const firstProject = userProjects[0];
            user.projectId = firstProject.projectId;
            // Also set organizationId from the project if not already set
            if (!user.organizationId) {
              const { default: Project } = await import(
                "../models/projectModel"
              );
              const project = await Project.findById(
                firstProject.projectId
              ).lean();
              if (project) {
                user.organizationId = project.organizationId.toString();
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking project admin role:", error);
        // Continue without project admin access
      }
    }

    next();
  } catch (error) {
    // Session check failed, but continue without user
    next();
  }
}

/**
 * Middleware to require authentication
 * Returns 401 if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.session) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "Please login to continue" });
  }
  next();
}

/**
 * Middleware to require admin, org_admin, or project_admin role
 * Returns 403 if user is not admin, tech_support, org_admin, or project_admin
 * This checks the database models directly (OrganizationMember, ProjectMember)
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !req.session) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "Please login to continue" });
  }

  const userId = req.user.id;
  const userRole = req.user.role;

  // Check 1: Is user a system admin (ADMIN or TECH_SUPPORT)?
  if (hasAdminAccess(userRole)) {
    return next();
  }

  // Check 2: Does user have ANY active organization membership with valid organization?
  try {
    const orgMemberships = await OrganizationMember.find({
      userId: userId,
      status: "active",
    }).lean();

    if (orgMemberships.length > 0) {
      // Verify that the organizations actually exist
      const orgIds = orgMemberships.map((m: any) => m.organizationId);
      const existingOrgs = await Organization.find({
        _id: { $in: orgIds },
        status: "active", // Also check that organization is active
      }).lean();

      if (existingOrgs.length > 0) {
        return next();
      }
    }

    // Check 3: Does user have ANY active project membership with valid project?
    const projectMemberships = await ProjectMember.find({
      userId: userId,
      status: "active",
    }).lean();

    if (projectMemberships.length > 0) {
      // Verify that the projects actually exist
      const projectIds = projectMemberships.map((m: any) => m.projectId);
      const existingProjects = await Project.find({
        _id: { $in: projectIds },
      }).lean();

      if (existingProjects.length > 0) {
        return next();
      }
    }

    // User has no access - no admin role, no org membership, no project membership
    return res.status(403).json({
      error: "Forbidden",
      message:
        "Access denied. You must be an admin or a member of an organization to access this platform.",
    });
  } catch (error) {
    console.error("Error checking user access in requireAdmin:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to verify access permissions",
    });
  }
}

/**
 * Middleware to require full admin access (ADMIN or TECH_SUPPORT only)
 * ORG_ADMIN is not allowed
 */
export function requireFullAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !req.session) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "Please login to continue" });
  }

  if (!hasAdminAccess(req.user.role)) {
    return res.status(403).json({
      error: "Forbidden",
      message:
        "Full admin access required (ORG_ADMIN not allowed for this endpoint)",
    });
  }

  next();
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.session) {
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Please login to continue" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
}

/**
 * Middleware to require organization admin access
 * Checks both role and hasOrgAdminAccess flag for robustness
 */
export function requireOrgAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !req.session) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "Please login to continue" });
  }

  const isOrgAdmin =
    req.user.role === UserRole.ORG_ADMIN ||
    (req.user as any).hasOrgAdminAccess === true;

  if (!isOrgAdmin) {
    return res.status(403).json({
      error: "Forbidden",
      message:
        "Markup Settings is only available for organization administrators",
    });
  }

  next();
}
