import mongoose from "mongoose";

// Schema definition for reuse
export const fundRequestSchemaDefinition = {
  // Reference to the project requesting funds
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  // Reference to the organization wallet
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  // Amount requested
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  // Optional description
  description: {
    type: String,
    default: "",
  },
  // Status: pending, approved, rejected
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true,
  },
  // Who created the request (project admin)
  requestedBy: {
    type: String,
    ref: "User",
    required: true,
  },
  // Who approved/rejected the request (org admin)
  reviewedBy: {
    type: String,
    ref: "User",
    default: null,
  },
  // Review comments (optional)
  reviewComments: {
    type: String,
    default: "",
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
};

export const fundRequestSchema = new mongoose.Schema(fundRequestSchemaDefinition);

// Update the updatedAt field on save
fundRequestSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// Compound index for quick lookups
fundRequestSchema.index({ projectId: 1, status: 1 });
fundRequestSchema.index({ organizationId: 1, status: 1 });

// Model getter function for consistent access
export function getFundRequestModel(): mongoose.Model<any> {
  if (mongoose.models.FundRequest) {
    return mongoose.models.FundRequest as mongoose.Model<any>;
  }
  return mongoose.model("FundRequest", fundRequestSchema);
}

const FundRequest = getFundRequestModel();

export default FundRequest;
