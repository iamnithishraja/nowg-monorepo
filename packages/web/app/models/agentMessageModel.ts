import mongoose from "mongoose";

/**
 * Agent Message Model - Aligned with OpenCode's message-v2.ts
 * 
 * Uses a parts-based architecture where messages contain an array of parts
 * (text, tool calls, reasoning, files, etc.) similar to OpenCode.
 */

// ============================================================================
// Tool State Schema (matches OpenCode's ToolState)
// ============================================================================

const toolStateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["pending", "running", "completed", "error"],
    required: true,
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  raw: String, // For pending state
  title: String,
  output: String,
  error: String,
  metadata: mongoose.Schema.Types.Mixed,
  time: {
    start: Number,
    end: Number,
    compacted: Number, // When result was cleared for context management
  },
}, { _id: false });

// ============================================================================
// Part Schemas (matches OpenCode's Part types)
// ============================================================================

const textPartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["text"], required: true },
  text: { type: String, required: true },
  synthetic: Boolean, // System-generated text
  ignored: Boolean,
  time: {
    start: Number,
    end: Number,
  },
  metadata: mongoose.Schema.Types.Mixed,
}, { _id: false });

const reasoningPartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["reasoning"], required: true },
  text: { type: String, required: true },
  metadata: mongoose.Schema.Types.Mixed,
  time: {
    start: { type: Number, required: true },
    end: Number,
  },
}, { _id: false });

const toolPartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["tool"], required: true },
  callID: { type: String, required: true },
  tool: { type: String, required: true }, // Tool name
  state: { type: toolStateSchema, required: true },
  category: { type: String, enum: ["auto", "ack"] }, // Web-specific
  metadata: mongoose.Schema.Types.Mixed,
}, { _id: false });

const filePartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["file"], required: true },
  mime: { type: String, required: true },
  filename: String,
  url: { type: String, required: true },
}, { _id: false });

const stepStartPartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["step-start"], required: true },
}, { _id: false });

const stepFinishPartSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["step-finish"], required: true },
  reason: String,
  cost: Number,
  tokens: {
    input: Number,
    output: Number,
    reasoning: Number,
    cache: {
      read: Number,
      write: Number,
    },
  },
}, { _id: false });

// ============================================================================
// Main Agent Message Schema
// ============================================================================

