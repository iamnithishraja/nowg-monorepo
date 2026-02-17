import mongoose from "mongoose";

// Schema definition for reuse
export const deploymentSchemaDefinition = {
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
  // Store Vercel project ID for reuse
  vercelProjectId: { type: String },
  // Store Netlify site ID for reuse
  netlifySiteId: { type: String },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  deployedAt: { type: Date, default: Date.now },
  // Store versionId if deployment is from a version snapshot
  versionId: { type: String },
  // Track if this is the live deployment
  isLive: { type: Boolean, default: false },
  // Track if this deployment is archived
  isArchived: { type: Boolean, default: false },
  // Timestamp when deployment was archived
  archivedAt: { type: Date },
  // Snapshot data for restoration (stores deployment configuration)
  snapshotData: {
    files: [{ path: String, content: String }],
    projectName: String,
    framework: String,
    buildCommand: String,
    installCommand: String,
    outputDirectory: String,
  },
  metadata: {
    buildLogs: String,
    environment: String,
    branch: String,
    commitHash: String,
  },
};

export const deploymentSchema = new mongoose.Schema(deploymentSchemaDefinition);

// Index for faster lookups
deploymentSchema.index({ conversationId: 1, platform: 1 });
deploymentSchema.index({ conversationId: 1, isLive: 1 });
deploymentSchema.index({ conversationId: 1, isArchived: 1 });

// Model getter function for consistent access
export function getDeploymentModel(): mongoose.Model<any> {
  if (mongoose.models.Deployment) {
    return mongoose.models.Deployment as mongoose.Model<any>;
  }
  return mongoose.model("Deployment", deploymentSchema);
}

const Deployment = getDeploymentModel();

export default Deployment;
