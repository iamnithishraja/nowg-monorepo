import mongoose from "mongoose";

/**
 * Schema for individual hourly usage records
 */
const hourlyUsageRecordSchema = new mongoose.Schema({
  // UTC timestamp for this hour (start of hour)
  periodStart: {
    type: Date,
    required: true,
  },
  periodEnd: {
    type: Date,
    required: true,
  },
  // Raw metrics from Neon API
  computeTimeSeconds: {
    type: Number,
    required: true,
    default: 0,
  },
  logicalSizeBytesHour: {
    type: Number,
    required: true,
    default: 0,
  },
  // Calculated costs
  computeCost: {
    type: Number,
    required: true,
    default: 0,
  },
  storageCost: {
    type: Number,
    required: true,
    default: 0,
  },
  totalCost: {
    type: Number,
    required: true,
    default: 0,
  },
  // Whether this cost was billed (deducted from wallet)
  billed: {
    type: Boolean,
    default: false,
  },
  billedAt: {
    type: Date,
    default: null,
  },
  // Reference to wallet transaction if billed
  walletTransactionId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Schema for Neon usage billing per project/conversation
 */
const neonUsageBillingSchema = new mongoose.Schema({
  // Reference to the conversation (which has the Neon project)
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  },
  // Neon project ID for quick lookup
  neonProjectId: {
    type: String,
    required: true,
    index: true,
  },
  // Reference to admin project (if this conversation belongs to one)
  adminProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    default: null,
    index: true,
  },
  // Reference to organization (for org project wallets)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
    index: true,
  },
  // User who owns this (for personal projects)
  userId: {
    type: String,
    default: null,
    index: true,
  },
  // Team ID (for team projects)
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null,
    index: true,
  },
  // Last time we successfully fetched and processed billing
  lastBilledAt: {
    type: Date,
    default: null,
  },
  // Carry-forward cost that's below threshold
  carryForwardCost: {
    type: Number,
    default: 0,
  },
  // Total billed amount (lifetime)
  totalBilledAmount: {
    type: Number,
    default: 0,
  },
  // Total usage records count
  totalUsageRecords: {
    type: Number,
    default: 0,
  },
  // Hourly usage records
  usageRecords: {
    type: [hourlyUsageRecordSchema],
    default: [],
  },
  // Billing status
  status: {
    type: String,
    enum: ["active", "paused", "suspended", "error"],
    default: "active",
  },
  // Last error message if status is error
  lastError: {
    type: String,
    default: null,
  },
  lastErrorAt: {
    type: Date,
    default: null,
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

// Compound indexes for efficient queries
neonUsageBillingSchema.index(
  { conversationId: 1, neonProjectId: 1 },
  { unique: true }
);
neonUsageBillingSchema.index({ status: 1, lastBilledAt: 1 });
neonUsageBillingSchema.index({ adminProjectId: 1, status: 1 });
neonUsageBillingSchema.index({ organizationId: 1, status: 1 });

// Update the updatedAt field on save
neonUsageBillingSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let NeonUsageBilling: mongoose.Model<any>;

if (mongoose.models.NeonUsageBilling) {
  NeonUsageBilling = mongoose.models.NeonUsageBilling as mongoose.Model<any>;
} else {
  NeonUsageBilling = mongoose.model("NeonUsageBilling", neonUsageBillingSchema);
}

export default NeonUsageBilling;
