/**
 * Re-export all role-related types from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 * while the actual implementation is now in @nowgai/shared
 */
export {
  DEFAULT_ORGANIZATION_ROLE, DEFAULT_PROJECT_ROLE, DEFAULT_TEAM_ROLE, DEFAULT_USER_ROLE, getInvalidTeamRoleError,
  // Role utilities
  getInvalidUserRoleError,
  // UI utilities
  getRoleBadgeVariant, hasAdminAccess,
  hasOrgAdminAccess, isValidOrganizationRole, isValidProjectRole, isValidTeamRole, isValidUserRole, LEGACY_USER_ROLE_DISPLAY_NAMES, ORGANIZATION_ROLE_DISPLAY_NAMES, ORGANIZATION_ROLES,
  // Organization roles
  OrganizationRole, PROJECT_ROLE_DISPLAY_NAMES, PROJECT_ROLES,
  // Project roles
  ProjectRole, TEAM_ROLE_DISPLAY_NAMES, TEAM_ROLES,
  // Team roles
  TeamRole,
  // Role display names
  USER_ROLE_DISPLAY_NAMES, USER_ROLES,
  // User roles
  UserRole, type OrganizationRoleType, type ProjectRoleType, type TeamRoleType, type UserRoleType
} from "@nowgai/shared/types";

