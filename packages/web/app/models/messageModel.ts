import mongoose from "mongoose";

// Schema definition for reuse
export const messageSchemaDefinition = {
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
  // Tool calls made by assistant (for agent messages)
  toolCalls: [
    {
      id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      args: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      status: {
        type: String,
        enum: ["pending", "executing", "completed", "error"],
        default: "completed",
      },
      result: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined,
      },
      startTime: {
        type: Number,
        default: undefined,
      },
      endTime: {
        type: Number,
        default: undefined,
      },
      category: {
        type: String,
        enum: ["auto", "ack"],
        default: undefined,
      },
    },
  ],
  // File references stored in R2 (replaces files array)
  r2Files: [
    {
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
      url: {
        type: String,
        required: true, // R2 URL
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
};

export const messageSchema = new mongoose.Schema(messageSchemaDefinition);

// Ensure uniqueness of client request within a conversation if provided
try {
  messageSchema.index(
    { conversationId: 1, clientRequestId: 1 },
    { unique: true, sparse: true }
  );
} catch {}

// Model getter function for consistent access
export function getMessageModel(): mongoose.Model<any> {
  if (mongoose.models.Message) {
    return mongoose.models.Message as mongoose.Model<any>;
  }
  return mongoose.model("Message", messageSchema);
}

const Messages = getMessageModel();

export default Messages;
