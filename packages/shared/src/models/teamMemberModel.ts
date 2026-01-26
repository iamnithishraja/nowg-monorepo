import mongoose, { Schema } from "mongoose";
import { DEFAULT_TEAM_ROLE, TEAM_ROLES } from "../types/roles.js";

export const teamMemberSchemaDefinition = {
  teamId: {
    type: Schema.Types.ObjectId,
    ref: "Team",
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    ref: "User",
    index: true,
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
    default: null,
  },
  // Current spending for this user in this team
  currentSpending: {
    type: Number,
    default: 0,
  },
  // Projects this member has access to (array of conversation IDs)
  assignedProjects: [
    {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
    },
  ],
  status: {
    type: String,
    enum: ["active", "pending", "suspended"],
    default: "pending",
  },
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
};

export const teamMemberSchema = new Schema(teamMemberSchemaDefinition);

// Compound index to ensure unique team-user pairs
teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });

// Update the updatedAt field on save
teamMemberSchema.pre("save", function () {
  this.updatedAt = new Date();
});

function getTeamMemberModel(): mongoose.Model<any> {
  if (mongoose.models.TeamMember) {
    return mongoose.models.TeamMember as mongoose.Model<any>;
  }
  return mongoose.model("TeamMember", teamMemberSchema) as mongoose.Model<any>;
}

export default getTeamMemberModel();
export { getTeamMemberModel };
