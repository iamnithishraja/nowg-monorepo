/**
 * Re-export OrganizationMember model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
  OrganizationMember as default,
  getOrganizationMemberModel,
  organizationMemberSchema,
  organizationMemberSchemaDefinition
} from "@nowgai/shared/models";

