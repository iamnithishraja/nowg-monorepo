/**
 * Re-export ProjectMember model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
    ProjectMember as default,
    getProjectMemberModel,
    projectMemberSchema,
    projectMemberSchemaDefinition
} from "@nowgai/shared/models";

