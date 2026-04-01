import mongoose from "mongoose";

export const orgDocumentRequirementSchemaDefinition = {
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
  isMandatory: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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

export const orgDocumentRequirementSchema = new mongoose.Schema(orgDocumentRequirementSchemaDefinition);

orgDocumentRequirementSchema.index({ isActive: 1 });
orgDocumentRequirementSchema.index({ createdAt: -1 });

export function getOrgDocumentRequirementModel(): mongoose.Model<any> {
  if (mongoose.models.OrgDocumentRequirement) {
    return mongoose.models.OrgDocumentRequirement as mongoose.Model<any>;
  }
  return mongoose.model("OrgDocumentRequirement", orgDocumentRequirementSchema);
}

const OrgDocumentRequirement = getOrgDocumentRequirementModel();
export default OrgDocumentRequirement;
