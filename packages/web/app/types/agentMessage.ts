/**
 * Agent Message Types - Aligned with OpenCode's message-v2.ts
 * 
 * This provides a parts-based message architecture similar to OpenCode,
 * enabling proper tool call/result handling without text hacks.
 */

// ============================================================================
// Part Base
// ============================================================================

export interface PartBase {
  id: string;
  sessionID: string;
  messageID: string;
}

// ============================================================================
// Text Part
// ============================================================================

export interface TextPart extends PartBase {
  type: "text";
  text: string;
  synthetic?: boolean; // System-generated text
  ignored?: boolean;
  time?: {
    start: number;
    end?: number;
  };
  metadata?: Record<string, any>;
}

// ============================================================================
// Reasoning Part (for models with thinking)
// ============================================================================

export interface ReasoningPart extends PartBase {
  type: "reasoning";
  text: string;
  metadata?: Record<string, any>;
  time: {
    start: number;
    end?: number;
  };
}

// ============================================================================
// Tool States - Matching OpenCode's state machine
// ============================================================================

export interface ToolStatePending {
  status: "pending";
  input: Record<string, any>;
  raw?: string;
}

export interface ToolStateRunning {
  status: "running";
  input: Record<string, any>;
  title?: string;
  metadata?: Record<string, any>;
  time: {
    start: number;
  };
}

export interface ToolStateCompleted {
  status: "completed";
  input: Record<string, any>;
  output: string;
  title: string;
  metadata: Record<string, any>;
  time: {
    start: number;
    end: number;
    compacted?: number; // When result was compacted/cleared
  };
}

export interface ToolStateError {
  status: "error";
  input: Record<string, any>;
  error: string;
  metadata?: Record<string, any>;
  time: {
    start: number;
    end: number;
  };
}

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;

// ============================================================================
// Tool Part
// ============================================================================

export interface ToolPart extends PartBase {
  type: "tool";
  callID: string;
  tool: string; // Tool name
  state: ToolState;
  category?: "auto" | "ack"; // Web-specific: auto-continue vs requires-ack
  metadata?: Record<string, any>;
}

// ============================================================================
// File Part
// ============================================================================

export interface FilePart extends PartBase {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
}

// ============================================================================
// Step Parts (for tracking LLM steps)
// ============================================================================

export interface StepStartPart extends PartBase {
  type: "step-start";
}

export interface StepFinishPart extends PartBase {
  type: "step-finish";
  reason: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
}

// ============================================================================
// Union of all Part types
// ============================================================================

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart
  | StepStartPart
  | StepFinishPart;

// ============================================================================
// Message Info (metadata about the message)
// ============================================================================

export interface UserMessageInfo {
  id: string;
  sessionID: string;
  role: "user";
  time: {
    created: number;
  };
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
}

export interface AssistantMessageInfo {
  id: string;
  sessionID: string;
  role: "assistant";
  time: {
    created: number;
    completed?: number;
  };
  parentID: string; // Links to the user message this responds to
  modelID: string;
  providerID: string;
  agent: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  finish?: string; // Finish reason: "stop", "tool-calls", etc.
  error?: {
    name: string;
    message: string;
    [key: string]: any;
  };
}

export type MessageInfo = UserMessageInfo | AssistantMessageInfo;

// ============================================================================
// Message with Parts (complete message structure)
// ============================================================================

export interface MessageWithParts {
  info: MessageInfo;
  parts: Part[];
}

// ============================================================================
// Helper type guards
// ============================================================================

export function isTextPart(part: Part): part is TextPart {
  return part.type === "text";
}

export function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

export function isReasoningPart(part: Part): part is ReasoningPart {
  return part.type === "reasoning";
}

export function isFilePart(part: Part): part is FilePart {
  return part.type === "file";
}

export function isToolCompleted(state: ToolState): state is ToolStateCompleted {
  return state.status === "completed";
}

export function isToolError(state: ToolState): state is ToolStateError {
  return state.status === "error";
}

export function isToolRunning(state: ToolState): state is ToolStateRunning {
  return state.status === "running";
}

export function isUserMessage(info: MessageInfo): info is UserMessageInfo {
  return info.role === "user";
}

export function isAssistantMessage(info: MessageInfo): info is AssistantMessageInfo {
  return info.role === "assistant";
}
