import mongoose from "mongoose";


const agentMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "assistant", "toolcall"],
    required: true,
  },
  content: {
    type: String,
    required: false,
  },
  toolCalls: {
    type: [Object],
    required: false,
  },
  toolResults: {
    type: [Object],
    required: false,
  },
  // Model and token fields - only present for assistant messages
  model: {
    type: String,
    required: false,
  },
  tokensUsed: {
    type: Number,
    required: false,
  },
  inputTokens: {
    type: Number,
    required: false,
  },
  outputTokens: {
    type: Number,
    required: false,
  },
  // Idempotency key to prevent duplicate messages
  clientRequestId: {
    type: String,
    required: false,
    index: true,
  },
  // R2 files stored for this message (similar to Messages model)
  r2Files: [
    {
      name: String,
      type: String,
      size: Number,
      url: String,
      uploadedAt: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
agentMessageSchema.index({ conversationId: 1, createdAt: 1 });

const AgentMessage = mongoose.models.AgentMessage || mongoose.model("AgentMessage", agentMessageSchema);
export default AgentMessage;