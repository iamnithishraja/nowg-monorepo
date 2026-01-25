import mongoose from "mongoose";

// Schema definition for reuse
export const fileSchemaDefinition = {
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    required: true,
    index: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  base64Data: {
    type: String,
    required: true, // Store base64 encoded image data
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
};

export const fileSchema = new mongoose.Schema(fileSchemaDefinition);

// Index for efficient lookups
fileSchema.index({ messageId: 1, conversationId: 1 });

// Model getter function for consistent access
export function getFileModel(): mongoose.Model<any> {
  if (mongoose.models.File) {
    return mongoose.models.File as mongoose.Model<any>;
  }
  return mongoose.model("File", fileSchema);
}

const File = getFileModel();

export default File;
