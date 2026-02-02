/**
 * Agent Message Converter - Aligned with OpenCode's message-v2.ts toModelMessage
 * 
 * This module converts our internal parts-based message format to AI SDK's
 * ModelMessage format for feeding to the LLM.
 */

import { convertToModelMessages, type UIMessage, type ModelMessage } from "ai";
import type {
  MessageWithParts,
  Part,
  TextPart,
  ToolPart,
  ReasoningPart,
  FilePart,
  ToolStateCompleted,
  ToolStateError,
} from "~/types/agentMessage";
import { generatePartId, generateMessageId } from "~/models/agentMessageModel";

/**
 * Convert internal MessageWithParts format to AI SDK ModelMessage format
 * This is the equivalent of OpenCode's MessageV2.toModelMessage
 */
export function toModelMessage(input: MessageWithParts[]): ModelMessage[] {
  const result: UIMessage[] = [];

  for (const msg of input) {
    if (msg.parts.length === 0) continue;

    if (msg.info.role === "user") {
      const userMessage: UIMessage = {
        id: msg.info.id,
        role: "user",
        parts: [],
      };
      result.push(userMessage);

      for (const part of msg.parts) {
        if (part.type === "text" && !part.ignored) {
          userMessage.parts.push({
            type: "text",
            text: part.text,
          });
        }

        // File parts (images, etc.) - exclude text/plain as they're converted to text
        if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory") {
          userMessage.parts.push({
            type: "file",
            url: part.url,
            mediaType: part.mime,
            filename: part.filename,
          });
        }
      }
    }

    if (msg.info.role === "assistant") {
      // Skip errored messages unless they have meaningful content
      if (msg.info.error && !msg.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")) {
        continue;
      }

      const assistantMessage: UIMessage = {
        id: msg.info.id,
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
          const toolPart = part as ToolPart;
          
          if (toolPart.state.status === "completed") {
            const state = toolPart.state as ToolStateCompleted;
            
            // Handle attachments if present (like OpenCode does)
            // Note: In web context we might handle this differently
            
            assistantMessage.parts.push({
              type: (`tool-${toolPart.tool}`) as `tool-${string}`,
              state: "output-available",
              toolCallId: toolPart.callID,
              input: state.input,
              // If compacted, show placeholder instead of full output
              output: state.time.compacted ? "[Old tool result content cleared]" : state.output,
              callProviderMetadata: toolPart.metadata,
            });
          } else if (toolPart.state.status === "error") {
            const state = toolPart.state as ToolStateError;
            assistantMessage.parts.push({
              type: (`tool-${toolPart.tool}`) as `tool-${string}`,
              state: "output-error",
              toolCallId: toolPart.callID,
              input: state.input,
              errorText: state.error,
              callProviderMetadata: toolPart.metadata,
            });
          } else if (toolPart.state.status === "pending" || toolPart.state.status === "running") {
            // IMPORTANT: Include pending/running tools so the AI knows it already called them
            // Without this, the AI will keep making the same tool calls repeatedly
            // Use "call" state for pending tools (they haven't returned results yet)
            assistantMessage.parts.push({
              type: (`tool-${toolPart.tool}`) as `tool-${string}`,
              state: "call", // Tool was called but hasn't returned yet
              toolCallId: toolPart.callID,
              input: toolPart.state.input,
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

  // Filter out messages that only have step-start parts (not meaningful for context)
  const filtered = result.filter((msg) => 
    msg.parts.some((part) => part.type !== "step-start")
  );

  // Use AI SDK's convertToModelMessages to get proper format
  return convertToModelMessages(filtered);
}

/**
 * Convert legacy message format (from existing code) to MessageWithParts format
 * This helps migrate from the old format during transition
 */
export function convertLegacyToPartsFormat(messages: any[]): MessageWithParts[] {
  const result: MessageWithParts[] = [];

  for (const msg of messages) {
    const sessionID = msg.sessionId || `session-${Date.now()}`;
    const messageID = msg.id || generateMessageId();

    if (msg.role === "user") {
      const parts: Part[] = [];
      
      // Convert content to text part
      if (typeof msg.content === "string" && msg.content) {
        parts.push({
          id: generatePartId(),
          sessionID,
          messageID,
          type: "text",
          text: msg.content,
        });
      }

      // Handle array content (multi-part messages)
      if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "text") {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "text",
              text: item.text,
            });
          }
          if (item.type === "file" || item.type === "image") {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "file",
              mime: item.mimeType || item.mediaType || "application/octet-stream",
              url: item.url || item.data,
              filename: item.filename,
            });
          }
        }
      }

      result.push({
        info: {
          id: messageID,
          sessionID,
          role: "user",
          time: { created: Date.now() },
          agent: msg.agent || "build",
          model: msg.model || { providerID: "openrouter", modelID: "anthropic/claude-4.5-sonnet" },
        },
        parts,
      });
    }

    if (msg.role === "assistant") {
      const parts: Part[] = [];
      
      // Convert text content
      if (typeof msg.content === "string" && msg.content) {
        parts.push({
          id: generatePartId(),
          sessionID,
          messageID,
          type: "text",
          text: msg.content,
        });
      }

      // Handle array content
      if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "text") {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "text",
              text: item.text,
            });
          }

          // Convert tool-call items to tool parts
          if (item.type === "tool-call") {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "tool",
              callID: item.toolCallId,
              tool: item.toolName,
              category: item.category,
              state: {
                status: "pending",
                input: item.args || {},
              },
            });
          }
        }
      }

      // Convert legacy toolCalls array
      if (Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          const toolCallId = tc.id || tc.toolCallId;
          const toolName = tc.name || tc.toolName;
          const args = tc.args || {};
          const status = tc.status || "pending";

          if (status === "completed" || tc.result) {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "tool",
              callID: toolCallId,
              tool: toolName,
              category: tc.category,
              state: {
                status: "completed",
                input: args,
                output: typeof tc.result === "string" ? tc.result : (tc.result?.output || JSON.stringify(tc.result)),
                title: tc.title || "",
                metadata: tc.metadata || {},
                time: {
                  start: tc.startTime || Date.now(),
                  end: tc.endTime || Date.now(),
                },
              },
            });
          } else if (status === "error") {
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "tool",
              callID: toolCallId,
              tool: toolName,
              category: tc.category,
              state: {
                status: "error",
                input: args,
                error: tc.error || tc.result?.error || "Unknown error",
                time: {
                  start: tc.startTime || Date.now(),
                  end: tc.endTime || Date.now(),
                },
              },
            });
          } else {
            // Pending or running
            parts.push({
              id: generatePartId(),
              sessionID,
              messageID,
              type: "tool",
              callID: toolCallId,
              tool: toolName,
              category: tc.category,
              state: {
                status: status === "executing" ? "running" : "pending",
                input: args,
                ...(status === "running" || status === "executing" 
                  ? { time: { start: tc.startTime || Date.now() } } 
                  : {}),
              },
            });
          }
        }
      }

      result.push({
        info: {
          id: messageID,
          sessionID,
          role: "assistant",
          time: { 
            created: Date.now(),
            completed: msg.finishReason ? Date.now() : undefined,
          },
          parentID: msg.parentID || "",
          modelID: typeof msg.model === "string" ? msg.model : (msg.model?.modelID || ""),
          providerID: typeof msg.model === "object" ? msg.model.providerID : "openrouter",
          agent: msg.agent || "build",
          cost: msg.cost || 0,
          tokens: {
            input: msg.inputTokens || 0,
            output: msg.outputTokens || 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          finish: msg.finishReason,
        },
        parts,
      });
    }

    // Handle tool result messages (convert to assistant message with completed tool)
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      // Tool results should be associated with the previous assistant message
      // but we'll create them as standalone for now
      const parts: Part[] = [];

      for (const item of msg.content) {
        if (item.type === "tool-result") {
          parts.push({
            id: generatePartId(),
            sessionID,
            messageID,
            type: "tool",
            callID: item.toolCallId,
            tool: item.toolName || "unknown",
            state: {
              status: item.isError ? "error" : "completed",
              input: {},
              ...(item.isError
                ? { error: typeof item.result === "string" ? item.result : JSON.stringify(item.result) }
                : { 
                    output: typeof item.result === "string" ? item.result : JSON.stringify(item.result),
                    title: "",
                    metadata: {},
                  }),
              time: {
                start: Date.now(),
                end: Date.now(),
              },
            },
          });
        }
      }

      // Don't add empty tool result messages
      if (parts.length > 0) {
        result.push({
          info: {
            id: messageID,
            sessionID,
            role: "assistant",
            time: { created: Date.now(), completed: Date.now() },
            parentID: "",
            modelID: "",
            providerID: "",
            agent: "build",
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            finish: "tool-calls",
          },
          parts,
        });
      }
    }
  }

  return result;
}

