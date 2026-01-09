import mongoose from "mongoose";
import { randomBytes } from "crypto";

const orgUserInvitationSchema = new mongoose.Schema({
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
    default: () => randomBytes(32).toString("hex"),
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
});

// Indexes
// Note: token already has unique: true which creates an index automatically
orgUserInvitationSchema.index({ organizationId: 1, email: 1 });
orgUserInvitationSchema.index({ status: 1, expiresAt: 1 });
orgUserInvitationSchema.index({ userId: 1 });

let OrgUserInvitation: mongoose.Model<any>;

if (mongoose.models.OrgUserInvitation) {
  OrgUserInvitation = mongoose.models.OrgUserInvitation as mongoose.Model<any>;
} else {
  OrgUserInvitation = mongoose.model(
    "OrgUserInvitation",
    orgUserInvitationSchema
  );
}

export default OrgUserInvitation;

