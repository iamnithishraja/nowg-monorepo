import mongoose from "mongoose";

const organizationMemberSchema = new mongoose.Schema({
  // Reference to the organization
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
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
  // Role in the organization
  role: {
    type: String,
    enum: ["org_admin", "org_user"],
    required: true,
    default: "org_user",
  },
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
    default: null,
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

// Compound index to ensure unique user-organization pairs
organizationMemberSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true }
);

// Update the updatedAt field on save
organizationMemberSchema.pre("save", function () {
  this.updatedAt = new Date();
});

let OrganizationMember: mongoose.Model<any>;

if (mongoose.models.OrganizationMember) {
  OrganizationMember = mongoose.models
    .OrganizationMember as mongoose.Model<any>;
} else {
  OrganizationMember = mongoose.model(
    "OrganizationMember",
    organizationMemberSchema
  );
}

export default OrganizationMember;
