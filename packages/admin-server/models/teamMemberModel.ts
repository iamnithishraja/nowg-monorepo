/**
 * Re-export TeamMember model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export { TeamMember as default, getTeamMemberModel, teamMemberSchema, teamMemberSchemaDefinition } from "@nowgai/shared/models";
