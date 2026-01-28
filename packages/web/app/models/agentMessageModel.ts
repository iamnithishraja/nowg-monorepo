import mongoose from "mongoose";

/**
 * Part Types - Similar to OpenCode's message parts system
 * Parts are stored in sequence to preserve the exact order of text, tool calls, and reasoning
 */

// Tool State Schemas - matching OpenCode's ToolState discriminated union
const ToolStatePendingSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending"], required: true },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  raw: { type: String, default: "" },
}, { _id: false });

const ToolStateRunningSchema = new mongoose.Schema({
  status: { type: String, enum: ["running"], required: true },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  title: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  time: {
    start: { type: Number, required: true },
  },
}, { _id: false });

const ToolStateCompletedSchema = new mongoose.Schema({
  status: { type: String, enum: ["completed"], required: true },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  output: { type: String, required: true },
  title: { type: String, default: "" },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  time: {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    compacted: { type: Number },
  },
  attachments: [{ type: mongoose.Schema.Types.Mixed }],
}, { _id: false });

const ToolStateErrorSchema = new mongoose.Schema({
  status: { type: String, enum: ["error"], required: true },
  input: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  time: {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
}, { _id: false });

// Part Schemas - matching OpenCode's Part discriminated union
const TextPartSchema = new mongoose.Schema({
  type: { type: String, enum: ["text"], required: true },
  id: { type: String, required: true },
  text: { type: String, required: true },
  synthetic: { type: Boolean },
  ignored: { type: Boolean },
  time: {
    start: { type: Number },
    end: { type: Number },
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const ReasoningPartSchema = new mongoose.Schema({
  type: { type: String, enum: ["reasoning"], required: true },
  id: { type: String, required: true },
  text: { type: String, required: true },
  time: {
    start: { type: Number, required: true },
    end: { type: Number },
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const ToolPartSchema = new mongoose.Schema({
  type: { type: String, enum: ["tool"], required: true },
  id: { type: String, required: true },
  callID: { type: String, required: true },
  tool: { type: String, required: true },
  state: { type: mongoose.Schema.Types.Mixed, required: true }, // ToolState union
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const StepStartPartSchema = new mongoose.Schema({
  type: { type: String, enum: ["step-start"], required: true },
  id: { type: String, required: true },
  snapshot: { type: String },
}, { _id: false });

const StepFinishPartSchema = new mongoose.Schema({
  type: { type: String, enum: ["step-finish"], required: true },
  id: { type: String, required: true },
  reason: { type: String, required: true },
  snapshot: { type: String },
  cost: { type: Number, default: 0 },
  tokens: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    reasoning: { type: Number, default: 0 },
    cache: {
      read: { type: Number, default: 0 },
      write: { type: Number, default: 0 },
    },
  },
}, { _id: false });

const FilePartSchema = new mongoose.Schema({
  type: { type: String, enum: ["file"], required: true },
  id: { type: String, required: true },
  mime: { type: String, required: true },
  filename: { type: String },
  url: { type: String, required: true },
  source: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

// Generic Part Schema that accepts any part type
const PartSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ["text", "reasoning", "tool", "step-start", "step-finish", "file", "patch", "snapshot", "agent", "retry", "compaction", "subtask"]
  },
  id: { type: String, required: true },
  // Text/Reasoning fields
  text: { type: String },
  synthetic: { type: Boolean },
  ignored: { type: Boolean },
  // Tool fields
  callID: { type: String },
  tool: { type: String },
  state: { type: mongoose.Schema.Types.Mixed },
  // Step fields
  reason: { type: String },
  snapshot: { type: String },
  cost: { type: Number },
  tokens: { type: mongoose.Schema.Types.Mixed },
  // File fields
  mime: { type: String },
  filename: { type: String },
  url: { type: String },
  source: { type: mongoose.Schema.Types.Mixed },
  // Common fields
  time: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

/**
 * Agent Message Schema - OpenCode-style message structure
 * 
 * Key differences from previous approach:
 * - Uses `parts` array to store interleaved content (text, tool calls, reasoning) in order
 * - Tool calls are stored as part of the parts array with full state tracking
 * - Supports reasoning parts for models with thinking/reasoning output
 * - Tracks step-start and step-finish for multi-step agent loops
 */
const agentMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  // Parts array stores interleaved text, tool calls, and reasoning in order
  // This is the primary way to store message content (OpenCode style)
  parts: {
    type: [PartSchema],
    default: [],
  },
  // Legacy content field - computed from text parts for backwards compatibility
  content: {
    type: String,
    required: false,
  },
  // Legacy segments field - kept for backwards compatibility during migration
  segments: {
    type: [Object],
    required: false,
  },
  // Legacy toolCalls field - kept for backwards compatibility during migration
  toolCalls: {
    type: [Object],
    required: false,
  },
  // Legacy toolResults field - kept for backwards compatibility during migration
  toolResults: {
    type: [Object],
    required: false,
  },
  
  // === User message fields ===
  // Agent and model info (for user messages, indicates what was requested)
  agent: {
    type: String,
    required: false,
  },
  model: {
    type: mongoose.Schema.Types.Mixed, // Can be string or { providerID, modelID }
    required: false,
  },
  // Custom system prompt override
  system: {
    type: String,
    required: false,
  },
  // Tool overrides
  tools: {
    type: mongoose.Schema.Types.Mixed, // Record<string, boolean>
    required: false,
  },
  // Variant (for A/B testing or different prompt strategies)
  variant: {
    type: String,
    required: false,
  },
  
  // === Assistant message fields ===
  // Parent message ID (for assistant messages, links to the user message that triggered this)
  parentID: {
    type: String,
    required: false,
  },
  // Model and provider that actually responded
  providerID: {
    type: String,
    required: false,
  },
  modelID: {
    type: String,
    required: false,
  },
  // Agent that handled this message
  agentMode: {
    type: String,
    required: false,
  },
  // Path context
  path: {
    cwd: { type: String },
    root: { type: String },
  },
  // Cost tracking
  cost: {
    type: Number,
    default: 0,
  },
  // Token tracking (aggregated from all steps)
  tokens: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    reasoning: { type: Number, default: 0 },
    cache: {
      read: { type: Number, default: 0 },
      write: { type: Number, default: 0 },
    },
  },
  // Legacy token fields for backwards compatibility
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
  // Finish reason (for assistant messages)
  finish: {
    type: String,
    required: false,
  },
  // Error info (if the message resulted in an error)
  error: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  // Summary flag (for compaction)
  summary: {
    type: Boolean,
    required: false,
  },
  
  // === Common fields ===
  // Idempotency key to prevent duplicate messages
  clientRequestId: {
    type: String,
    required: false,
    index: true,
  },
  // Timestamps
  time: {
    created: { type: Number, default: () => Date.now() },
    completed: { type: Number },
  },
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

// Virtual to get all text content from parts
agentMessageSchema.virtual("textContent").get(function() {
  if (!this.parts || this.parts.length === 0) {
    return this.content || "";
  }
  return this.parts
    .filter((p: any) => p.type === "text" && !p.synthetic && !p.ignored)
    .map((p: any) => p.text)
    .join("");
});

// Virtual to get all tool parts
agentMessageSchema.virtual("toolParts").get(function() {
  if (!this.parts) return [];
  return this.parts.filter((p: any) => p.type === "tool");
});

// Virtual to check if message has pending tools
agentMessageSchema.virtual("hasPendingTools").get(function() {
  if (!this.parts) return false;
  return this.parts.some((p: any) => 
    p.type === "tool" && 
    p.state && 
    (p.state.status === "pending" || p.state.status === "running")
  );
});

const AgentMessage = mongoose.models.AgentMessage || mongoose.model("AgentMessage", agentMessageSchema);
export default AgentMessage;

/**
 * TypeScript Types for Parts (matching OpenCode's types)
 */
export namespace AgentMessageTypes {
  export interface TextPart {
    type: "text";
    id: string;
    text: string;
    synthetic?: boolean;
    ignored?: boolean;
    time?: { start: number; end?: number };
    metadata?: Record<string, any>;
  }

  export interface ReasoningPart {
    type: "reasoning";
    id: string;
    text: string;
    time: { start: number; end?: number };
    metadata?: Record<string, any>;
  }

  export interface ToolStatePending {
    status: "pending";
    input: Record<string, any>;
    raw: string;
  }

  export interface ToolStateRunning {
    status: "running";
    input: Record<string, any>;
    title?: string;
    metadata?: Record<string, any>;
    time: { start: number };
  }

  export interface ToolStateCompleted {
    status: "completed";
    input: Record<string, any>;
    output: string;
    title: string;
    metadata: Record<string, any>;
    time: { start: number; end: number; compacted?: number };
    attachments?: FilePart[];
  }

  export interface ToolStateError {
    status: "error";
    input: Record<string, any>;
    error: string;
    metadata?: Record<string, any>;
    time: { start: number; end: number };
  }

  export type ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError;

  export interface ToolPart {
    type: "tool";
    id: string;
    callID: string;
    tool: string;
    state: ToolState;
    metadata?: Record<string, any>;
  }

  export interface StepStartPart {
    type: "step-start";
    id: string;
    snapshot?: string;
  }

  export interface StepFinishPart {
    type: "step-finish";
    id: string;
    reason: string;
    snapshot?: string;
    cost: number;
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
  }

  export interface FilePart {
    type: "file";
    id: string;
    mime: string;
    filename?: string;
    url: string;
    source?: {
      type: "file" | "symbol" | "resource";
      path?: string;
      text?: { value: string; start: number; end: number };
      // Additional fields for symbol/resource sources
    };
  }

  export type Part = TextPart | ReasoningPart | ToolPart | StepStartPart | StepFinishPart | FilePart;

  export interface UserMessage {
    role: "user";
    parts: Part[];
    agent: string;
    model: { providerID: string; modelID: string } | string;
    system?: string;
    tools?: Record<string, boolean>;
    variant?: string;
    time: { created: number };
  }

  export interface AssistantMessage {
    role: "assistant";
    parts: Part[];
    parentID: string;
    providerID: string;
    modelID: string;
    agentMode: string;
    path: { cwd: string; root: string };
    cost: number;
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
    finish?: string;
    error?: any;
    summary?: boolean;
    time: { created: number; completed?: number };
  }

  export type Message = UserMessage | AssistantMessage;

  export interface WithParts {
    info: Message;
    parts: Part[];
  }
}
