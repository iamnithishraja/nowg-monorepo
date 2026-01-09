import mongoose from "mongoose";

const templateFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const versionSnapshotSchema = new mongoose.Schema({
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
});

versionSnapshotSchema.index(
  { conversationId: 1, versionNumber: 1 },
  { unique: true }
);

const VersionSnapshot =
  mongoose.models.VersionSnapshot ||
  mongoose.model("VersionSnapshot", versionSnapshotSchema);

export default VersionSnapshot;

