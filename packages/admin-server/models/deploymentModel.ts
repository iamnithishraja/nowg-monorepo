import mongoose from "mongoose";

const deploymentSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  userId: { type: String, required: true },
  platform: {
    type: String,
    enum: ["vercel", "netlify", "other"],
    required: true,
  },
  deploymentUrl: { type: String, required: true },
  deploymentId: { type: String, required: true },
  // NEW: Store Vercel project ID for reuse
  vercelProjectId: { type: String },
  // NEW: Store Netlify site ID for reuse
  netlifySiteId: { type: String },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  deployedAt: { type: Date, default: Date.now },
  // Store versionId if deployment is from a version snapshot
  versionId: { type: String },
  metadata: {
    buildLogs: String,
    environment: String,
    branch: String,
    commitHash: String,
  },
});

// Index for faster lookups
deploymentSchema.index({ conversationId: 1, platform: 1 });

const Deployment = mongoose.model("Deployment", deploymentSchema);
export default Deployment;
