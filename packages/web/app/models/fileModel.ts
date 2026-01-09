import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
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
});

// Index for efficient lookups
fileSchema.index({ messageId: 1, conversationId: 1 });

const File = mongoose.model("File", fileSchema);
export default File;
