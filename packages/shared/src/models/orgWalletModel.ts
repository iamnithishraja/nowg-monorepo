import mongoose, { Schema } from "mongoose";

// Transaction schema for wallet transactions
export const walletTransactionSchemaDefinition = {
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  balanceBefore: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  // Who performed the action (admin user id)
  performedBy: {
    type: String,
    ref: "User",
    required: true,
  },
  // Stripe payment ID for tracking Stripe payments
  stripePaymentId: {
    type: String,
    default: null,
  },
  // Flag to identify credit-back transactions
  isCreditBack: {
    type: Boolean,
    default: false,
  },
  // From address (wallet ID where the transaction originated from)
  fromAddress: {
    type: String,
    default: null,
  },
  // To address (wallet ID where the transaction is going to)
  toAddress: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
};

export const walletTransactionSchema = new Schema(walletTransactionSchemaDefinition);

// Wallet types enum
export type WalletType = "org_wallet" | "team_wallet";

export const orgWalletSchemaDefinition = {
  // Reference to the organization
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  // Wallet type - for now only org_wallet, but extensible
  type: {
    type: String,
    enum: ["org_wallet", "team_wallet"],
    default: "org_wallet",
  },
  // Credit balance (1 credit = $1)
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Transaction history
  transactions: {
    type: [walletTransactionSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

export const orgWalletSchema = new Schema(orgWalletSchemaDefinition);

// Compound index for quick lookups
orgWalletSchema.index({ organizationId: 1, type: 1 }, { unique: true });

// Update the updatedAt field on save
orgWalletSchema.pre("save", function () {
  this.updatedAt = new Date();
});

function getOrgWalletModel(): mongoose.Model<any> {
  if (mongoose.models.OrgWallet) {
    return mongoose.models.OrgWallet as mongoose.Model<any>;
  }
  return mongoose.model("OrgWallet", orgWalletSchema) as mongoose.Model<any>;
}

export default getOrgWalletModel();
export { getOrgWalletModel };
