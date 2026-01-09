/**
 * Centralized Role Definitions
 * This file contains all role-related enums, types, and utilities
 * used across the application. Any role changes should be made here.
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
 * Array of all valid user roles - useful for validation
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
 * Array of all valid team roles - useful for validation
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
// PROJECT ROLES (Project-level roles)
// ============================================

/**
 * Project member roles that define access within a specific project
 */
export enum ProjectRole {
  MEMBER = "member",
  DEVELOPER = "developer",
  CONTRIBUTOR = "contributor",
  PROJECT_ADMIN = "project_admin",
}

/**
 * Array of all valid project roles - useful for validation
 */
export const PROJECT_ROLES = Object.values(ProjectRole);

/**
 * Type for project role strings
 */
export type ProjectRoleType = `${ProjectRole}`;

/**
 * Check if a string is a valid project role
 */
export function isValidProjectRole(role: string): role is ProjectRoleType {
  return PROJECT_ROLES.includes(role as ProjectRole);
}

/**
 * Default role for new project members
 */
export const DEFAULT_PROJECT_ROLE = ProjectRole.MEMBER;

// ============================================
// ORGANIZATION ROLES (Organization-level roles)
// ============================================

/**
 * Organization member roles that define access within a specific organization
 */
export enum OrganizationRole {
  ORG_USER = "org_user",
  ORG_ADMIN = "org_admin",
}

/**
 * Array of all valid organization roles - useful for validation
 */
export const ORGANIZATION_ROLES = Object.values(OrganizationRole);

/**
 * Type for organization role strings
 */
export type OrganizationRoleType = `${OrganizationRole}`;

/**
 * Check if a string is a valid organization role
 */
export function isValidOrganizationRole(
  role: string
): role is OrganizationRoleType {
  return ORGANIZATION_ROLES.includes(role as OrganizationRole);
}

/**
 * Default role for new organization members
 */
export const DEFAULT_ORGANIZATION_ROLE = OrganizationRole.ORG_USER;

// ============================================
// ROLE UTILITIES
// ============================================

/**
 * Get error message for invalid user role
 */
export function getInvalidUserRoleError(): string {
  return `Invalid role. Must be one of: ${USER_ROLES.map((r) => `'${r}'`).join(
    ", "
  )}`;
}

/**
 * Get error message for invalid team role
 */
export function getInvalidTeamRoleError(): string {
  return `Invalid role. Must be one of: ${TEAM_ROLES.map((r) => `'${r}'`).join(
    ", "
  )}`;
}

/**
 * Check if user has admin-level access (admin or tech_support)
 */
export function hasAdminAccess(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.TECH_SUPPORT;
}

/**
 * Check if user has organization admin access
 */
export function hasOrgAdminAccess(role: string): boolean {
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

export const PROJECT_ROLE_DISPLAY_NAMES: Record<ProjectRole, string> = {
  [ProjectRole.MEMBER]: "Member",
  [ProjectRole.DEVELOPER]: "Developer",
  [ProjectRole.CONTRIBUTOR]: "Contributor",
  [ProjectRole.PROJECT_ADMIN]: "Project Admin",
};

export const ORGANIZATION_ROLE_DISPLAY_NAMES: Record<OrganizationRole, string> =
  {
    [OrganizationRole.ORG_USER]: "Organization User",
    [OrganizationRole.ORG_ADMIN]: "Organization Admin",
  };
