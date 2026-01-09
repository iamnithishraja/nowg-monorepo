/**
 * Centralized Role Definitions (Client-side)
 * This file contains all role-related enums, types, and utilities
 * used across the client application. Keep in sync with server/types/roles.ts
 */

// ============================================
// USER ROLES (System-level roles)
// ============================================

/**
 * System-level user roles that define global access permissions
 */
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  ORG_ADMIN = "org_admin",
  TECH_SUPPORT = "tech_support",
  PROJECT_ADMIN = "project_admin",
  ORG_USER = "org_user",
}

/**
 * Array of all valid user roles - useful for validation and dropdowns
 */
export const USER_ROLES = Object.values(UserRole);

/**
 * Type for user role strings
 */
export type UserRoleType = `${UserRole}`;

/**
 * Check if a string is a valid user role
 */
export function isValidUserRole(role: string): role is UserRoleType {
  return USER_ROLES.includes(role as UserRole);
}

/**
 * Default role for new users
 */
export const DEFAULT_USER_ROLE = UserRole.USER;

// ============================================
// TEAM ROLES (Team-level roles)
// ============================================

/**
 * Team member roles that define access within a specific team
 */
export enum TeamRole {
  ADMIN = "admin",
  DEVELOPER = "developer",
}

/**
 * Array of all valid team roles - useful for validation and dropdowns
 */
export const TEAM_ROLES = Object.values(TeamRole);

/**
 * Type for team role strings
 */
export type TeamRoleType = `${TeamRole}`;

/**
 * Check if a string is a valid team role
 */
export function isValidTeamRole(role: string): role is TeamRoleType {
  return TEAM_ROLES.includes(role as TeamRole);
}

/**
 * Default role for new team members
 */
export const DEFAULT_TEAM_ROLE = TeamRole.DEVELOPER;

// ============================================
// ROLE UTILITIES
// ============================================

/**
 * Check if user has admin-level access (admin or tech_support)
 */
export function hasAdminAccess(role: string | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.TECH_SUPPORT;
}

/**
 * Check if user has organization admin access
 */
export function hasOrgAdminAccess(role: string | undefined): boolean {
  return role === UserRole.ORG_ADMIN;
}

/**
 * Role display names for UI
 */
export const USER_ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.USER]: "User",
  [UserRole.ADMIN]: "Admin",
  [UserRole.ORG_ADMIN]: "Organization Admin",
  [UserRole.TECH_SUPPORT]: "Tech Support",
  [UserRole.PROJECT_ADMIN]: "Project Admin",
  [UserRole.ORG_USER]: "Organization User",
};

export const TEAM_ROLE_DISPLAY_NAMES: Record<TeamRole, string> = {
  [TeamRole.ADMIN]: "Admin",
  [TeamRole.DEVELOPER]: "Developer",
};

/**
 * Get badge variant for role display
 */
export function getRoleBadgeVariant(
  role: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (role) {
    case UserRole.ADMIN:
      return "default";
    case UserRole.TECH_SUPPORT:
      return "secondary";
    case UserRole.ORG_ADMIN:
      return "secondary";
    case UserRole.PROJECT_ADMIN:
      return "secondary";
    case UserRole.ORG_USER:
      return "outline";
    default:
      return "outline";
  }
}

