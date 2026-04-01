import mongoose from "mongoose";

export const orgDocumentSubmissionSchemaDefinition = {
  organizationId: {
    type: String,
    ref: "Organization",
    required: true,
    index: true,
  },
  requirementId: {
    type: String, // String instead of ObjectId since we use String IDs in this schema style often
    ref: "OrgDocumentRequirement",
    required: true,
    index: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  adminNotes: {
    type: String,
    default: null,
  },
  reviewedBy: {
    type: String,
    ref: "User",
    default: null,
  },
  reviewedAt: {
    type: Date,
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

export const orgDocumentSubmissionSchema = new mongoose.Schema(orgDocumentSubmissionSchemaDefinition);

// Composite index to easily find a specific requirement submission for an organization
orgDocumentSubmissionSchema.index({ organizationId: 1, requirementId: 1 });
orgDocumentSubmissionSchema.index({ status: 1 });
orgDocumentSubmissionSchema.index({ createdAt: -1 });

export function getOrgDocumentSubmissionModel(): mongoose.Model<any> {
  if (mongoose.models.OrgDocumentSubmission) {
    return mongoose.models.OrgDocumentSubmission as mongoose.Model<any>;
  }
  return mongoose.model("OrgDocumentSubmission", orgDocumentSubmissionSchema);
}

const OrgDocumentSubmission = getOrgDocumentSubmissionModel();
export default OrgDocumentSubmission;
