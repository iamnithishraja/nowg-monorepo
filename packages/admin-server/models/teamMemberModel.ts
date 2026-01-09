import mongoose from "mongoose";
import { TEAM_ROLES, DEFAULT_TEAM_ROLE } from "../types/roles";

const teamMemberSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true,
  },
  userId: {
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
  // Per-user wallet limits (optional, for controlling spending)
  walletLimit: {
    type: Number,
    default: null, // null means no limit
  },
  // Current spending for this user in this team
  currentSpending: {
    type: Number,
    default: 0,
  },
  // Projects this member has access to (array of conversation IDs)
  assignedProjects: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
  ],
  // Status
  status: {
    type: String,
    enum: ["active", "pending", "suspended"],
    default: "pending", // Starts as pending until accepted
  },
  // Invitation details
  invitedBy: {
    type: String,
    ref: "User",
  },
  invitedAt: {
    type: Date,
    default: Date.now,
  },
  joinedAt: {
    type: Date,
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

// Compound index to ensure one membership per user per team
teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });
teamMemberSchema.index({ userId: 1 });
teamMemberSchema.index({ teamId: 1, status: 1 });

const TeamMember = mongoose.model("TeamMember", teamMemberSchema);
export default TeamMember;
