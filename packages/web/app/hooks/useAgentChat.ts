import { useCallback, useRef, useState } from "react";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/tool";
import type { FileMap, FileNode } from "../utils/constants";
import type { CoreMessage } from "ai";

/**
 * Agent message in the conversation
 */
export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: AgentToolCall[];
  timestamp: number;
}

/**
 * Tool category for flow control
 */
export type ToolCategory = "auto" | "ack";

/**
 * Tool call from the agent
 */
export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "error";
  result?: Tool.Result | { error: string };
  startTime?: number;
  endTime?: number;
  /** Tool category: "auto" (auto-continue) or "ack" (requires acknowledgement) */
  category?: ToolCategory;
}

/**
 * Agent chat state
 */
export interface AgentChatState {
  messages: AgentMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  currentText: string;
  currentToolCalls: AgentToolCall[];
  error: string | null;
  sessionId: string | null;
  step: number;
  /** Whether we're waiting for user acknowledgement on action tools */
  awaitingAcknowledgement: boolean;
  /** Pending tool results that need acknowledgement before continuing */
  pendingAckResults: ToolResultPayload[];
  /** Messages to use when continuing after acknowledgement */
  continuationMessages: CoreMessage[];
}

/**
 * Options for the agent chat hook
 */
export interface UseAgentChatOptions {
  /** Model to use (defaults to claude-3.5-sonnet) */
  model?: string;
  /** Agent name (defaults to "build") */
  agent?: string;
  /** Files context for the agent */
  files?: FileMap;
  /** File tree structure */
  fileTree?: FileNode;
  /** Custom instructions */
  customInstructions?: string;
  /** Max steps for agentic loop */
  maxSteps?: number;
  /** Callback when text delta is received */
  onTextDelta?: (delta: string) => void;
  /** Callback when tool call is received */
  onToolCall?: (toolCall: AgentToolCall) => void;
  /** Callback when tool call completes */
  onToolCallComplete?: (toolCall: AgentToolCall) => void;
  /** Callback when step completes */
  onStepComplete?: (step: number) => void;
  /** Callback when response completes */
  onComplete?: (message: AgentMessage) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** 
   * Callback when action tools need acknowledgement before continuing.
   * Called with the completed action tool calls and the results that need to be acknowledged.
   */
  onAwaitingAcknowledgement?: (
    ackTools: AgentToolCall[],
    results: ToolResultPayload[],
    messages: CoreMessage[],
    step: number
  ) => void;
  /**
   * Callback when the chat title is updated (generated from first message)
   */
  onChatTitleUpdated?: (title: string) => void;
}

/**
 * Tool result to send back to server
 */
interface ToolResultPayload {
  toolCallId: string;
  toolName: string;
  result: {
    success: boolean;
    output: string;
    error?: string;
  };
}

/**
 * Hook for interacting with the Agent API
 * 
 * This hook provides a complete interface for:
 * - Sending prompts to the agent
 * - Streaming responses
 * - Executing tool calls via WebContainer
 * - Multi-turn conversations with tool results sent back to server
 * 
 * @example
 * ```tsx
 * const { sendMessage, messages, isStreaming, currentToolCalls } = useAgentChat({
 *   files: myFiles,
 *   onToolCall: (tc) => console.log('Tool called:', tc.name),
 * });
 * 
 * await sendMessage("Create a new React component");
 * ```
 */
