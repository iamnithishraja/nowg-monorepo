import mongoose, { Schema } from "mongoose";

export const teamSchemaDefinition = {
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
    default: 0,
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
      stripePaymentId: { type: String },
      conversationId: { type: String },
      projectId: { type: String },
      userId: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  // Team settings
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: false,
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
};

export const teamSchema = new Schema(teamSchemaDefinition);

// Indexes for faster queries
teamSchema.index({ adminId: 1 });
teamSchema.index({ createdAt: -1 });

function getTeamModel() {
  if (mongoose.models.Team) {
    return mongoose.models.Team as mongoose.Model<any>;
  }
  return mongoose.model("Team", teamSchema);
}

export default getTeamModel();
export { getTeamModel };
