import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true, // Index for faster queries
  },
  title: {
    type: String,
    required: true,
  },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentMessage",
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

// Update updatedAt before saving
chatSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);

export default Chat;

