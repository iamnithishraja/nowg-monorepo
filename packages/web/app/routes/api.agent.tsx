import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, type CoreMessage } from "ai";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { Agent, AgentTools, SystemPrompt } from "~/agent";
import type { FileMap, FileNode } from "~/utils/constants";
import { ChatService } from "~/lib/chatService";
import { 
  toModelMessages, 
  createTextPart, 
  createToolPartRunning, 
  updateToolPartCompleted,
  updateToolPartError,
  createStepStartPart,
  createStepFinishPart,
  createReasoningPart,
  extractTextFromParts,
  extractToolParts,
  hasPendingTools,
  buildToolResultsContent,
  type StoredMessage,
} from "~/lib/messageConverter";
import type { AgentMessageTypes } from "~/models/agentMessageModel";

/**
 * Agent API Endpoint - OpenCode-style Parts-Based Architecture
 * 
 * This endpoint provides an agentic loop with tool calling support.
 * Tools are defined on the server but executed on the frontend via WebContainer.
 * 
 * Key Architecture (similar to OpenCode):
 * - Messages store interleaved `parts` array (text, tool calls, reasoning)
 * - Parts preserve exact order of content as streamed from LLM
 * - Tool calls have states: pending → running → completed/error
 * - Uses toModelMessages() to convert stored parts back to model-compatible format
 * 
 * Tool Categories:
 * - AUTO_CONTINUE: Read-only tools (read, grep, ls, glob, codesearch, lsp)
 *   These run in a loop - frontend executes and automatically continues
 * - REQUIRES_ACK: Write/action tools (edit, write, multiedit, bash, webfetch, websearch, batch)
 *   These require frontend acknowledgement before continuing
 * 
 * Event types streamed:
 * - session_start: Session initialized with ID
 * - text_delta: Incremental text from LLM
 * - reasoning_delta: Reasoning/thinking content
 * - tool_call: LLM wants to call a tool (includes category: "auto" | "ack")
 * - tool_call_start: Tool call starting (pending state)
 * - awaiting_tool_results: Tools need execution
 * - step_start: New step in agent loop
 * - step_complete: One step of agent loop finished
 * - error: Error occurred
 */

/**
 * Tool categories for execution flow control
 */
export const TOOL_CATEGORIES = {
  /** Read-only tools that auto-continue the loop */
  AUTO_CONTINUE: new Set(["read", "grep", "ls", "glob", "codesearch", "lsp"]),
  /** Action tools that require acknowledgement */
  REQUIRES_ACK: new Set(["edit", "write", "multiedit", "bash", "webfetch", "websearch", "batch"]),
} as const;

/**
 * Get the category of a tool
 */
function getToolCategory(toolName: string): "auto" | "ack" {
  if (TOOL_CATEGORIES.AUTO_CONTINUE.has(toolName)) {
    return "auto";
  }
  return "ack";
}

/**
 * Generate unique part ID
 */
