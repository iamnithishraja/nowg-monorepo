import mongoose from "mongoose";

// Transaction schema for user project wallet transactions
const userProjectWalletTransactionSchema = new mongoose.Schema({
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
  // Who performed the action (admin/project admin/org admin user id)
  performedBy: {
    type: String,
    ref: "User",
    required: true,
  },
  // Source of transfer (for tracking)
  source: {
    type: String,
    enum: ["project_wallet", "org_wallet", "direct", "usage_deduction"],
    default: "direct",
  },
  // Reference to the related project wallet transaction (for transfers)
  relatedProjectWalletTransactionId: {
    type: String,
    default: null,
  },
  // Reference to the related org wallet transaction (for transfers)
  relatedOrgWalletTransactionId: {
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
});

const userProjectWalletSchema = new mongoose.Schema({
  // Reference to the user
  userId: {
    type: String,
    ref: "User",
    required: true,
    index: true,
  },
  // Reference to the project
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  // Reference to the organization (for quick lookups)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  // Credit balance (1 credit = $1) - DEPRECATED: Users don't have balance, only limit
  // Keeping for backward compatibility, but should always be 0
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Spending limit for this user in this project (optional, null means no limit)
  limit: {
    type: Number,
    default: null,
    min: 0,
  },
  // Current spending for this user in this project (tracks usage against limit)
  currentSpending: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Transaction history
  transactions: {
    type: [userProjectWalletTransactionSchema],
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
});

// Compound index to ensure one wallet per user per project
userProjectWalletSchema.index({ userId: 1, projectId: 1 }, { unique: true });
// Note: Individual indexes for userId, projectId, and organizationId are already
// defined in the schema with "index: true", so we don't need to define them again here

// Update the updatedAt field on save
userProjectWalletSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let UserProjectWallet: mongoose.Model<any>;

if (mongoose.models.UserProjectWallet) {
  UserProjectWallet = mongoose.models.UserProjectWallet as mongoose.Model<any>;
} else {
  UserProjectWallet = mongoose.model(
    "UserProjectWallet",
    userProjectWalletSchema
  );
}

export default UserProjectWallet;
