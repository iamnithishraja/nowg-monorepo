import mongoose, { Schema } from "mongoose";

export const projectMemberSchemaDefinition = {
  // Reference to the project
  projectId: {
    type: Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  // Reference to the user
  userId: {
    type: String,
    required: true,
    ref: "User",
    index: true,
  },
  // Reference to the organization (for quick lookups)
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  // Role in the project
  role: {
    type: String,
    enum: ["member", "developer", "contributor", "project_admin"],
    default: "member",
  },
  // Status
  status: {
    type: String,
    enum: ["active", "pending", "suspended"],
    default: "active",
  },
  // Who assigned this user to the project
  assignedBy: {
    type: String,
    ref: "User",
    default: null,
  },
  // When assigned
  assignedAt: {
    type: Date,
    default: Date.now,
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

export const projectMemberSchema = new Schema(projectMemberSchemaDefinition);

// Compound index to ensure one membership per user per project
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ projectId: 1, status: 1 });
projectMemberSchema.index({ organizationId: 1 });

// Update the updatedAt field on save
projectMemberSchema.pre("save", function () {
  this.updatedAt = new Date();
});

function getProjectMemberModel() {
  if (mongoose.models.ProjectMember) {
    return mongoose.models.ProjectMember as mongoose.Model<any>;
  }
  return mongoose.model("ProjectMember", projectMemberSchema);
}

export default getProjectMemberModel();
export { getProjectMemberModel };