export function useAgentChat(options: UseAgentChatOptions = {}) {
  const {
    model = "anthropic/claude-4.5-sonnet",
    agent = "build",
    files,
    fileTree,
    customInstructions,
    maxSteps = 50,
    onTextDelta,
    onToolCall,
    onToolCallComplete,
    onStepComplete,
    onComplete,
    onError,
    onAwaitingAcknowledgement,
    onChatTitleUpdated,
  } = options;

  const [state, setState] = useState<AgentChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    currentText: "",
    currentToolCalls: [],
    error: null,
    sessionId: null,
    step: 0,
    awaitingAcknowledgement: false,
    pendingAckResults: [],
    continuationMessages: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Execute a tool call locally via the ToolRegistry (WebContainer)
   */
  const executeToolCall = useCallback(
    async (toolCall: AgentToolCall): Promise<AgentToolCall> => {
      try {
        const tool = ToolRegistry.get(toolCall.name);
        if (!tool) {
          console.error("[useAgentChat] Tool not found in registry:", toolCall.name);
          return {
            ...toolCall,
            status: "error",
            result: { error: `Tool "${toolCall.name}" not found in registry` },
            endTime: Date.now(),
          };
        }

        const result = await tool.execute(toolCall.args, {
          sessionID: state.sessionId || "agent-session",
          messageID: `msg-${Date.now()}`,
          abort: abortControllerRef.current?.signal,
          metadata: () => {},
        });

        // Tool.Result has { title, output, metadata } - check if output exists
        const isSuccess = result && "output" in result && typeof result.output === "string";

        return {
          ...toolCall,
          status: isSuccess ? "completed" : "error",
          result,
          endTime: Date.now(),
        };
      } catch (error) {
        console.error("[useAgentChat] Tool execution error:", toolCall.name, error);
        return {
          ...toolCall,
          status: "error",
          result: { error: error instanceof Error ? error.message : String(error) },
          endTime: Date.now(),
        };
      }
    },
    [state.sessionId]
  );

  /**
   * Result from processing a stream
   */
  interface StreamResult {
    complete: boolean;
    text: string;
    toolCalls: AgentToolCall[];
    /** Whether there are action tools that need acknowledgement */
    hasAckTools: boolean;
    /** Whether there are auto-continue tools */
    hasAutoTools: boolean;
    /** Auto-continue tool calls (read-only) */
    autoToolCalls: AgentToolCall[];
    /** Action tool calls (require acknowledgement) */
    ackToolCalls: AgentToolCall[];
    /** Messages for continuation (legacy format) */
    messages: CoreMessage[];
    /** Messages for continuation (OpenCode-aligned parts-based format) */
    messagesWithParts?: any[];
  }

  /**
   * Process a single stream response from the server
   * Returns categorized tool calls for different handling
   */
  const processStream = useCallback(
    async (
      response: Response,
      abortSignal: AbortSignal
    ): Promise<StreamResult> => {
      const reader = response.body?.getReader();
      if (!reader) {
        console.error("[useAgentChat] No response stream available");
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let assistantText = "";
      let toolCalls: AgentToolCall[] = [];
      let sessionId = state.sessionId;
      let messagesForContinuation: CoreMessage[] = [];
      let messagesWithPartsForContinuation: any[] | undefined;
      let awaitingToolResults = false;
      let hasAckTools = false;
      let hasAutoTools = false;
      let eventCount = 0;

      while (true) {
        if (abortSignal.aborted) {
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            eventCount++;

            switch (data.type) {
              case "session_start":
                sessionId = data.sessionId;
                setState((prev) => ({ ...prev, sessionId, step: data.step || prev.step }));
                break;

              case "text_delta":
                assistantText += data.delta;
                setState((prev) => ({ ...prev, currentText: assistantText }));
                onTextDelta?.(data.delta);
                break;

              case "tool_call": {
                const tc: AgentToolCall = {
                  id: data.id,
                  name: data.name,
                  args: data.args,
                  status: "pending",
                  startTime: Date.now(),
                  category: data.category || "ack", // Default to requiring ack
                };
                toolCalls = [...toolCalls, tc];
                setState((prev) => ({
                  ...prev,
                  currentToolCalls: toolCalls,
                }));
                onToolCall?.(tc);
                break;
              }

              case "step_complete":
                setState((prev) => ({ ...prev, step: data.step }));
                onStepComplete?.(data.step);
                break;

              case "awaiting_tool_results":
                // Server wants us to execute tools and send results back
                
                // Update tool calls from the event if provided (they might have been sent here instead of as separate tool_call events)
                if (data.toolCalls && Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
                  const eventToolCalls: AgentToolCall[] = data.toolCalls.map((tc: any) => ({
                    id: tc.id,
                    name: tc.name,
                    args: tc.args || {},
                    status: "pending" as const,
                    startTime: Date.now(),
                    category: (tc.category || (data.ackTools?.some((at: any) => at.id === tc.id) ? "ack" : "auto")) as ToolCategory,
                  }));
                  
                  // Merge with existing tool calls (avoid duplicates)
                  const existingIds = new Set(toolCalls.map(tc => tc.id));
                  const newToolCalls = eventToolCalls.filter(tc => !existingIds.has(tc.id));
                  toolCalls = [...toolCalls, ...newToolCalls];
                  
                  setState((prev) => ({
                    ...prev,
                    currentToolCalls: toolCalls,
                  }));
                }
                
                // Capture both legacy and parts-based messages for continuation
                messagesForContinuation = data.messages || [];
                messagesWithPartsForContinuation = data.messagesWithParts;
                awaitingToolResults = true;
                hasAckTools = data.hasAckTools || false;
                hasAutoTools = data.hasAutoTools || false;
                break;

              case "complete": {
                // No more tool calls, we're done
                setState((prev) => ({
                  ...prev,
                  sessionId: data.sessionId || sessionId,
                  step: data.steps || prev.step,
                }));
                return { 
                  complete: true, 
                  text: assistantText, 
                  toolCalls,
                  hasAckTools: false,
                  hasAutoTools: false,
                  autoToolCalls: [],
                  ackToolCalls: [],
                  messages: messagesForContinuation,
                  messagesWithParts: messagesWithPartsForContinuation,
                };
              }

              case "error":
                console.error("[useAgentChat] Stream error:", data.error);
                throw new Error(data.error);

              case "done":
                break;

              case "chat_title_updated":
                // Chat title was generated from the first user message
                onChatTitleUpdated?.(data.chatTitle);
                break;

              case "user_message_saved":
                // User message was saved to database
                break;
            }
          } catch (parseError) {
            console.error("[useAgentChat] Parse error:", parseError);
            if (parseError instanceof Error && parseError.message) {
              throw parseError;
            }
          }
        }
      }

      // Categorize tool calls
      const autoToolCalls = toolCalls.filter(tc => tc.category === "auto");
      const ackToolCalls = toolCalls.filter(tc => tc.category === "ack");

      const isComplete = !awaitingToolResults || toolCalls.length === 0;

      return { 
        complete: isComplete, 
        text: assistantText, 
        toolCalls,
        hasAckTools,
        hasAutoTools,
        autoToolCalls,
        ackToolCalls,
        messages: messagesForContinuation,
        messagesWithParts: messagesWithPartsForContinuation,
      };
    },
    [state.sessionId, onTextDelta, onToolCall, onStepComplete, onChatTitleUpdated]
  );

  /**
   * Execute tools and build results
   */
  const executeAndBuildResults = useCallback(
    async (toolCalls: AgentToolCall[]): Promise<{ 
      executedTools: AgentToolCall[]; 
      results: ToolResultPayload[] 
    }> => {
      const executedTools: AgentToolCall[] = [];
      const results: ToolResultPayload[] = [];

      for (const tc of toolCalls) {
        // Update status to executing
        setState((prev) => ({
          ...prev,
          currentToolCalls: prev.currentToolCalls.map((t) =>
            t.id === tc.id ? { ...t, status: "executing" as const } : t
          ),
        }));

        // Execute the tool
        const result = await executeToolCall(tc);
        executedTools.push(result);

        setState((prev) => ({
          ...prev,
          currentToolCalls: prev.currentToolCalls.map((t) =>
            t.id === tc.id ? result : t
          ),
        }));

        onToolCallComplete?.(result);

        // Build tool result for server
        results.push({
          toolCallId: tc.id,
          toolName: tc.name,
          result: {
            success: result.status === "completed",
            output: result.result && "output" in result.result
              ? result.result.output
              : JSON.stringify(result.result),
            error: result.result && "error" in result.result
              ? result.result.error
              : undefined,
          },
        });
      }

      return { executedTools, results };
    },
    [executeToolCall, onToolCallComplete]
  );

  /**
   * Continue the agent loop after acknowledgement
   * Call this after action tools are acknowledged by the user
   * @param results Optional tool results to use instead of state.pendingAckResults
   */
  const acknowledge = useCallback(
async (
results?: ToolResultPayload[],
      messages?: CoreMessage[],
      step?: number
) => {
    const pendingResults = results || state.pendingAckResults;
    const isAwaiting = results ? true : state.awaitingAcknowledgement;
    
    if (!isAwaiting || pendingResults.length === 0) {
      return;
    }

    const abortSignal = abortControllerRef.current?.signal;
    if (!abortSignal || abortSignal.aborted) {
      return;
    }
    // Clear awaiting state
    setState((prev) => ({
      ...prev,
      awaitingAcknowledgement: false,
      isLoading: true,
      isStreaming: true,
      currentText: "",
      currentToolCalls: [],
    }));

    const currentMessages = messages || state.continuationMessages;
    let currentStep = step !== undefined ? step : state.step;
    let allToolCalls: AgentToolCall[] = [...state.currentToolCalls];
    let finalText = state.currentText;

    try {
      // Send acknowledgement request with tool results
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "acknowledgement",
          model,
          agent,
          files,
          fileTree,
          customInstructions,
          maxSteps,
          sessionId: state.sessionId,
          currentStep,
          messages: currentMessages,
          toolResults: pendingResults,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Process the stream and continue the loop
      const result = await processStream(response, abortSignal);
      finalText = result.text || finalText;
      currentStep++;

      // If there are more tool calls, handle them
      if (!result.complete && result.toolCalls.length > 0) {
        // Execute all tools
        const { executedTools, results } = await executeAndBuildResults(result.toolCalls);
        allToolCalls = [...allToolCalls, ...executedTools];

        // Check if we need acknowledgement for action tools
        if (result.hasAckTools) {
          const ackExecutedTools = executedTools.filter(t => t.category === "ack");
          
          // Store state and wait for user acknowledgement
          setState((prev) => ({
            ...prev,
            awaitingAcknowledgement: true,
            pendingAckResults: results,
            continuationMessages: result.messages,
            currentText: finalText,
            step: currentStep,
            isLoading: false,
            isStreaming: false,
          }));

          // Pass results to callback so acknowledge can use them immediately
            onAwaitingAcknowledgement?.(
              ackExecutedTools,
              results,
              result.messages,
              currentStep
            );
          return;
        }

        // Only auto tools - continue automatically with parts-based messages
        await continueWithResults(results, result.messages, currentStep, allToolCalls, finalText, abortSignal, result.messagesWithParts);
        return;
      }

      // Complete - no more tool calls
      const assistantMessage: AgentMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: finalText,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        isStreaming: false,
        currentText: "",
        currentToolCalls: [],
        pendingAckResults: [],
        continuationMessages: [],
      }));

      onComplete?.(assistantMessage);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
        }));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        isStreaming: false,
      }));
      onError?.(errorMessage);
    }
  }, [
    state.awaitingAcknowledgement,
    state.pendingAckResults,
    state.continuationMessages,
    state.sessionId,
    state.step,
    state.currentToolCalls,
    state.currentText,
    model,
    agent,
    files,
    fileTree,
    customInstructions,
    maxSteps,
    processStream,
    executeAndBuildResults,
    onAwaitingAcknowledgement,
    onComplete,
    onError,
  ]);

  /**
   * Internal function to continue the loop with auto-tool results
   */
  const continueWithResults = useCallback(
    async (
      toolResults: ToolResultPayload[],
      messages: CoreMessage[],
      currentStep: number,
      allToolCalls: AgentToolCall[],
      currentText: string,
      abortSignal: AbortSignal,
      messagesWithParts?: any[] // Parts-based format (OpenCode-aligned)
    ) => {
      let step = currentStep;
      let tools = [...allToolCalls];
      let text = currentText;
      let msgs = messages;
      let partsBasedMsgs = messagesWithParts;

      while (step < maxSteps) {
        if (abortSignal.aborted) {
          break;
        }

        // Send tool results with parts-based messages (OpenCode-aligned)
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "tool_results",
            model,
            agent,
            files,
            fileTree,
            customInstructions,
            maxSteps,
            sessionId: state.sessionId,
            currentStep: step,
            // Send parts-based format if available (preferred)
            messagesWithParts: partsBasedMsgs,
            // Also send legacy format
            messages: msgs,
            toolResults,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[useAgentChat] Tool results response error:", errorData);
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Clear current state for next step
        setState((prev) => ({
          ...prev,
          currentText: "",
          currentToolCalls: [],
        }));

        const result = await processStream(response, abortSignal);
        text = result.text || text;
        step++;

        if (result.complete || result.toolCalls.length === 0) {
          // Done - finalize
          const assistantMessage: AgentMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: text,
            toolCalls: tools.length > 0 ? tools : undefined,
            timestamp: Date.now(),
          };

          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            isLoading: false,
            isStreaming: false,
            currentText: "",
            currentToolCalls: [],
            pendingAckResults: [],
            continuationMessages: [],
          }));

          onComplete?.(assistantMessage);
          return;
        }

        // Execute all tools
        const { executedTools, results } = await executeAndBuildResults(result.toolCalls);
        tools = [...tools, ...executedTools];

        // Check if we need acknowledgement for action tools
        if (result.hasAckTools) {
          const ackExecutedTools = executedTools.filter(t => t.category === "ack");
          
          // Store state and wait for user acknowledgement
          setState((prev) => ({
            ...prev,
            awaitingAcknowledgement: true,
            pendingAckResults: results,
            continuationMessages: result.messages,
            currentText: text,
            step,
            isLoading: false,
            isStreaming: false,
          }));

          // Pass results to callback so acknowledge can use them immediately
          onAwaitingAcknowledgement?.(
            ackExecutedTools,
            results,
            result.messages,
            step
          );
          return;
        }

        // Only auto tools - continue loop
        console.log("[useAgentChat] Auto tools only, continuing loop");
        toolResults = results;
        msgs = result.messages;
        partsBasedMsgs = result.messagesWithParts;
      }
      
      console.log("[useAgentChat] Loop ended, max steps reached:", step, ">=", maxSteps);
    },
    [
      state.sessionId,
      model,
      agent,
      files,
      fileTree,
      customInstructions,
      maxSteps,
      processStream,
      executeAndBuildResults,
      onAwaitingAcknowledgement,
      onComplete,
    ]
  );

  /**
   * Send a message to the agent and handle the full agentic loop
   */
  const sendMessage = useCallback(
    async (prompt: string) => {
      if (state.isLoading) {
        return;
      }

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;

      // Add user message
      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        isStreaming: true,
        currentText: "",
        currentToolCalls: [],
        error: null,
        step: 0,
        awaitingAcknowledgement: false,
        pendingAckResults: [],
        continuationMessages: [],
      }));

      let currentStep = 0;
      let allToolCalls: AgentToolCall[] = [];
      let finalText = "";

      try {
        // First request - send the prompt
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "prompt",
            prompt,
            model,
            agent,
            files,
            fileTree,
            customInstructions,
            maxSteps,
            sessionId: state.sessionId,
            currentStep,
            messages: [],
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[useAgentChat] Response error:", errorData);
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Process the stream
        const result = await processStream(response, abortSignal);
        finalText = result.text || finalText;
        currentStep++;

        // If complete (no tool calls), we're done
        if (result.complete || result.toolCalls.length === 0) {
          const assistantMessage: AgentMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: finalText,
            timestamp: Date.now(),
          };

          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            isLoading: false,
            isStreaming: false,
            currentText: "",
            currentToolCalls: [],
          }));

          onComplete?.(assistantMessage);
          return assistantMessage;
        }

        // Execute all tools
        const { executedTools, results } = await executeAndBuildResults(result.toolCalls);
        allToolCalls = [...executedTools];

        // Check if we need acknowledgement for action tools
        if (result.hasAckTools) {
          const ackExecutedTools = executedTools.filter(t => t.category === "ack");
          
          // Store state and wait for user acknowledgement
          setState((prev) => ({
            ...prev,
            awaitingAcknowledgement: true,
            pendingAckResults: results,
            continuationMessages: result.messages,
            currentText: finalText,
            step: currentStep,
            isLoading: false,
            isStreaming: false,
          }));

          // Pass results to callback so acknowledge can use them immediately
          onAwaitingAcknowledgement?.(
            ackExecutedTools,
            results,
            result.messages,
            currentStep
          );
          return;
        }

        // Only auto tools - continue the loop automatically with parts-based messages
        await continueWithResults(results, result.messages, currentStep, allToolCalls, finalText, abortSignal, result.messagesWithParts);

      } catch (error) {
        console.error("[useAgentChat] Error in sendMessage:", error);
        if ((error as Error).name === "AbortError") {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
          }));
          return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[useAgentChat] Setting error state:", errorMessage);
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          isStreaming: false,
        }));
        onError?.(errorMessage);
      }
    },
    [
      state.isLoading,
      state.sessionId,
      model,
      agent,
      files,
      fileTree,
      customInstructions,
      maxSteps,
      processStream,
      executeAndBuildResults,
      continueWithResults,
      onAwaitingAcknowledgement,
      onComplete,
      onError,
    ]
  );

  /**
   * Stop the current request
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      isLoading: false,
      isStreaming: false,
    }));
  }, []);

  /**
   * Clear conversation history
   */
  const clearHistory = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      isStreaming: false,
      currentText: "",
      currentToolCalls: [],
      error: null,
      sessionId: null,
      step: 0,
      awaitingAcknowledgement: false,
      pendingAckResults: [],
      continuationMessages: [],
    });
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    messages: state.messages,
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    currentText: state.currentText,
    currentToolCalls: state.currentToolCalls,
    error: state.error,
    sessionId: state.sessionId,
    step: state.step,
    /** Whether we're waiting for user acknowledgement on action tools */
    awaitingAcknowledgement: state.awaitingAcknowledgement,

    // Actions
    sendMessage,
    /** 
     * Acknowledge action tools and continue the agent loop.
     * Call this after action tools (edit, write, bash, etc.) have been executed
     * and the user has acknowledged the changes.
     */
    acknowledge,
    stop,
    clearHistory,
    clearError,
  };
}
