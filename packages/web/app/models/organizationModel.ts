import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({
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
});

// Indexes for faster queries
organizationSchema.index({ orgAdminId: 1 });
organizationSchema.index({ name: 1 });
organizationSchema.index({ createdAt: -1 });

let Organization: mongoose.Model<any>;

if (mongoose.models.Organization) {
  Organization = mongoose.models.Organization as mongoose.Model<any>;
} else {
  Organization = mongoose.model("Organization", organizationSchema);
}

export default Organization;
