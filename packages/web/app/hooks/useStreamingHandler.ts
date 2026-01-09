import { useRef } from "react";

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

interface StreamingHandlerOptions {
  onConversationId: (id: string) => void;
  onFileAction: (action: any) => Promise<void>;
  onFileActionStart: (action: any) => Promise<void>;
  onShellAction: (action: any) => Promise<void>;
  onTextDelta: (delta: string) => void;
  onMessageComplete: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  // Optional hooks for database/supabase events
  onDbAction?: (action: { type: string; operation: string; sql: string }) => Promise<void> | void;
  onDbResult?: (data: any) => Promise<void> | void;
  onSupabaseInfo?: (data: { supabaseUrl?: string; ref?: string; projectId?: string }) => Promise<void> | void;
  // Optional hooks for Figma MCP events
  onMCPToolStart?: (tool: MCPToolEvent) => Promise<void> | void;
  onMCPToolResult?: (tool: MCPToolEvent) => Promise<void> | void;
  onFigmaScreenshot?: (data: FigmaScreenshotEvent) => Promise<void> | void;
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
                  } else {

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

                case "message_complete":
                  // Prefer raw content if provided (includes artifacts/actions)
                  assistantContent = data.raw || data.content || "";
                  options.onMessageComplete(assistantContent);
                  break;

                case "done":
                  if (mountedRef.current) {
                    options.onDone();
                  }
                  break;

                case "error":
                  options.onError(data.error);
                  break;
              }
            } catch (parseError) {

            }
          }
        }
      }
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