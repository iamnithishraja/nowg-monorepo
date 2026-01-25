import mongoose, { Schema } from "mongoose";

export const organizationMemberSchemaDefinition = {
  // Reference to the organization
  organizationId: {
    type: Schema.Types.ObjectId,
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
    default: "pending",
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
};

export const organizationMemberSchema = new Schema(organizationMemberSchemaDefinition);

// Compound index to ensure unique user-organization pairs
organizationMemberSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true }
);

// Update the updatedAt field on save
organizationMemberSchema.pre("save", function () {
  this.updatedAt = new Date();
});

function getOrganizationMemberModel(): mongoose.Model<any> {
  if (mongoose.models.OrganizationMember) {
    return mongoose.models.OrganizationMember as mongoose.Model<any>;
  }
  return mongoose.model("OrganizationMember", organizationMemberSchema) as mongoose.Model<any>;
}

export default getOrganizationMemberModel();
export { getOrganizationMemberModel };