function generatePartId(): string {
  return `part-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("Agent API - POST only", { status: 405 });
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: {
    success: boolean;
    output: string;
    error?: string;
  };
}

/**
 * Request types for the agent endpoint
 */
type RequestType = 
  | "prompt"           // Initial user prompt
  | "tool_results"     // Tool results from auto-continue tools
  | "acknowledgement"; // Acknowledgement for action tools

interface AgentRequest {
  requestType?: RequestType;
  prompt?: string;
  messages?: CoreMessage[];
  model?: string;
  agent?: string;
  files?: FileMap;
  fileTree?: FileNode;
  customInstructions?: string;
  maxSteps?: number;
  toolResults?: ToolResult[];
  sessionId?: string;
  currentStep?: number;
  conversationId?: string;
  chatId?: string;
  /** Assistant message ID for continuations (update instead of create new) */
  assistantMessageId?: string;
  /** Accumulated parts from previous steps (OpenCode style) */
  accumulatedParts?: AgentMessageTypes.Part[];
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log("[Agent API] Request received");
    
    // Authenticate user
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      console.error("[Agent API] Authentication failed");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: AgentRequest = await request.json();
    const {
      prompt,
      messages: inputMessages = [],
      model = "anthropic/claude-4.5-sonnet",
      agent: agentName = "build",
      files,
      fileTree,
      customInstructions,
      maxSteps = 10,
      toolResults,
      sessionId: inputSessionId,
      currentStep = 0,
      conversationId,
      chatId,
      assistantMessageId: inputAssistantMessageId,
      accumulatedParts: inputAccumulatedParts = [],
    } = body;

    const requestType = body.requestType || "prompt";
    const userId = session.user.id;
    console.log("[Agent API] Request type:", requestType, "| Step:", currentStep, "| ConvId:", conversationId, "| ChatId:", chatId);
    
    // Initialize chat service for message persistence
    const chatService = new ChatService();

    // Validate request based on type
    if (requestType === "prompt" && !prompt && inputMessages.length === 0) {
      console.error("[Agent API] Validation failed: prompt or messages required");
      return new Response(
        JSON.stringify({ error: "prompt or messages required for prompt request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if ((requestType === "tool_results" || requestType === "acknowledgement") && 
        (!toolResults || toolResults.length === 0)) {
      console.error("[Agent API] Validation failed: toolResults required");
      return new Response(
        JSON.stringify({ error: "toolResults required for tool_results/acknowledgement request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check step limit
    if (currentStep >= maxSteps) {
      console.warn("[Agent API] Max steps reached:", currentStep, ">=", maxSteps);
      return new Response(
        JSON.stringify({ error: `Max steps (${maxSteps}) reached` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get API key
    const openRouterApiKey = getEnv("OPENROUTER_API_KEY");
    if (!openRouterApiKey) {
      console.error("[Agent API] OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log("[Agent API] Starting stream processing");

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };

        try {
          // Generate session ID
          const sessionId = inputSessionId || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const stepCount = currentStep + 1;
          
          // Track assistant message ID for continuations
          let assistantMessageId = inputAssistantMessageId || null;
          
          // Track accumulated parts across steps (OpenCode style)
          let parts: AgentMessageTypes.Part[] = [...(inputAccumulatedParts || [])];
          
          // Track current text part for streaming
          let currentTextPart: AgentMessageTypes.TextPart | null = null;
          
          // Track tool call parts by ID for updates
          const toolCallParts: Record<string, AgentMessageTypes.ToolPart> = {};

          // Add step-start part
          const stepStartPart = createStepStartPart();
          parts.push(stepStartPart);

          sendChunk({ 
            type: "session_start", 
            sessionId, 
            messageId, 
            step: stepCount, 
            assistantMessageId,
            partsCount: parts.length,
          });
          console.log("[Agent API] Session started:", sessionId, "| Step:", stepCount);

          // Save user message to database on first step (only for prompt requests)
          if (requestType === "prompt" && prompt && conversationId && chatId && currentStep === 0) {
            try {
              // Create user message with parts
              const userParts: AgentMessageTypes.Part[] = [
                createTextPart(prompt),
              ];
              
              const result = await chatService.addMessageToChat(
                conversationId,
                chatId,
                {
                  role: "user",
                  content: prompt,
                  parts: userParts,
                  clientRequestId: `user-${sessionId}-${Date.now()}`,
                } as any,
                userId
              );
              console.log("[Agent API] User message saved:", result.messageId);
              sendChunk({ type: "user_message_saved", messageId: result.messageId });
              
              if (result.chatTitle) {
                sendChunk({ type: "chat_title_updated", chatTitle: result.chatTitle });
              }
            } catch (saveError) {
              console.error("[Agent API] Failed to save user message:", saveError);
            }
          }

          // Get the agent
          const agent = Agent.get(agentName) || Agent.defaultAgent();
          console.log("[Agent API] Using agent:", agentName);

          // Build system prompt
          const systemParts = SystemPrompt.build({
            agent,
            files,
            fileTree,
            customInstructions,
            userMessage: prompt,
          });
          const systemPrompt = systemParts.join("\n\n");

          // Resolve tools for the agent
          const tools = AgentTools.resolve(agent, {
            sessionID: sessionId,
            messageID: messageId,
            agent,
          });
          console.log("[Agent API] Tools resolved:", Object.keys(tools || {}).length);

          // Build messages array using toModelMessages for stored conversation history
          // Then add current prompt or tool results
          let messages: CoreMessage[] = [];
          
          // If we have stored messages (from database), convert them properly
          if (inputMessages.length > 0) {
            // Convert input messages - these might be in legacy format or parts format
            const storedMessages: StoredMessage[] = inputMessages.map((msg) => {
              if (msg.role === "user") {
                return {
                  role: "user" as const,
                  parts: [createTextPart(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content))],
                  content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                };
              } else if (msg.role === "assistant") {
                // Handle assistant messages with tool calls
                if (Array.isArray(msg.content)) {
                  const parts: AgentMessageTypes.Part[] = [];
                  const toolCalls: any[] = [];
                  
                  for (const item of msg.content) {
                    if (item.type === "text" && (item as any).text) {
                      parts.push(createTextPart((item as any).text));
                    } else if (item.type === "tool-call") {
                      const tc = item as any;
                      const toolPart = createToolPartRunning(
                        tc.toolName || "unknown",
                        tc.toolCallId || tc.id,
                        tc.args || {}
                      );
                      parts.push(toolPart);
                      toolCalls.push({
                        id: tc.toolCallId || tc.id,
                        name: tc.toolName,
                        args: tc.args,
                        status: "pending",
                      });
                    }
                  }
                  
                  return {
                    role: "assistant" as const,
                    parts,
                    toolCalls,
                    content: parts.filter(p => p.type === "text").map(p => (p as any).text).join(""),
                  };
                }
                
                return {
                  role: "assistant" as const,
                  parts: [createTextPart(typeof msg.content === "string" ? msg.content : "")],
                  content: typeof msg.content === "string" ? msg.content : "",
                };
              }
              
              // Handle tool messages - convert to user message with results
              if (msg.role === "tool" && Array.isArray(msg.content)) {
                const resultParts: string[] = [];
                for (const item of msg.content) {
                  if (item.type === "tool-result") {
                    resultParts.push(
                      `=== Tool Result: ${(item as any).toolName} ===\n${(item as any).result}`
                    );
                  }
                }
                
                return {
                  role: "user" as const,
                  parts: [createTextPart(`[Tool execution results]\n\n${resultParts.join("\n\n")}`, { synthetic: true })],
                  content: `[Tool execution results]\n\n${resultParts.join("\n\n")}`,
                };
              }
              
              return {
                role: "user" as const,
                parts: [],
                content: "",
              };
            });
            
            messages = toModelMessages(storedMessages.filter(m => m.parts.length > 0));
          }

          // If we have new tool results, add them as a user message
          if (toolResults && toolResults.length > 0) {
            console.log("[Agent API] Processing", toolResults.length, "tool results");
            
            // Update tool parts in our accumulated parts to completed/error state
            for (const tr of toolResults) {
              const existingPart = toolCallParts[tr.toolCallId] || 
                parts.find(p => p.type === "tool" && (p as AgentMessageTypes.ToolPart).callID === tr.toolCallId);
              
              if (existingPart && existingPart.type === "tool") {
                const toolPart = existingPart as AgentMessageTypes.ToolPart;
                if (tr.result.success) {
                  const updatedPart = updateToolPartCompleted(
                    toolPart,
                    tr.result.output,
                    {},
                    tr.toolName
                  );
                  // Replace in parts array
                  const idx = parts.findIndex(p => p.type === "tool" && (p as AgentMessageTypes.ToolPart).callID === tr.toolCallId);
                  if (idx >= 0) {
                    parts[idx] = updatedPart;
                  }
                } else {
                  const updatedPart = updateToolPartError(
                    toolPart,
                    tr.result.error || "Tool execution failed"
                  );
                  const idx = parts.findIndex(p => p.type === "tool" && (p as AgentMessageTypes.ToolPart).callID === tr.toolCallId);
                  if (idx >= 0) {
                    parts[idx] = updatedPart;
                  }
                }
              }
            }
            
            // Add tool results as user message content
            const toolResultsContent = buildToolResultsContent(toolResults);
            messages.push({ 
              role: "user", 
              content: toolResultsContent,
            });
          }
          
          // Add the current prompt as user message (only on first call)
          if (prompt && currentStep === 0) {
            messages.push({ role: "user", content: prompt });
          }
          
          console.log("[Agent API] Messages prepared:", messages.length);

          // Create OpenRouter client
          const openrouter = createOpenRouter({ apiKey: openRouterApiKey });
          
          // Track tool calls during streaming
          const collectedToolCalls: Array<{
            toolCallId: string;
            toolName: string;
            args: any;
          }> = [];

          console.log("[Agent API] Starting LLM stream with model:", model);
          
          // Stream the response
          let result;
          try {
            result = streamText({
              model: openrouter(model),
              system: systemPrompt,
              messages,
              tools,
              onStepFinish: async (step: any) => {
                // Capture tool calls from each step
                const stepToolCalls = step.toolCalls || [];
                console.log("[Agent API] Step finished, tool calls:", stepToolCalls.length);
                
                for (const toolCall of stepToolCalls) {
                  const args = toolCall.args || (toolCall as any).input || {};
                  const toolCallId = toolCall.toolCallId || toolCall.id;
                  const toolName = toolCall.toolName || toolCall.name;
                  
                  if (!collectedToolCalls.some(tc => tc.toolCallId === toolCallId)) {
                    collectedToolCalls.push({
                      toolCallId,
                      toolName,
                      args,
                    });
                    
                    // Create tool part in running state
                    const toolPart = createToolPartRunning(toolName, toolCallId, args);
                    parts.push(toolPart);
                    toolCallParts[toolCallId] = toolPart;
                    
                    // Close current text part if any
                    if (currentTextPart) {
                      currentTextPart.time = {
                        start: currentTextPart.time?.start || Date.now(),
                        end: Date.now(),
                      };
                      currentTextPart = null;
                    }
                    
                    sendChunk({
                      type: "tool_call",
                      id: toolCallId,
                      name: toolName,
                      args,
                      step: stepCount,
                      category: getToolCategory(toolName),
                    });
                  }
                }
              },
            });
          } catch (streamError) {
            console.error("[Agent API] Error creating streamText:", streamError);
            throw streamError;
          }

          // Stream text deltas and build parts
          let deltaCount = 0;
          
          try {
            for await (const delta of result.textStream) {
              deltaCount++;
              
              // Create or append to current text part
              if (!currentTextPart) {
                currentTextPart = {
                  type: "text",
                  id: generatePartId(),
                  text: delta,
                  time: { start: Date.now() },
                };
                parts.push(currentTextPart);
              } else {
                currentTextPart.text += delta;
              }
              
              sendChunk({
                type: "text_delta",
                delta,
              });
            }
            
            // Close current text part
            if (currentTextPart) {
              currentTextPart.time = {
                start: currentTextPart.time?.start || Date.now(),
                end: Date.now(),
              };
            }
            
            console.log("[Agent API] Text streaming complete:", deltaCount, "deltas");
          } catch (streamError) {
            console.error("[Agent API] Error during text streaming:", streamError);
            throw streamError;
          }

          // Get tool calls from result - ALWAYS check both sources to avoid race conditions
          // The onStepFinish callback is async, so collectedToolCalls might not be populated yet
          let responseToolCalls: any[] = [...collectedToolCalls];
          
          try {
            // Always try to get tool calls from result.toolCalls as well
            const resultToolCalls = await result.toolCalls || [];
            const additionalToolCalls = Array.isArray(resultToolCalls) ? resultToolCalls.map((tc: any) => ({
              toolCallId: tc.toolCallId || tc.id,
              toolName: tc.toolName || tc.name,
              args: tc.args || {},
            })) : [];
            
            // Merge any tool calls from result that aren't in collectedToolCalls
            for (const tc of additionalToolCalls) {
              if (!responseToolCalls.some(existing => existing.toolCallId === tc.toolCallId)) {
                responseToolCalls.push(tc);
                console.log("[Agent API] Adding tool call from result.toolCalls:", tc.toolName, tc.toolCallId);
              }
            }
            
            // Create tool parts and send events for any tool calls we missed earlier
            for (const tc of responseToolCalls) {
              if (!toolCallParts[tc.toolCallId]) {
                const toolPart = createToolPartRunning(tc.toolName, tc.toolCallId, tc.args);
                parts.push(toolPart);
                toolCallParts[tc.toolCallId] = toolPart;
                
                sendChunk({
                  type: "tool_call",
                  id: tc.toolCallId,
                  name: tc.toolName,
                  args: tc.args,
                  step: stepCount,
                  category: getToolCategory(tc.toolName),
                });
                console.log("[Agent API] Sent delayed tool_call event:", tc.toolName, tc.toolCallId);
              }
            }
          } catch (e) {
            console.error("[Agent API] Error getting tool calls:", e);
          }
          
          console.log("[Agent API] Total tool calls to send:", responseToolCalls.length);

          // Get usage info
          let usage: any = {};
          try {
            usage = await result.usage;
            console.log("[Agent API] Usage info:", usage);
          } catch (usageError) {
            console.error("[Agent API] Error getting usage:", usageError);
          }

          // Add step-finish part
          const stepFinishPart = createStepFinishPart(
            responseToolCalls.length > 0 ? "tool-calls" : "stop",
            {
              input: usage?.promptTokens || 0,
              output: usage?.completionTokens || 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            0 // cost calculation would go here
          );
          parts.push(stepFinishPart);

          // Categorize tool calls
          const autoTools = responseToolCalls.filter(tc => getToolCategory(tc.toolName) === "auto");
          const ackTools = responseToolCalls.filter(tc => getToolCategory(tc.toolName) === "ack");

          // Send step complete
          sendChunk({
            type: "step_complete",
            step: stepCount,
            hasToolCalls: responseToolCalls.length > 0,
            finishReason: responseToolCalls.length > 0 ? "tool-calls" : "stop",
          });

          // Save assistant message to database
          const tokensUsed = usage ? ((usage as any).totalTokens || 0) : 0;
          const inputTokens = usage ? ((usage as any).promptTokens || 0) : 0;
          const outputTokens = usage ? ((usage as any).completionTokens || 0) : 0;
          
          if (conversationId && chatId) {
            try {
              const textContent = extractTextFromParts(parts);
              const toolParts = extractToolParts(parts);
              
              if (assistantMessageId) {
                // Update existing message (continuation step)
                await chatService.updateChatMessage(
                  conversationId,
                  chatId,
                  assistantMessageId,
                  {
                    content: textContent,
                    parts: parts,
                    toolCalls: toolParts.map(tp => ({
                      id: tp.callID,
                      name: tp.tool,
                      args: tp.state.input,
                      status: tp.state.status,
                      category: getToolCategory(tp.tool),
                    })),
                    tokensUsed,
                    inputTokens,
                    outputTokens,
                    finish: responseToolCalls.length > 0 ? "tool-calls" : "stop",
                  } as any,
                  userId
                );
                console.log("[Agent API] Assistant message updated:", assistantMessageId);
                sendChunk({ type: "assistant_message_saved", messageId: assistantMessageId });
              } else {
                // Create new message (first step)
                const result = await chatService.addMessageToChat(
                  conversationId,
                  chatId,
                  {
                    role: "assistant",
                    content: textContent,
                    parts: parts,
                    toolCalls: toolParts.map(tp => ({
                      id: tp.callID,
                      name: tp.tool,
                      args: tp.state.input,
                      status: tp.state.status,
                      category: getToolCategory(tp.tool),
                    })),
                    model: model,
                    tokensUsed,
                    inputTokens,
                    outputTokens,
                    finish: responseToolCalls.length > 0 ? "tool-calls" : "stop",
                    clientRequestId: `assistant-${sessionId}-${stepCount}`,
                  } as any,
                  userId
                );
                assistantMessageId = result.messageId;
                console.log("[Agent API] Assistant message created:", assistantMessageId);
                sendChunk({ type: "assistant_message_saved", messageId: assistantMessageId });
              }
            } catch (saveError) {
              console.error("[Agent API] Failed to save assistant message:", saveError);
            }
          }

          // If there are pending tool calls, tell client to execute
          if (responseToolCalls.length > 0) {
            console.log("[Agent API] Sending awaiting_tool_results | Total:", responseToolCalls.length);
            
            const hasAckTools = ackTools.length > 0;
            const hasAutoTools = autoTools.length > 0;

            sendChunk({
              type: "awaiting_tool_results",
              toolCalls: responseToolCalls.map(tc => ({
                id: tc.toolCallId,
                name: tc.toolName,
                args: tc.args,
                status: "pending",
                category: getToolCategory(tc.toolName),
              })),
              autoTools: autoTools.map(tc => ({
                id: tc.toolCallId,
                name: tc.toolName,
                args: tc.args,
              })),
              ackTools: ackTools.map(tc => ({
                id: tc.toolCallId,
                name: tc.toolName,
                args: tc.args,
              })),
              hasAckTools,
              hasAutoTools,
              text: extractTextFromParts(parts),
              step: stepCount,
              sessionId,
              assistantMessageId,
              // Send accumulated parts for continuation (OpenCode style)
              accumulatedParts: parts,
              // Also send messages for backwards compatibility
              messages: messages,
            });
          } else {
            console.log("[Agent API] No tool calls, response complete");
          }

          console.log("[Agent API] Stream completed successfully");
        } catch (error) {
          console.error("[Agent API] Error in stream processing:", error);
          if (error instanceof Error) {
            console.error("[Agent API] Error stack:", error.stack);
          }
          sendChunk({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Agent API] Fatal error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
