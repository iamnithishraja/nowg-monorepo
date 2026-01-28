import type { CoreMessage, UIMessage } from "ai";
import { convertToModelMessages } from "ai";
import type { AgentMessageTypes } from "../models/agentMessageModel";

/**
 * Message Converter Utilities
 * 
 * Converts OpenCode-style parts-based messages to AI SDK compatible format
 * for feeding back into the LLM during agent loops.
 * 
 * Similar to OpenCode's MessageV2.toModelMessage function.
 */

export interface StoredMessage {
  _id?: string;
  id?: string;
  role: "user" | "assistant";
  parts: AgentMessageTypes.Part[];
  content?: string; // Legacy field
  segments?: any[]; // Legacy field
  toolCalls?: any[]; // Legacy field
  // Additional fields for context
  finish?: string;
  error?: any;
  summary?: boolean;
}

/**
 * Generate a unique ID for parts
 */
function generatePartId(): string {
  return `part-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert stored messages (with parts array) to AI SDK CoreMessage format
 * 
 * This function handles:
 * - Text parts → text content
 * - Tool parts → tool calls with results
 * - Reasoning parts → reasoning content (for supported providers)
 * - File attachments from tool results
 * 
 * @param messages Array of stored messages from database
 * @returns Array of CoreMessage compatible with AI SDK streamText
 */
export function toModelMessages(messages: StoredMessage[]): CoreMessage[] {
  const result: UIMessage[] = [];

  for (const msg of messages) {
    // Skip messages with no parts and no legacy content
    if ((!msg.parts || msg.parts.length === 0) && !msg.content && !msg.segments) {
      continue;
    }

    // Handle legacy format (segments/content) for backwards compatibility
    if ((!msg.parts || msg.parts.length === 0) && (msg.content || msg.segments)) {
      if (msg.role === "user") {
        result.push({
          id: msg._id?.toString() || msg.id || generatePartId(),
          role: "user",
          parts: [{ type: "text", text: msg.content || "" }],
        });
      } else if (msg.role === "assistant") {
        const assistantParts: UIMessage["parts"] = [];
        
        // Add text content
        if (msg.content) {
          assistantParts.push({ type: "text", text: msg.content });
        }
        
        // Add tool calls from legacy format
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            const toolName = tc.name || tc.toolName;
            const toolCallId = tc.id || tc.toolCallId;
            
            if (tc.status === "completed" && tc.result) {
              assistantParts.push({
                type: `tool-${toolName}` as `tool-${string}`,
                state: "output-available",
                toolCallId: toolCallId,
                input: tc.args || {},
                output: typeof tc.result === "string" 
                  ? tc.result 
                  : tc.result.output || JSON.stringify(tc.result),
              });
            } else if (tc.status === "error") {
              assistantParts.push({
                type: `tool-${toolName}` as `tool-${string}`,
                state: "output-error",
                toolCallId: toolCallId,
                input: tc.args || {},
                errorText: tc.result?.error || "Tool execution failed",
              });
            }
          }
        }
        
        if (assistantParts.length > 0) {
          result.push({
            id: msg._id?.toString() || msg.id || generatePartId(),
            role: "assistant",
            parts: assistantParts,
          });
        }
      }
      continue;
    }

    // Handle new parts-based format
    if (msg.role === "user") {
      const userMessage: UIMessage = {
        id: msg._id?.toString() || msg.id || generatePartId(),
        role: "user",
        parts: [],
      };

      for (const part of msg.parts) {
        if (part.type === "text" && !part.ignored) {
          userMessage.parts.push({
            type: "text",
            text: part.text,
          });
        }
        if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory") {
          userMessage.parts.push({
            type: "file",
            url: part.url,
            mediaType: part.mime,
            filename: part.filename,
          });
        }
      }

      if (userMessage.parts.length > 0) {
        result.push(userMessage);
      }
    }

    if (msg.role === "assistant") {
      // Skip error messages unless they have useful content
      if (msg.error && !msg.parts.some(p => p.type !== "step-start" && p.type !== "reasoning")) {
        continue;
      }

      const assistantMessage: UIMessage = {
        id: msg._id?.toString() || msg.id || generatePartId(),
        role: "assistant",
        parts: [],
      };

      for (const part of msg.parts) {
        if (part.type === "text") {
          assistantMessage.parts.push({
            type: "text",
            text: part.text,
            providerMetadata: part.metadata,
          });
        }

        if (part.type === "step-start") {
          assistantMessage.parts.push({
            type: "step-start",
          });
        }

        if (part.type === "tool") {
          const toolPart = part as AgentMessageTypes.ToolPart;
          
          if (toolPart.state.status === "completed") {
            // Handle file attachments from tool results
            if (toolPart.state.attachments?.length) {
              result.push({
                id: generatePartId(),
                role: "user",
                parts: [
                  {
                    type: "text",
                    text: `Tool ${toolPart.tool} returned an attachment:`,
                  },
                  ...toolPart.state.attachments.map((attachment) => ({
                    type: "file" as const,
                    url: attachment.url,
                    mediaType: attachment.mime,
                    filename: attachment.filename,
                  })),
                ],
              });
            }

            assistantMessage.parts.push({
              type: `tool-${toolPart.tool}` as `tool-${string}`,
              state: "output-available",
              toolCallId: toolPart.callID,
              input: toolPart.state.input,
              output: toolPart.state.time.compacted 
                ? "[Old tool result content cleared]" 
                : toolPart.state.output,
              callProviderMetadata: toolPart.metadata,
            });
          }

          if (toolPart.state.status === "error") {
            assistantMessage.parts.push({
              type: `tool-${toolPart.tool}` as `tool-${string}`,
              state: "output-error",
              toolCallId: toolPart.callID,
              input: toolPart.state.input,
              errorText: toolPart.state.error,
              callProviderMetadata: toolPart.metadata,
            });
          }
        }

        if (part.type === "reasoning") {
          assistantMessage.parts.push({
            type: "reasoning",
            text: part.text,
            providerMetadata: part.metadata,
          });
        }
      }

      if (assistantMessage.parts.length > 0) {
        result.push(assistantMessage);
      }
    }
  }

  // Convert UIMessage[] to CoreMessage[] using AI SDK's converter
  // Filter out messages that only have step-start parts
  return convertToModelMessages(
    result.filter((msg) => msg.parts.some((part) => part.type !== "step-start"))
  );
}

/**
 * Convert a single tool result to a format suitable for continuing the loop
 * 
 * @param toolCallId The tool call ID
 * @param toolName The tool name
 * @param result The tool execution result
 * @param success Whether the tool succeeded
 */
export function formatToolResult(
  toolCallId: string,
  toolName: string,
  result: string | { output?: string; error?: string },
  success: boolean
): string {
  const output = typeof result === "string" 
    ? result 
    : (success ? result.output || "" : `Error: ${result.error || "Tool execution failed"}`);
  
  return `=== Tool Result: ${toolName} (${toolCallId}) ===\n${output}`;
}

/**
 * Build tool results message content from multiple tool results
 * 
 * @param results Array of tool results
 */
export function buildToolResultsContent(
  results: Array<{
    toolCallId: string;
    toolName: string;
    result: { success: boolean; output: string; error?: string };
  }>
): string {
  const parts = results.map((tr) => 
    formatToolResult(
      tr.toolCallId, 
      tr.toolName, 
      tr.result.success ? tr.result.output : { error: tr.result.error },
      tr.result.success
    )
  );
  
  return `[Tool execution results]\n\n${parts.join("\n\n")}`;
}

/**
 * Create a text part
 */
export function createTextPart(
  text: string, 
  options: { synthetic?: boolean; ignored?: boolean } = {}
): AgentMessageTypes.TextPart {
  return {
    type: "text",
    id: generatePartId(),
    text,
    synthetic: options.synthetic,
    ignored: options.ignored,
    time: { start: Date.now() },
  };
}

/**
 * Create a tool part in pending state
 */
export function createToolPartPending(
  toolName: string,
  callID: string,
  input: Record<string, any> = {}
): AgentMessageTypes.ToolPart {
  return {
    type: "tool",
    id: generatePartId(),
    callID,
    tool: toolName,
    state: {
      status: "pending",
      input,
      raw: "",
    },
  };
}

/**
 * Create a tool part in running state
 */
export function createToolPartRunning(
  toolName: string,
  callID: string,
  input: Record<string, any>
): AgentMessageTypes.ToolPart {
  return {
    type: "tool",
    id: generatePartId(),
    callID,
    tool: toolName,
    state: {
      status: "running",
      input,
      time: { start: Date.now() },
    },
  };
}

/**
 * Update a tool part to completed state
 */
export function updateToolPartCompleted(
  existing: AgentMessageTypes.ToolPart,
  output: string,
  metadata: Record<string, any> = {},
  title: string = "",
  attachments?: AgentMessageTypes.FilePart[]
): AgentMessageTypes.ToolPart {
  const startTime = existing.state.status === "running" 
    ? existing.state.time.start 
    : Date.now();
  
  return {
    ...existing,
    state: {
      status: "completed",
      input: existing.state.input,
      output,
      title,
      metadata,
      time: { start: startTime, end: Date.now() },
      attachments,
    },
  };
}

/**
 * Update a tool part to error state
 */
export function updateToolPartError(
  existing: AgentMessageTypes.ToolPart,
  error: string
): AgentMessageTypes.ToolPart {
  const startTime = existing.state.status === "running" 
    ? existing.state.time.start 
    : Date.now();
  
  return {
    ...existing,
    state: {
      status: "error",
      input: existing.state.input,
      error,
      time: { start: startTime, end: Date.now() },
    },
  };
}

/**
 * Create a step-start part
 */
export function createStepStartPart(snapshot?: string): AgentMessageTypes.StepStartPart {
  return {
    type: "step-start",
    id: generatePartId(),
    snapshot,
  };
}

/**
 * Create a step-finish part
 */
export function createStepFinishPart(
  reason: string,
  tokens: { input: number; output: number; reasoning?: number; cache?: { read: number; write: number } },
  cost: number = 0,
  snapshot?: string
): AgentMessageTypes.StepFinishPart {
  return {
    type: "step-finish",
    id: generatePartId(),
    reason,
    snapshot,
    cost,
    tokens: {
      input: tokens.input,
      output: tokens.output,
      reasoning: tokens.reasoning || 0,
      cache: tokens.cache || { read: 0, write: 0 },
    },
  };
}

/**
 * Create a reasoning part
 */
export function createReasoningPart(text: string): AgentMessageTypes.ReasoningPart {
  return {
    type: "reasoning",
    id: generatePartId(),
    text,
    time: { start: Date.now() },
  };
}

/**
 * Extract text content from parts array
 */
export function extractTextFromParts(parts: AgentMessageTypes.Part[]): string {
  return parts
    .filter((p): p is AgentMessageTypes.TextPart => p.type === "text" && !p.synthetic && !p.ignored)
    .map((p) => p.text)
    .join("");
}

/**
 * Extract tool parts from parts array
 */
export function extractToolParts(parts: AgentMessageTypes.Part[]): AgentMessageTypes.ToolPart[] {
  return parts.filter((p): p is AgentMessageTypes.ToolPart => p.type === "tool");
}

/**
 * Check if there are any pending or running tools in parts
 */
export function hasPendingTools(parts: AgentMessageTypes.Part[]): boolean {
  return parts.some(
    (p) => p.type === "tool" && (p.state.status === "pending" || p.state.status === "running")
  );
}

/**
 * Get the finish reason from the last step-finish part
 */
export function getFinishReason(parts: AgentMessageTypes.Part[]): string | undefined {
  const stepFinishes = parts.filter((p): p is AgentMessageTypes.StepFinishPart => p.type === "step-finish");
  if (stepFinishes.length === 0) return undefined;
  return stepFinishes[stepFinishes.length - 1].reason;
}
