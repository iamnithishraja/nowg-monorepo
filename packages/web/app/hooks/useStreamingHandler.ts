import { useRef } from "react";
import type { Tool } from "../tools/tool";

interface MCPToolEvent {
  name: string;
  args?: Record<string, any>;
  success?: boolean;
  content?: string;
}

interface FigmaScreenshotEvent {
  imageData: string;
  mimeType: string;
}

/**
 * Tool call event from the backend requesting frontend tool execution
 */
export interface ToolCallEvent {
  /** Unique ID for this tool call */
  id: string;
  /** Tool name to execute */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Session ID for context */
  sessionId?: string;
  /** Message ID for context */
  messageId?: string;
}

/**
 * Tool result to be sent back to the backend
 */
export interface ToolCallResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  /** Tool name that was executed */
  name: string;
  /** Whether execution was successful */
  success: boolean;
  /** Tool result or error message */
  result: Tool.Result | { error: string };
}

interface StreamingHandlerOptions {
  onConversationId: (id: string) => void;
  onFileAction: (action: any) => Promise<void>;
  onFileActionStart: (action: any) => Promise<void>;
  onShellAction: (action: any) => Promise<void>;
  onTextDelta: (delta: string) => void;
  onMessageComplete: (content: string) => void;
  onDone: () => void;
  onError: (error: string, errorType?: string) => void;
  // Optional hooks for database/supabase events
  onDbAction?: (action: { type: string; operation: string; sql: string }) => Promise<void> | void;
  onDbResult?: (data: any) => Promise<void> | void;
  onSupabaseInfo?: (data: { supabaseUrl?: string; ref?: string; projectId?: string }) => Promise<void> | void;
  // Optional hooks for Figma MCP events
  onMCPToolStart?: (tool: MCPToolEvent) => Promise<void> | void;
  onMCPToolResult?: (tool: MCPToolEvent) => Promise<void> | void;
  onFigmaScreenshot?: (data: FigmaScreenshotEvent) => Promise<void> | void;
  // Optional hooks for frontend tool execution
  onToolCall?: (toolCall: ToolCallEvent) => Promise<ToolCallResult>;
  onToolCallStart?: (toolCall: ToolCallEvent) => void;
  onToolCallComplete?: (result: ToolCallResult) => void;
  // Optional hooks for R2 sync events
  onSyncStarted?: () => void;
  onSyncCompleted?: () => void;
}

export function useStreamingHandler() {
  const handleStreamingResponse = async (
    response: Response,
    options: StreamingHandlerOptions,
    mountedRef: React.RefObject<boolean>
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream available");

    const decoder = new TextDecoder();
    let assistantContent = "";

    try {
      while (true) {
        // Check if component is still mounted
        if (!mountedRef.current) {
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              // Check if still mounted before processing
              if (!mountedRef.current) {
                return;
              }

              switch (data.type) {
        case "conversation_id":
          options.onConversationId(data.conversationId);
          break;

                case "text_delta":
                  if (options.onTextDelta) {
                    options.onTextDelta(data.delta);
                  }
                  break;

                case "file_action_start":
                  await options.onFileActionStart(data.action);
                  break;

                case "file_action":
                  await options.onFileAction(data.action);
                  break;

                case "shell_action":
                  await options.onShellAction(data.action);
                  break;

                case "db_action":
                  // Surface database SQL to the UI; execution happens on the server
                  if ((options as any).onDbAction) {
                    await (options as any).onDbAction(data.action);
                  }
                  break;

                case "db_result":
                  if ((options as any).onDbResult) {
                    await (options as any).onDbResult(data);
                  }
                  break;

                case "supabase_info":
                  if ((options as any).onSupabaseInfo) {
                    await (options as any).onSupabaseInfo(data);
                  }
                  break;

                case "mcp_tool_start":
                  // Figma MCP tool execution started
                  if (options.onMCPToolStart) {
                    await options.onMCPToolStart(data.tool);
                  }
                  break;

                case "mcp_tool_result":
                  // Figma MCP tool execution completed
                  if (options.onMCPToolResult) {
                    await options.onMCPToolResult(data.tool);
                  }
                  break;

                case "figma_screenshot":
                  // Figma screenshot captured
                  if (options.onFigmaScreenshot) {
                    await options.onFigmaScreenshot({
                      imageData: data.imageData,
                      mimeType: data.mimeType,
                    });
                  }
                  break;

                case "tool_call":
                  // Frontend tool execution requested by backend
                  if (options.onToolCall) {
                    const toolCall: ToolCallEvent = {
                      id: data.id,
                      name: data.name,
                      args: data.args || {},
                      sessionId: data.sessionId,
                      messageId: data.messageId,
                    };
                    
                    // Notify start
                    if (options.onToolCallStart) {
                      options.onToolCallStart(toolCall);
                    }
                    
                    // Execute the tool
                    const result = await options.onToolCall(toolCall);
                    
                    // Notify completion
                    if (options.onToolCallComplete) {
                      options.onToolCallComplete(result);
                    }
                  }
                  break;

                case "message_complete":
                  // Prefer raw content if provided (includes artifacts/actions)
                  assistantContent = data.raw || data.content || "";
                  options.onMessageComplete(assistantContent);
                  break;

                case "sync_started":
                  // R2 sync has started
                  if (options.onSyncStarted) {
                    options.onSyncStarted();
                  }
                  break;

                case "sync_completed":
                  // R2 sync has completed
                  if (options.onSyncCompleted) {
                    options.onSyncCompleted();
                  }
                  break;

                case "done":
                  if (mountedRef.current) {
                    options.onDone();
                  }
                  break;

                case "error":
                  console.error(`[StreamingHandler] Error:`, data.error);
                  options.onError(data.error, data.errorType);
                  break;
              }
            } catch (parseError) {
              // Only swallow JSON parse errors - re-throw everything else
              // (e.g. errors thrown by onError callback must propagate)
              if (!(parseError instanceof SyntaxError)) {
                throw parseError;
              }
            }
          }
        }
      }
    } catch (error) {
      // Re-throw all errors to be handled by parent error handlers
      // AbortErrors will be properly handled based on their reason
      throw error;
    } finally {
      // Ensure reader is properly closed
      try {
        reader.cancel();
      } catch (e) {
        // Reader might already be closed
      }
    }
  };

  return {
    handleStreamingResponse,
  };
}