import { useCallback } from "react";
import type { ToolCallEvent, ToolCallResult } from "../useStreamingHandler";

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

export interface StreamingHandlerOptions {
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
  // Optional hooks for frontend tool execution
  onToolCall?: (toolCall: ToolCallEvent) => Promise<ToolCallResult>;
  onToolCallStart?: (toolCall: ToolCallEvent) => void;
  onToolCallComplete?: (result: ToolCallResult) => void;
}

export function useStreamingWrapper(
  handleStreamingResponse: (
    response: Response,
    options: StreamingHandlerOptions,
    mountedRef: React.RefObject<boolean>
  ) => Promise<void>,
  getOptions: () => StreamingHandlerOptions,
  mountedRef: React.RefObject<boolean>
) {
  const stream = useCallback(
    async (response: Response) => {
      await handleStreamingResponse(response, getOptions(), mountedRef);
    },
    [handleStreamingResponse, getOptions, mountedRef]
  );

  return { stream };
}