/**
 * Build messages array for LLM from parts-based messages
 * This is the main function to use when making API calls
 */
export function buildModelMessages(input: {
  history: MessageWithParts[];
  currentPrompt?: string;
  sessionID: string;
}): ModelMessage[] {
  const messages = [...input.history];

  // Add current prompt as a new user message if provided
  if (input.currentPrompt) {
    const userMessageId = generateMessageId();
    messages.push({
      info: {
        id: userMessageId,
        sessionID: input.sessionID,
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: { providerID: "openrouter", modelID: "anthropic/claude-4.5-sonnet" },
      },
      parts: [{
        id: generatePartId(),
        sessionID: input.sessionID,
        messageID: userMessageId,
        type: "text",
        text: input.currentPrompt,
      }],
    });
  }

  return toModelMessage(messages);
}

/**
 * Add tool results to message history
 * This updates tool parts with completed/error state based on results
 * 
 * IMPORTANT: This updates ALL matching tool calls across ALL assistant messages,
 * not just the last one. This ensures the AI sees all completed tool results.
 */
export function addToolResultsToHistory(input: {
  history: MessageWithParts[];
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    result: {
      success: boolean;
      output: string;
      error?: string;
    };
  }>;
  sessionID: string;
}): MessageWithParts[] {
  // Create a map of tool results for quick lookup
  const toolResultsMap = new Map(
    input.toolResults.map(tr => [tr.toolCallId, tr])
  );

  console.log("[AgentMessageConverter] addToolResultsToHistory called with:", {
    historyLength: input.history.length,
    toolResultsCount: input.toolResults.length,
    toolCallIds: input.toolResults.map(tr => tr.toolCallId),
  });

  // Update ALL assistant messages with matching tool results
  const result = input.history.map((msg) => {
    if (msg.info.role !== "assistant") return msg;
    
    let hasUpdates = false;
    const updatedParts = msg.parts.map((part) => {
      if (part.type !== "tool") return part;
      
      const toolPart = part as ToolPart;
      const toolResult = toolResultsMap.get(toolPart.callID);
      
      if (!toolResult) return part;

      hasUpdates = true;
      console.log("[AgentMessageConverter] Updating tool part:", {
        callID: toolPart.callID,
        tool: toolPart.tool,
        oldStatus: toolPart.state.status,
        newStatus: toolResult.result.success ? "completed" : "error",
      });

      // Update the tool part with the result
      if (toolResult.result.success) {
        return {
          ...toolPart,
          state: {
            status: "completed" as const,
            input: toolPart.state.input,
            output: toolResult.result.output,
            title: "",
            metadata: {},
            time: {
              start: (toolPart.state as any).time?.start || Date.now(),
              end: Date.now(),
            },
          },
        };
      } else {
        return {
          ...toolPart,
          state: {
            status: "error" as const,
            input: toolPart.state.input,
            error: toolResult.result.error || "Tool execution failed",
            time: {
              start: (toolPart.state as any).time?.start || Date.now(),
              end: Date.now(),
            },
          },
        };
      }
    });

    if (hasUpdates) {
      return {
        ...msg,
        parts: updatedParts,
      };
    }
    return msg;
  });

  return result;
}

