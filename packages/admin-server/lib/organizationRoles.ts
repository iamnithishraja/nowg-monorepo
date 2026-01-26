import { OrganizationMember } from "@nowgai/shared/models";
import { OrganizationRole } from "@nowgai/shared/types";
import mongoose from "mongoose";

/**
 * Get user's role in a specific organization
 * @param userId - User ID (string)
 * @param organizationId - Organization ID (string)
 * @returns Promise<string | null> - Role name or null if not a member
 */
export async function getUserOrganizationRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  try {
    // Use mongoose's ObjectId to avoid BSON version mismatch
    const orgMember = await OrganizationMember.findOne({
      userId: userId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "active",
    }).lean();

    return orgMember?.role || null;
  } catch (error) {
    console.error("Error getting user organization role:", error);
    return null;
  }
}

/**
 * Check if user has organization admin role in a specific organization
 * @param userId - User ID (string)
 * @param organizationId - Organization ID (string)
 * @returns Promise<boolean>
 */
export async function isOrganizationAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const role = await getUserOrganizationRole(userId, organizationId);
  return role === OrganizationRole.ORG_ADMIN;
}

/**
 * Check if user has any role in a specific organization
 * @param userId - User ID (string)
 * @param organizationId - Organization ID (string)
 * @returns Promise<boolean>
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const role = await getUserOrganizationRole(userId, organizationId);
  return role !== null;
}

/**
 * Get all organizations where user has a specific role
 * @param userId - User ID (string)
 * @param role - Role to filter by (optional)
 * @returns Promise<Array<{organizationId: string, role: string}>>
 */
export async function getUserOrganizations(
  userId: string,
  role?: string
): Promise<Array<{ organizationId: string; role: string }>> {
  try {
    const query: any = {
      userId: userId,
      status: "active",
    };

    if (role) {
      query.role = role;
    }

    const members = await OrganizationMember.find(query).lean();

    return members.map((member: any) => ({
      organizationId: member.organizationId.toString(),
      role: member.role,
    }));
  } catch (error) {
    console.error("Error getting user organizations:", error);
    return [];
  }
}

/**
 * Check if user has organization admin role in any organization
 * @param userId - User ID (string)
 * @returns Promise<boolean>
 */
export async function hasAnyOrganizationAdminRole(
  userId: string
): Promise<boolean> {
  const orgs = await getUserOrganizations(userId, OrganizationRole.ORG_ADMIN);
  return orgs.length > 0;
}
