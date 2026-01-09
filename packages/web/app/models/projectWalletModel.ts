import mongoose from "mongoose";

const projectWalletSchema = new mongoose.Schema({
  // Project (conversation) this wallet belongs to
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    unique: true, // One wallet per project
  },
  // Team that owns this project (if team project)
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null, // null for personal projects
  },
  // User who owns this project (if personal project)
  userId: {
    type: String,
    default: null, // null for team projects
  },
  // Project wallet balance
  balance: {
    type: Number,
    required: true,
    default: 0, // Current balance in USD
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
      conversationId: { type: String }, // For deductions
      messageId: { type: String }, // For deductions
      model: { type: String }, // For deductions
      inputTokens: { type: Number }, // For deductions
      outputTokens: { type: Number }, // For deductions
      userId: { type: String }, // User who initiated the transaction
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
});

// Indexes
projectWalletSchema.index({ conversationId: 1 });
projectWalletSchema.index({ teamId: 1 });
projectWalletSchema.index({ userId: 1 });

const ProjectWallet = mongoose.model("ProjectWallet", projectWalletSchema);
export default ProjectWallet;
