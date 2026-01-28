import mongoose from "mongoose";

// Template file schema definition
export const templateFileSchemaDefinition = {
  name: { type: String, required: true },
  path: { type: String, required: true },
  content: { type: String, required: true },
};

export const templateFileSchema = new mongoose.Schema(
  templateFileSchemaDefinition,
  { _id: false }
);

// Schema definition for reuse
export const versionSnapshotSchemaDefinition = {
  userId: {
    type: String,
    required: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  versionNumber: {
    type: Number,
    required: true,
  },
  files: [templateFileSchema],
  selectedPath: {
    type: String,
    default: undefined,
  },
  previewUrl: {
    type: String,
    default: null,
  },
  anchorMessageId: {
    type: String,
    default: undefined,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
};

export const versionSnapshotSchema = new mongoose.Schema(versionSnapshotSchemaDefinition);

versionSnapshotSchema.index(
  { conversationId: 1, versionNumber: 1 },
  { unique: true }
);

// Model getter function for consistent access
export function getVersionSnapshotModel(): mongoose.Model<any> {
  if (mongoose.models.VersionSnapshot) {
    return mongoose.models.VersionSnapshot as mongoose.Model<any>;
  }
  return mongoose.model("VersionSnapshot", versionSnapshotSchema);
}

const VersionSnapshot = getVersionSnapshotModel();

export default VersionSnapshot;