const agentMessageSchema = new mongoose.Schema({
  // Reference to conversation
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  
  // Session ID for grouping related messages
  sessionID: {
    type: String,
    required: true,
    index: true,
  },
  
  // Message role
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  
  // Message timing
  time: {
    created: { type: Number, required: true },
    completed: Number,
  },
  
  // Agent name used
  agent: {
    type: String,
    default: "build",
  },
  
  // Model info
  model: {
    providerID: String,
    modelID: String,
  },
  
  // For assistant messages: links to parent user message
  parentID: String,
  
  // Finish reason (for assistant messages)
  finish: String,
  
  // Token usage and cost
  cost: {
    type: Number,
    default: 0,
  },
  tokens: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    reasoning: { type: Number, default: 0 },
    cache: {
      read: { type: Number, default: 0 },
      write: { type: Number, default: 0 },
    },
  },
  
  // Error info (if message failed)
  error: {
    name: String,
    message: String,
    data: mongoose.Schema.Types.Mixed,
  },
  
  // ============================================================================
  // PARTS - The core of the message (OpenCode-aligned)
  // ============================================================================
  parts: [{
    type: mongoose.Schema.Types.Mixed,
    // Parts can be: text, reasoning, tool, file, step-start, step-finish
    // The 'type' field in each part determines its structure
  }],
  
  // ============================================================================
  // Legacy fields for backwards compatibility
  // ============================================================================
  
  // Direct content (deprecated - use parts instead)
  content: String,
  
  // Direct tool calls (deprecated - use parts with type="tool" instead)
  toolCalls: [mongoose.Schema.Types.Mixed],
  
  // Direct tool results (deprecated - stored in tool parts now)
  toolResults: [mongoose.Schema.Types.Mixed],
  
  // Legacy token fields
  tokensUsed: Number,
  inputTokens: Number,
  outputTokens: Number,
  
  // Idempotency key to prevent duplicate messages
  clientRequestId: {
    type: String,
    required: false,
    index: true,
  },
  
  // R2 files stored for this message
  r2Files: [
    {
      name: { type: String },
      filePath: { type: String },
      contentType: { type: String },
      size: { type: Number },
      url: { type: String },
      uploadedAt: { type: Date },
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

// Indexes for faster queries
agentMessageSchema.index({ conversationId: 1, createdAt: 1 });
agentMessageSchema.index({ sessionID: 1, createdAt: 1 });

const AgentMessage = mongoose.models.AgentMessage || mongoose.model("AgentMessage", agentMessageSchema);
export default AgentMessage;

// ============================================================================
// Helper functions for working with parts
// ============================================================================

/**
 * Generate a unique part ID
 */
export function generatePartId(): string {
  return `part-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a text part
 */
export function createTextPart(input: {
  messageID: string;
  sessionID: string;
  text: string;
  synthetic?: boolean;
}): object {
  return {
    id: generatePartId(),
    type: "text",
    text: input.text,
    synthetic: input.synthetic,
    time: {
      start: Date.now(),
    },
  };
}

/**
 * Create a tool part in pending state
 */
export function createToolPartPending(input: {
  messageID: string;
  sessionID: string;
  callID: string;
  tool: string;
  args: Record<string, any>;
  category?: "auto" | "ack";
}): object {
  return {
    id: generatePartId(),
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    category: input.category,
    state: {
      status: "pending",
      input: input.args,
    },
  };
}

/**
 * Create a tool part in running state
 */
export function createToolPartRunning(input: {
  messageID: string;
  sessionID: string;
  callID: string;
  tool: string;
  args: Record<string, any>;
  category?: "auto" | "ack";
}): object {
  return {
    id: generatePartId(),
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    category: input.category,
    state: {
      status: "running",
      input: input.args,
      time: {
        start: Date.now(),
      },
    },
  };
}

/**
 * Create a tool part in completed state
 */
export function createToolPartCompleted(input: {
  id?: string;
  callID: string;
  tool: string;
  args: Record<string, any>;
  output: string;
  title?: string;
  metadata?: Record<string, any>;
  category?: "auto" | "ack";
  startTime?: number;
}): object {
  return {
    id: input.id || generatePartId(),
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    category: input.category,
    state: {
      status: "completed",
      input: input.args,
      output: input.output,
      title: input.title || "",
      metadata: input.metadata || {},
      time: {
        start: input.startTime || Date.now(),
        end: Date.now(),
      },
    },
  };
}

/**
 * Create a tool part in error state
 */
export function createToolPartError(input: {
  id?: string;
  callID: string;
  tool: string;
  args: Record<string, any>;
  error: string;
  category?: "auto" | "ack";
  startTime?: number;
}): object {
  return {
    id: input.id || generatePartId(),
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    category: input.category,
    state: {
      status: "error",
      input: input.args,
      error: input.error,
      time: {
        start: input.startTime || Date.now(),
        end: Date.now(),
      },
    },
  };
}

/**
 * Create a step-start part
 */
export function createStepStartPart(): object {
  return {
    id: generatePartId(),
    type: "step-start",
  };
}

/**
 * Create a step-finish part
 */
export function createStepFinishPart(input: {
  reason: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
}): object {
  return {
    id: generatePartId(),
    type: "step-finish",
    reason: input.reason,
    cost: input.cost,
    tokens: {
      input: input.tokens.input,
      output: input.tokens.output,
      reasoning: input.tokens.reasoning || 0,
      cache: input.tokens.cache || { read: 0, write: 0 },
    },
  };
}
