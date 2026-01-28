import { ProjectMember } from "@nowgai/shared/models";
import { ProjectRole } from "@nowgai/shared/types";
import mongoose from "mongoose";

/**
 * Get user's role in a specific project
 * @param userId - User ID (string)
 * @param projectId - Project ID (string)
 * @returns Promise<string | null> - Role name or null if not a member
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<string | null> {
  try {
    // Use mongoose's ObjectId to avoid BSON version mismatch
    const projectMember = await ProjectMember.findOne({
      userId: userId,
      projectId: new mongoose.Types.ObjectId(projectId),
      status: "active",
    }).lean();

    return projectMember?.role || null;
  } catch (error) {
    console.error("Error getting user project role:", error);
    return null;
  }
}

/**
 * Check if user has project admin role in a specific project
 * @param userId - User ID (string)
 * @param projectId - Project ID (string)
 * @returns Promise<boolean>
 */
export async function isProjectAdmin(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === ProjectRole.PROJECT_ADMIN;
}

/**
 * Check if user has any role in a specific project
 * @param userId - User ID (string)
 * @param projectId - Project ID (string)
 * @returns Promise<boolean>
 */
export async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role !== null;
}

/**
 * Get all projects where user has a specific role
 * @param userId - User ID (string)
 * @param role - Role to filter by (optional)
 * @returns Promise<Array<{projectId: string, role: string}>>
 */
export async function getUserProjects(
  userId: string,
  role?: string
): Promise<Array<{ projectId: string; role: string }>> {
  try {
    const query: any = {
      userId: userId,
      status: "active",
    };

    if (role) {
      query.role = role;
    }

    const members = await ProjectMember.find(query).lean();

    return members.map((member: any) => ({
      projectId: member.projectId.toString(),
      role: member.role,
    }));
  } catch (error) {
    console.error("Error getting user projects:", error);
    return [];
  }
}

/**
 * Check if user has project admin role in any project
 * @param userId - User ID (string)
 * @returns Promise<boolean>
 */
export async function hasAnyProjectAdminRole(userId: string): Promise<boolean> {
  const projects = await getUserProjects(userId, ProjectRole.PROJECT_ADMIN);
  return projects.length > 0;
}
