/**
 * Re-export Team model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
    Team as default,
    getTeamModel,
    teamSchema,
    teamSchemaDefinition
} from "@nowgai/shared/models";

