/**
 * Re-export OrgWallet model from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
    OrgWallet as default,
    getOrgWalletModel,
    orgWalletSchema,
    orgWalletSchemaDefinition,
    walletTransactionSchema,
    walletTransactionSchemaDefinition
} from "@nowgai/shared/models";
export type { WalletType } from "@nowgai/shared/models";

