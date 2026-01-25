import mongoose, { Schema } from "mongoose";
import { DEFAULT_TEAM_ROLE, TEAM_ROLES } from "../types/roles.js";

export const teamInvitationSchemaDefinition = {
  teamId: {
    type: Schema.Types.ObjectId,
    ref: "Team",
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  invitedBy: {
    type: String,
    required: true,
    ref: "User",
  },
  role: {
    type: String,
    enum: TEAM_ROLES,
    required: true,
    default: DEFAULT_TEAM_ROLE,
  },
  // Invitation token for secure acceptance
  token: {
    type: String,
    required: true,
    unique: true,
  },
  // Status
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "expired"],
    default: "pending",
  },
  // Expiration (default 24 hours)
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
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

export const teamInvitationSchema = new Schema(teamInvitationSchemaDefinition);

// Indexes
teamInvitationSchema.index({ token: 1 });
teamInvitationSchema.index({ teamId: 1, email: 1 });
teamInvitationSchema.index({ status: 1, expiresAt: 1 });
teamInvitationSchema.index({ email: 1, status: 1 });

function getTeamInvitationModel() {
  if (mongoose.models.TeamInvitation) {
    return mongoose.models.TeamInvitation as mongoose.Model<any>;
  }
  return mongoose.model("TeamInvitation", teamInvitationSchema);
}

export default getTeamInvitationModel();
export { getTeamInvitationModel };
