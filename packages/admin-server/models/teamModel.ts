import mongoose from "mongoose";

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  // Team admin (creator)
  adminId: {
    type: String,
    required: true,
    ref: "User",
  },
  // Team wallet balance
  balance: {
    type: Number,
    required: true,
    default: 0, // Current balance in USD
  },
  // Transaction history for team wallet
  transactions: [
    {
      type: {
        type: String,
        enum: [
          "recharge",
          "deduction",
          "refund",
          "transfer_to_project",
          "transfer_from_personal",
        ],
        required: true,
      },
      amount: { type: Number, required: true },
      balanceBefore: { type: Number, required: true },
      balanceAfter: { type: Number, required: true },
      description: { type: String },
      stripePaymentId: { type: String }, // For recharges
      conversationId: { type: String }, // For deductions/transfers
      projectId: { type: String }, // For project wallet transfers
      userId: { type: String }, // User who initiated the transaction
      createdAt: { type: Date, default: Date.now },
    },
  ],
  // Team settings
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: false, // Only admin can invite by default
    },
    defaultMemberRole: {
      type: String,
      enum: ["developer", "admin"],
      default: "developer",
    },
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

// Indexes for faster queries
teamSchema.index({ adminId: 1 });
teamSchema.index({ createdAt: -1 });

const Team = mongoose.model("Team", teamSchema);
export default Team;
