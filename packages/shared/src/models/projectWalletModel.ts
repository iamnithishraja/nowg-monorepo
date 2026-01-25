import mongoose, { Schema } from "mongoose";

export const projectWalletSchemaDefinition = {
  // Project (conversation) this wallet belongs to
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    unique: true,
  },
  // Team that owns this project (if team project)
  teamId: {
    type: Schema.Types.ObjectId,
    ref: "Team",
    default: null,
  },
  // User who owns this project (if personal project)
  userId: {
    type: String,
    default: null,
  },
  // Project wallet balance
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  // Transaction history for project wallet
  transactions: [
    {
      type: {
        type: String,
        enum: [
          "transfer_from_team",
          "transfer_from_personal",
          "deduction",
          "refund",
        ],
        required: true,
      },
      amount: { type: Number, required: true },
      balanceBefore: { type: Number, required: true },
      balanceAfter: { type: Number, required: true },
      description: { type: String },
      conversationId: { type: String },
      messageId: { type: String },
      model: { type: String },
      inputTokens: { type: Number },
      outputTokens: { type: Number },
      userId: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

export const projectWalletSchema = new Schema(projectWalletSchemaDefinition);

// Indexes
projectWalletSchema.index({ conversationId: 1 });
projectWalletSchema.index({ teamId: 1 });
projectWalletSchema.index({ userId: 1 });

function getProjectWalletModel() {
  if (mongoose.models.ProjectWallet) {
    return mongoose.models.ProjectWallet as mongoose.Model<any>;
  }
  return mongoose.model("ProjectWallet", projectWalletSchema);
}

export default getProjectWalletModel();
export { getProjectWalletModel };
