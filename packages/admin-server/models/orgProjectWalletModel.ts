import mongoose from "mongoose";

// Transaction schema for project wallet transactions
const projectWalletTransactionSchema = new mongoose.Schema({
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
  // Analytics fields for usage tracking
  model: {
    type: String,
    default: null,
  },
  inputTokens: {
    type: Number,
    default: null,
  },
  outputTokens: {
    type: Number,
    default: null,
  },
  conversationId: {
    type: String,
    default: null,
  },
  userId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const orgProjectWalletSchema = new mongoose.Schema({
  // Reference to the project
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    unique: true,
    index: true,
  },
  // Credit balance (1 credit = $1)
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Transaction history
  transactions: {
    type: [projectWalletTransactionSchema],
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

// Update the updatedAt field on save
orgProjectWalletSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let OrgProjectWallet: mongoose.Model<any>;

if (mongoose.models.OrgProjectWallet) {
  OrgProjectWallet = mongoose.models.OrgProjectWallet as mongoose.Model<any>;
} else {
  OrgProjectWallet = mongoose.model("OrgProjectWallet", orgProjectWalletSchema);
}

export default OrgProjectWallet;
