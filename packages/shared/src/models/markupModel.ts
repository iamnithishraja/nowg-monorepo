import mongoose from "mongoose";

// Schema definition for reuse
export const markupSchemaDefinition = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  provider: {
    type: String,
    enum: ["openrouter", "deployment", "managed_database"],
    required: true,
  },
  value: {
    type: Number,
    required: true,
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

export const markupSchema = new mongoose.Schema(markupSchemaDefinition);

// Model getter function for consistent access
export function getMarkupModel(): mongoose.Model<any> {
  if (mongoose.models.Markup) {
    return mongoose.models.Markup as mongoose.Model<any>;
  }
  return mongoose.model("Markup", markupSchema);
}

const Markup = getMarkupModel();

export default Markup;
