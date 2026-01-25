/**
 * Re-export ProjectWallet model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
    ProjectWallet as default,
    getProjectWalletModel,
    projectWalletSchema,
    projectWalletSchemaDefinition
} from "@nowgai/shared/models";

