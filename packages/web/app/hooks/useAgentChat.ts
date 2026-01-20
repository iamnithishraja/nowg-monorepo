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
  onAwaitingAcknowledgement?: (ackTools: AgentToolCall[], results: ToolResultPayload[]) => void;
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
    model = "anthropic/claude-3.5-sonnet",
    agent = "build",
    files,
    fileTree,
    customInstructions,
    maxSteps = 10,
    onTextDelta,
    onToolCall,
    onToolCallComplete,
    onStepComplete,
    onComplete,
    onError,
    onAwaitingAcknowledgement,
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
      console.log("[useAgentChat] Executing tool:", toolCall.name, "| Args:", toolCall.args);
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

        console.log("[useAgentChat] Tool found, executing...");
        const result = await tool.execute(toolCall.args, {
          sessionID: state.sessionId || "agent-session",
          messageID: `msg-${Date.now()}`,
          metadata: () => {},
        });

        // Tool.Result has { title, output, metadata } - check if output exists
        const isSuccess = result && "output" in result && typeof result.output === "string";
        console.log("[useAgentChat] Tool execution complete:", toolCall.name, "| Success:", isSuccess);

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
    /** Messages for continuation */
    messages: CoreMessage[];
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
      console.log("[useAgentChat] Processing stream response, status:", response.status);
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
      let awaitingToolResults = false;
      let hasAckTools = false;
      let hasAutoTools = false;
      let eventCount = 0;

      while (true) {
        if (abortSignal.aborted) {
          console.log("[useAgentChat] Stream aborted");
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) {
          console.log("[useAgentChat] Stream done, processed", eventCount, "events");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            eventCount++;
            console.log("[useAgentChat] Stream event:", data.type, "| Event #", eventCount);

            switch (data.type) {
              case "session_start":
                sessionId = data.sessionId;
                console.log("[useAgentChat] Session started:", sessionId, "| Step:", data.step);
                setState((prev) => ({ ...prev, sessionId, step: data.step || prev.step }));
                break;

              case "text_delta":
                assistantText += data.delta;
                setState((prev) => ({ ...prev, currentText: assistantText }));
                onTextDelta?.(data.delta);
                break;

              case "tool_call": {
                console.log("[useAgentChat] Tool call received:", data.name, "| Category:", data.category);
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
                console.log("[useAgentChat] Step complete:", data.step);
                setState((prev) => ({ ...prev, step: data.step }));
                onStepComplete?.(data.step);
                break;

              case "awaiting_tool_results":
                // Server wants us to execute tools and send results back
                console.log("[useAgentChat] Awaiting tool results | Ack:", data.hasAckTools, "| Auto:", data.hasAutoTools, "| Tool calls in event:", data.toolCalls?.length);
                
                // Update tool calls from the event if provided (they might have been sent here instead of as separate tool_call events)
                if (data.toolCalls && Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
                  console.log("[useAgentChat] Updating tool calls from awaiting_tool_results event");
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
                
                messagesForContinuation = data.messages || [];
                awaitingToolResults = true;
                hasAckTools = data.hasAckTools || false;
                hasAutoTools = data.hasAutoTools || false;
                break;

              case "complete": {
                // No more tool calls, we're done
                console.log("[useAgentChat] Complete | Text length:", assistantText.length, "| Tool calls:", toolCalls.length);
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
                };
              }

              case "error":
                console.error("[useAgentChat] Stream error:", data.error);
                throw new Error(data.error);

              case "done":
                console.log("[useAgentChat] Stream done event received");
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
      console.log("[useAgentChat] Stream processing result | Complete:", isComplete, "| Awaiting:", awaitingToolResults, "| Tool calls:", toolCalls.length, "| HasAck:", hasAckTools, "| HasAuto:", hasAutoTools);

      return { 
        complete: isComplete, 
        text: assistantText, 
        toolCalls,
        hasAckTools,
        hasAutoTools,
        autoToolCalls,
        ackToolCalls,
        messages: messagesForContinuation,
      };
    },
    [state.sessionId, onTextDelta, onToolCall, onStepComplete]
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
  const acknowledge = useCallback(async (results?: ToolResultPayload[]) => {
    const pendingResults = results || state.pendingAckResults;
    const isAwaiting = results ? true : state.awaitingAcknowledgement;
    
    console.log("[useAgentChat] acknowledge called | Awaiting:", isAwaiting, "| Pending results:", pendingResults.length, "| Using provided results:", !!results);
    if (!isAwaiting || pendingResults.length === 0) {
      console.log("[useAgentChat] Cannot acknowledge - not awaiting or no pending results");
      return;
    }

    const abortSignal = abortControllerRef.current?.signal;
    if (!abortSignal || abortSignal.aborted) {
      console.log("[useAgentChat] Cannot acknowledge - abort signal invalid");
      return;
    }

    console.log("[useAgentChat] Sending acknowledgement with", pendingResults.length, "tool results");
    // Clear awaiting state
    setState((prev) => ({
      ...prev,
      awaitingAcknowledgement: false,
      isLoading: true,
      isStreaming: true,
      currentText: "",
      currentToolCalls: [],
    }));

    const currentMessages = state.continuationMessages;
    let currentStep = state.step;
    let allToolCalls: AgentToolCall[] = [...state.currentToolCalls];
    let finalText = state.currentText;

    try {
      // Send acknowledgement request with tool results
      console.log("[useAgentChat] Sending acknowledgement request to /api/agent");
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

      console.log("[useAgentChat] Acknowledgement response status:", response.status);

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
          onAwaitingAcknowledgement?.(ackExecutedTools, results);
          return;
        }

        // Only auto tools - continue automatically
        await continueWithResults(results, result.messages, currentStep, allToolCalls, finalText, abortSignal);
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
      abortSignal: AbortSignal
    ) => {
      console.log("[useAgentChat] continueWithResults called | Step:", currentStep, "| Tool results:", toolResults.length);
      let step = currentStep;
      let tools = [...allToolCalls];
      let text = currentText;
      let msgs = messages;

      while (step < maxSteps) {
        if (abortSignal.aborted) {
          console.log("[useAgentChat] Loop aborted at step", step);
          break;
        }

        console.log("[useAgentChat] Continuing loop | Step:", step, "/", maxSteps);
        // Send tool results
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
            messages: msgs,
            toolResults,
          }),
          signal: abortSignal,
        });

        console.log("[useAgentChat] Tool results response status:", response.status);
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
        console.log("[useAgentChat] Loop iteration complete | Step:", step, "| Complete:", result.complete, "| Tool calls:", result.toolCalls.length);

        if (result.complete || result.toolCalls.length === 0) {
          // Done - finalize
          console.log("[useAgentChat] Loop complete, finalizing message");
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
        console.log("[useAgentChat] Executing", result.toolCalls.length, "tools in loop");
        const { executedTools, results } = await executeAndBuildResults(result.toolCalls);
        tools = [...tools, ...executedTools];

        // Check if we need acknowledgement for action tools
        if (result.hasAckTools) {
          console.log("[useAgentChat] Action tools detected, waiting for acknowledgement");
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
          onAwaitingAcknowledgement?.(ackExecutedTools, results);
          return;
        }

        // Only auto tools - continue loop
        console.log("[useAgentChat] Auto tools only, continuing loop");
        toolResults = results;
        msgs = result.messages;
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
      console.log("[useAgentChat] sendMessage called:", prompt.substring(0, 100));
      if (state.isLoading) {
        console.log("[useAgentChat] Already loading, ignoring request");
        return;
      }

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;
      console.log("[useAgentChat] Abort controller created");

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
        console.log("[useAgentChat] Sending request to /api/agent");
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

        console.log("[useAgentChat] Response received, status:", response.status);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[useAgentChat] Response error:", errorData);
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Process the stream
        console.log("[useAgentChat] Processing stream...");
        const result = await processStream(response, abortSignal);
        finalText = result.text || finalText;
        currentStep++;
        console.log("[useAgentChat] Stream processed | Complete:", result.complete, "| Tool calls:", result.toolCalls.length);

        // If complete (no tool calls), we're done
        if (result.complete || result.toolCalls.length === 0) {
          console.log("[useAgentChat] No tool calls, completing");
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
        console.log("[useAgentChat] Executing", result.toolCalls.length, "tools");
        const { executedTools, results } = await executeAndBuildResults(result.toolCalls);
        allToolCalls = [...executedTools];
        console.log("[useAgentChat] Tools executed | Results:", results.length);

        // Check if we need acknowledgement for action tools
        if (result.hasAckTools) {
          console.log("[useAgentChat] Action tools require acknowledgement");
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
          onAwaitingAcknowledgement?.(ackExecutedTools, results);
          return;
        }

        // Only auto tools - continue the loop automatically
        console.log("[useAgentChat] Auto tools only, continuing loop");
        await continueWithResults(results, result.messages, currentStep, allToolCalls, finalText, abortSignal);

      } catch (error) {
        console.error("[useAgentChat] Error in sendMessage:", error);
        if ((error as Error).name === "AbortError") {
          console.log("[useAgentChat] Request aborted");
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
