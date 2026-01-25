import { TEAM_ROLES } from "@nowgai/shared/types";
import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  totalMessages: { type: Number, required: true, default: 0 },
  totalTokens: { type: Number, required: true, default: 0 },
  totalConversations: { type: Number, required: true, default: 0 },
  totalProjects: { type: Number, required: true, default: 0 },
  totalCost: { type: Number, required: true, default: 0 },

  // Payment & Balance
  balance: { type: Number, required: true, default: 0 }, // Current balance in USD
  isWhitelisted: { type: Boolean, default: false }, // Unlimited access for developers

  // Transaction history
  transactions: [
    {
      type: {
        type: String,
        enum: ["recharge", "deduction", "refund"],
        required: true,
      },
      amount: { type: Number, required: true },
      balanceBefore: { type: Number, required: true },
      balanceAfter: { type: Number, required: true },
      description: { type: String },
      stripePaymentId: { type: String }, // For Stripe recharges
      razorpayPaymentId: { type: String }, // For Razorpay recharges
      payuPaymentId: { type: String }, // For PayU recharges
      conversationId: { type: String }, // For deductions
      messageId: { type: String }, // For deductions
      model: { type: String }, // For deductions
      inputTokens: { type: Number }, // For deductions
      outputTokens: { type: Number }, // For deductions
      createdAt: { type: Date, default: Date.now },
    },
  ],

  // Time-based analytics for efficient queries
  dailyStats: [
    {
      date: { type: Date, required: true },
      messages: { type: Number, default: 0 },
      tokens: { type: Number, default: 0 },
      conversations: { type: Number, default: 0 },
      cost: { type: Number, default: 0 },
    },
  ],

  weeklyStats: [
    {
      week: { type: String, required: true }, // "2024-W01"
      messages: { type: Number, default: 0 },
      tokens: { type: Number, default: 0 },
      conversations: { type: Number, default: 0 },
      cost: { type: Number, default: 0 },
    },
  ],

  monthlyStats: [
    {
      month: { type: String, required: true }, // "2024-01"
      messages: { type: Number, default: 0 },
      tokens: { type: Number, default: 0 },
      conversations: { type: Number, default: 0 },
      cost: { type: Number, default: 0 },
    },
  ],

  // Model usage tracking
  modelUsage: [
    {
      model: { type: String, required: true },
      tokens: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      cost: { type: Number, default: 0 },
    },
  ],

  // Deployment stats
  deploymentStats: {
    total: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    inProgress: { type: Number, default: 0 },
  },

  // Team memberships
  teams: [
    {
      teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
      role: {
        type: String,
        enum: TEAM_ROLES,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  lastUpdated: { type: Date, default: Date.now },
});

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
