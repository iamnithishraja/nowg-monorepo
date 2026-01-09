import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  // Project name
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Project description
  description: {
    type: String,
    trim: true,
    default: "",
  },
  // Reference to the organization this project belongs to
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  // Project admin (assigned user) - only one per project
  projectAdminId: {
    type: String,
    ref: "User",
    default: null, // Can be null initially, assigned later
  },
  // Invitation details for project admin
  invitationToken: {
    type: String,
    default: null,
    index: true,
  },
  invitationStatus: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: null,
  },
  invitedAt: {
    type: Date,
    default: null,
  },
  invitedBy: {
    type: String,
    ref: "User",
    default: null,
  },
  // Status
  status: {
    type: String,
    enum: ["active", "suspended", "archived"],
    default: "active",
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

// Indexes for faster queries
// Note: organizationId already has index: true in field definition
projectSchema.index({ projectAdminId: 1 });
projectSchema.index({ name: 1 });
projectSchema.index({ createdAt: -1 });
// Compound index to ensure unique project names per organization
projectSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Update the updatedAt field on save
projectSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let Project: mongoose.Model<any>;

if (mongoose.models.Project) {
  Project = mongoose.models.Project as mongoose.Model<any>;
} else {
  Project = mongoose.model("Project", projectSchema);
}

export default Project;
