import { Organization, OrganizationMember, Project, ProjectMember } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";

/**
 * Get current user with organization and project admin flags
 * GET /api/admin/me
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
      });
    }

    const user = req.user as any;

    // Return user with org admin and project admin flags
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
      projectId: user.projectId,
      hasOrgAdminAccess: user.hasOrgAdminAccess || false,
      hasProjectAdminAccess: user.hasProjectAdminAccess || false,
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      error: "Failed to get user",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * Check if user has access to the admin panel
 * Checks: admin role OR any active organization membership OR any active project membership
 * GET /api/admin/check-access
 */
export async function checkUserAccess(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Please login to continue",
        hasAccess: false,
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Check 1: Is user a system admin (ADMIN or TECH_SUPPORT)?
    if (hasAdminAccess(userRole)) {
      return res.json({
        hasAccess: true,
        reason: "system_admin",
        role: userRole,
      });
    }

    // Check 2: Does user have ANY active organization membership with valid organization?
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
        return res.json({
          hasAccess: true,
          reason: "organization_member",
          organizationCount: existingOrgs.length,
          roles: orgMemberships
            .filter((m: any) => existingOrgs.some((o: any) => o._id.toString() === m.organizationId.toString()))
            .map((m: any) => m.role),
        });
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
        return res.json({
          hasAccess: true,
          reason: "project_member",
          projectCount: existingProjects.length,
          roles: projectMemberships
            .filter((m: any) => existingProjects.some((p: any) => p._id.toString() === m.projectId.toString()))
            .map((m: any) => m.role),
        });
      }
    }

    // User has no access
    return res.json({
      hasAccess: false,
      reason: "no_membership",
      message: "Access denied. You must be an admin or a member of an organization to access this platform.",
    });
  } catch (error: any) {
    console.error("Check user access error:", error);
    return res.status(500).json({
      error: "Failed to check access",
      message: error.message || "An error occurred",
      hasAccess: false,
    });
  }
}
