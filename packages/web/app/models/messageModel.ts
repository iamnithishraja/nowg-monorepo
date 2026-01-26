import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  // Optional idempotency key provided by client to avoid duplicates
  clientRequestId: { type: String, index: true },
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now },
  model: { type: String },
  tokensUsed: { type: Number },
  inputTokens: { type: Number },
  outputTokens: { type: Number },
  // Reference to File model
  files: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
    },
  ],
  // R2 files stored for this message (inline storage for R2 URLs)
  r2Files: [
    {
      name: { type: String },
      filePath: { type: String }, // Full file path for restoration
      contentType: { type: String }, // Renamed from 'type' to avoid Mongoose reserved keyword
      size: { type: Number },
      url: { type: String },
      uploadedAt: { type: Date },
    },
  ],
});

// Ensure uniqueness of client request within a conversation if provided
try {
  messageSchema.index(
    { conversationId: 1, clientRequestId: 1 },
    { unique: true, sparse: true }
  );
} catch {}

// Use existing model if already compiled (for hot reload), otherwise create new one
const Messages = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Messages;