/**
 * Create an assistant message with tool calls in parts format
 */
export function createAssistantMessageWithParts(input: {
  sessionID: string;
  parentID: string;
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, any>;
    category?: "auto" | "ack";
  }>;
  model: { providerID: string; modelID: string };
  tokens: { input: number; output: number };
  cost: number;
}): MessageWithParts {
  const messageID = generateMessageId();
  const parts: Part[] = [];

  // Add step-start part
  parts.push({
    id: generatePartId(),
    sessionID: input.sessionID,
    messageID,
    type: "step-start",
  });

  // Add text part if there's content
  if (input.text) {
    parts.push({
      id: generatePartId(),
      sessionID: input.sessionID,
      messageID,
      type: "text",
      text: input.text,
    });
  }

  // Add tool parts
  for (const tc of input.toolCalls) {
    parts.push({
      id: generatePartId(),
      sessionID: input.sessionID,
      messageID,
      type: "tool",
      callID: tc.id,
      tool: tc.name,
      category: tc.category,
      state: {
        status: "running",
        input: tc.args,
        time: {
          start: Date.now(),
        },
      },
    });
  }

  // Add step-finish part
  parts.push({
    id: generatePartId(),
    sessionID: input.sessionID,
    messageID,
    type: "step-finish",
    reason: input.toolCalls.length > 0 ? "tool-calls" : "stop",
    cost: input.cost,
    tokens: {
      input: input.tokens.input,
      output: input.tokens.output,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  });

  return {
    info: {
      id: messageID,
      sessionID: input.sessionID,
      role: "assistant",
      time: { created: Date.now() },
      parentID: input.parentID,
      modelID: input.model.modelID,
      providerID: input.model.providerID,
      agent: "build",
      cost: input.cost,
      tokens: {
        input: input.tokens.input,
        output: input.tokens.output,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      finish: input.toolCalls.length > 0 ? "tool-calls" : "stop",
    },
    parts,
  };
}
