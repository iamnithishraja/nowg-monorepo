import mongoose from "mongoose";

// Schema definition for reuse
export const organizationSchemaDefinition = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  // Organization logo URL (stored in R2)
  logoUrl: {
    type: String,
    default: null,
  },
  // Organization admin (assigned user)
  orgAdminId: {
    type: String,
    ref: "User",
    default: null, // Can be null initially, assigned later
  },
  // Invitation details
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
  // Allowed domains for this organization (e.g., ["abc.com", "xyz.com"])
  allowedDomains: {
    type: [String],
    default: [],
    validate: {
      validator: function (domains: string[]) {
        // Validate domain format (basic validation)
        return domains.every((domain) => {
          // Remove protocol if present
          const cleanDomain = domain
            .replace(/^https?:\/\//, "")
            .replace(/\/$/, "");
          // Basic domain validation
          return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
            cleanDomain
          );
        });
      },
      message: "Invalid domain format",
    },
  },
  // Status
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active",
  },
  // Plan type (core or enterprise)
  planType: {
    type: String,
    enum: ["core", "enterprise"],
    default: "core",
  },
  // Approval status for enterprise organizations
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected", null],
    default: null, // null for core plans, pending for enterprise requests
  },
  // Approval/rejection details
  approvalReviewedBy: {
    type: String,
    ref: "User",
    default: null,
  },
  approvalReviewedAt: {
    type: Date,
    default: null,
  },
  approvalNotes: {
    type: String,
    default: null,
  },
  // Additional enterprise fields
  companySize: {
    type: String,
    enum: ["1-10", "11-50", "51-200", "201-500", "500+", null],
    default: null,
  },
  industry: {
    type: String,
    default: null,
  },
  website: {
    type: String,
    default: null,
  },
  useCase: {
    type: String,
    default: null,
  },
  contactPhone: {
    type: String,
    default: null,
  },
  // Payment provider for this organization (optional)
  // If set, this provider will be used for all payments for this organization
  // If null, falls back to country-specific or default provider
  paymentProvider: {
    type: String,
    enum: ["stripe", "razorpay", "payu"],
    default: null,
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

export const organizationSchema = new mongoose.Schema(organizationSchemaDefinition);

// Indexes for faster queries
organizationSchema.index({ orgAdminId: 1 });
organizationSchema.index({ name: 1 });
organizationSchema.index({ createdAt: -1 });
organizationSchema.index({ approvalStatus: 1 });
organizationSchema.index({ planType: 1 });

// Model getter function for consistent access
export function getOrganizationModel(): mongoose.Model<any> {
  if (mongoose.models.Organization) {
    return mongoose.models.Organization as mongoose.Model<any>;
  }
  return mongoose.model("Organization", organizationSchema);
}

const Organization = getOrganizationModel();

export default Organization;
