import mongoose from "mongoose";

const projectMemberSchema = new mongoose.Schema({
  // Reference to the project
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
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
    type: mongoose.Schema.Types.ObjectId,
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
});

// Compound index to ensure one membership per user per project
// Note: projectId and userId already have index: true in field definitions
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ projectId: 1, status: 1 });
projectMemberSchema.index({ organizationId: 1 });

// Update the updatedAt field on save
projectMemberSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let ProjectMember: mongoose.Model<any>;

if (mongoose.models.ProjectMember) {
  ProjectMember = mongoose.models.ProjectMember as mongoose.Model<any>;
} else {
  ProjectMember = mongoose.model("ProjectMember", projectMemberSchema);
}

export default ProjectMember;
