import mongoose from "mongoose";

// Generate a random hex token - works in both Node.js and browser environments
function generateRandomToken(): string {
  // Use crypto.randomUUID if available (Node 14.17+ and modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback for older environments
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Schema definition for reuse
export const orgUserInvitationSchemaDefinition = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  userId: {
    type: String,
    ref: "User",
    default: null,
  },
  invitedBy: {
    type: String,
    required: true,
    ref: "User",
  },
  // Invitation token for secure acceptance
  token: {
    type: String,
    required: false, // Not required to allow clearing after acceptance
    unique: true,
    sparse: true, // Allow multiple null values (unique only for non-null values)
    default: generateRandomToken,
  },
  // Status
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "expired"],
    default: "pending",
  },
  // Expiration (default 7 days)
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },
  acceptedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
};

export const orgUserInvitationSchema = new mongoose.Schema(orgUserInvitationSchemaDefinition);

// Indexes
// Note: token already has unique: true which creates an index automatically
orgUserInvitationSchema.index({ organizationId: 1, email: 1 });
orgUserInvitationSchema.index({ status: 1, expiresAt: 1 });
orgUserInvitationSchema.index({ userId: 1 });

// Model getter function for consistent access
export function getOrgUserInvitationModel(): mongoose.Model<any> {
  if (mongoose.models.OrgUserInvitation) {
    return mongoose.models.OrgUserInvitation as mongoose.Model<any>;
  }
  return mongoose.model("OrgUserInvitation", orgUserInvitationSchema);
}

const OrgUserInvitation = getOrgUserInvitationModel();

export default OrgUserInvitation;
